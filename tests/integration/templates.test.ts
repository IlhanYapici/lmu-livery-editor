import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { templateUrl } from '../../src/shared/api'
import { resolveTemplateUrl } from '../../src/main/templateProtocol'
import { scanTemplates } from '../../src/main/templates'
import type { Raster } from '../../src/shared/psd/composite'
import { applyUserRegions, buildRegionMap, REGIONS } from '../../src/shared/psd/regions'
import { classifyTemplate } from '../../src/shared/psd/roles'
import { outlineTemplate, renderExact, renderSegments } from '../../src/shared/psd/templateRender'
import { decodeTga, encodeTga24, readTgaHeader, tgaSize } from '../../src/shared/tga'
import { AREA, BASE_COLOUR, makeTemplate, SIZE, TEMPLATES, writeTemplates, type TemplateKind } from '../fixtures/templates'
import { decoder, pixelAt, readTemplate } from '../helpers'

// The whole template chain on synthetic templates (ADR-0027): read → guides → segments → exact merge →
// region map → TGA. The real-template audit (ADR-0012) stays a manual check on a PC with the game.

const open = (kind: TemplateKind) => {
  const psd = readTemplate(makeTemplate(kind))
  const structure = classifyTemplate(psd)
  return { psd, structure, outline: outlineTemplate(psd, structure) }
}

const at = (r: { x: number; y: number }) => [r.x + 1, r.y + 1] as const
const BASE_POINT = [30, 30] as const

/** A user layer raster: a half-transparent red square, an opaque white square, and an opaque red square under the class sticker. */
function userRaster(): Raster {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (x >= 8 && x < 32 && y >= 8 && y < 32) data.set([255, 0, 0, 128], (y * SIZE + x) * 4)
      if (x >= 36 && x < 60 && y >= 36 && y < 60) data.set([255, 255, 255, 255], (y * SIZE + x) * 4)
      if (x >= 18 && x < 30 && y >= 38 && y < 50) data.set([255, 0, 0, 255], (y * SIZE + x) * 4)
    }
  return { left: 0, top: 0, width: SIZE, height: SIZE, data }
}

describe('guide detection on the template variants of the game', () => {
  it('Ferrari 296 layout: guides by name, no guess', () => {
    const { structure, outline } = open('ferrari')
    expect(structure.wireframe?.name).toBe('Wireframe')
    expect(structure.mask?.name).toBe('Mask(Disable for export)')
    expect(structure.regions).toHaveLength(5)
    expect(structure.base?.name).toBe('base')
    expect(structure.warnings).toEqual([])
    expect(outline.content.map((n) => n.name)).toEqual(['base', 'carbon', "Number Plates - Don't move!", 'Class Stickers', 'Levels 1'])
    expect([outline.defaultInsertion, outline.maxInsertion]).toEqual([2, 4])
  })

  it('Aston Martin Vantage layout: the wireframe "Background" is found from its position', () => {
    const { structure } = open('aston')
    expect(structure.wireframe?.name).toBe('Background')
    expect(structure.warnings).toEqual(['wireframe guessed from position: "Background"'])
  })

  it('Lamborghini SC63 layout: "Maks" typo, no top-level Levels, Clamp group stays content', () => {
    const { structure, outline } = open('lambo')
    expect(structure.mask?.name).toBe('Maks(Disable for export)')
    expect(structure.content.map((l) => l.name)).toContain('Clamp')
    expect(outline.maxInsertion).toBe(structure.content.length)
  })

  it('Aston Martin Valkyrie layout: no mask guide, "Regions" group, "UVW" wireframe', () => {
    const { structure } = open('valkyrie')
    expect(structure.mask).toBeUndefined()
    expect(structure.regions).toHaveLength(5)
    expect(structure.wireframe?.name).toBe('UVW')
    expect(structure.base?.name).toBe('Color Fill 2')
  })
})

describe('template segments and the exact merge', () => {
  it('splits at the insertion point; Levels becomes the table; saved visibility and overrides apply', () => {
    const { psd, structure, outline } = open('ferrari')
    const s = renderSegments(psd, structure, { insertion: outline.defaultInsertion, visibility: {} }, decoder)
    expect(pixelAt(s.below.data, SIZE, ...BASE_POINT)).toEqual([...BASE_COLOUR, 255])
    expect(pixelAt(s.below.data, SIZE, ...at(AREA.carbon))).toEqual([20, 20, 20, 255])
    expect(pixelAt(s.above.data, SIZE, ...at(AREA.wecPlate))).toEqual([255, 255, 255, 255])
    expect(pixelAt(s.above.data, SIZE, ...at(AREA.lmPlate))[3]).toBe(0)
    expect([s.table[0], s.table[255], s.fastIsExact]).toEqual([10, 225, true])

    const lm = renderSegments(psd, structure, { insertion: outline.defaultInsertion, visibility: { '2/1': true } }, decoder)
    expect(pixelAt(lm.above.data, SIZE, ...at(AREA.lmPlate))).toEqual([255, 212, 0, 255])
  })

  it('fast preview = exact merge (±1) when fastIsExact, with half-transparent user pixels', () => {
    const { psd, structure, outline } = open('ferrari')
    const options = { insertion: outline.defaultInsertion, visibility: {} }
    const s = renderSegments(psd, structure, options, decoder)
    const user = userRaster()
    const exact = renderExact(psd, structure, options, user, decoder)
    let worst = 0
    for (let i = 0; i < exact.data.length; i += 4) {
      const ua = user.data[i + 3] / 255
      const aa = s.above.data[i + 3] / 255
      for (let c = 0; c < 3; c++) {
        const withUser = s.below.data[i + c] * (1 - ua) + user.data[i + c] * ua
        const fast = s.table[Math.round(withUser * (1 - aa) + s.above.data[i + c] * aa)]
        worst = Math.max(worst, Math.abs(fast - exact.data[i + c]))
      }
    }
    expect(worst).toBeLessThanOrEqual(1)
  })

  it('keeps the skin inside the template Levels range; decals stay above the user layers', () => {
    const { psd, structure, outline } = open('ferrari')
    const exact = renderExact(psd, structure, { insertion: outline.defaultInsertion, visibility: {} }, userRaster(), decoder)
    let min = 255
    let max = 0
    for (let i = 0; i < exact.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        min = Math.min(min, exact.data[i + c])
        max = Math.max(max, exact.data[i + c])
      }
    }
    expect([min >= 10, max <= 225]).toEqual([true, true])
    // Levels 10–225: v → round(10 + v × 215 / 255).
    const level = (v: number) => Math.round(10 + (v * 215) / 255)
    // The user's red square is under the class sticker: the sticker (green, a decal) stays on top...
    expect(pixelAt(exact.data, SIZE, ...at(AREA.sticker))).toEqual([level(0), level(150), level(57), 255])
    // ...and the red shows around it.
    expect(pixelAt(exact.data, SIZE, 18, 38)).toEqual([level(255), level(0), level(0), 255])
  })

  it('Lamborghini SC63 layout: the fast preview is not exact, the exact merge applies the Clamp group', () => {
    const { psd, structure, outline } = open('lambo')
    const options = { insertion: outline.defaultInsertion, visibility: {} }
    const s = renderSegments(psd, structure, options, decoder)
    expect(s.fastIsExact).toBe(false)
    const exact = renderExact(psd, structure, options, userRaster(), decoder)
    const base = pixelAt(exact.data, SIZE, ...BASE_POINT)
    // Levels 5–210 then 10 % less saturation: not the raw base colour, and inside the Levels range.
    expect(base.slice(0, 3)).not.toEqual([...BASE_COLOUR])
    expect(Math.min(...base.slice(0, 3)) >= 5 && Math.max(...base.slice(0, 3)) <= 210).toBe(true)
  })
})

describe('region map', () => {
  it('builds the template map from the masked region layers, with only region colours', () => {
    const { structure } = open('ferrari')
    const map = buildRegionMap(structure.regions, decoder, SIZE, SIZE)
    expect(pixelAt(map.image.data, SIZE, ...at(AREA.carbon))).toEqual([255, 0, 0, 255])
    expect(pixelAt(map.image.data, SIZE, ...at(AREA.wecPlate))).toEqual([0, 0, 255, 255])
    expect(pixelAt(map.image.data, SIZE, ...BASE_POINT)).toEqual([0, 0, 0, 255])
    expect(map.counts.reduce((a, b) => a + b)).toBe(SIZE * SIZE)
  })

  it('draws user shapes with at least half alpha, snapped to the nearest region colour', () => {
    const { structure } = open('ferrari')
    const template = buildRegionMap(structure.regions, decoder, SIZE, SIZE).image.data
    const shapes = new Uint8ClampedArray(SIZE * SIZE * 4)
    shapes.set([255, 255, 255, 200], (30 * SIZE + 30) * 4) // Stickers, opaque enough
    shapes.set([255, 255, 255, 100], (31 * SIZE + 30) * 4) // too transparent: template stays
    shapes.set([250, 10, 10, 255], (32 * SIZE + 30) * 4) // anti-aliased red: snaps to Carbon
    const map = applyUserRegions(template, shapes)
    expect(pixelAt(map, SIZE, 30, 30)).toEqual([255, 255, 255, 255])
    expect(pixelAt(map, SIZE, 30, 31)).toEqual([0, 0, 0, 255])
    expect(pixelAt(map, SIZE, 30, 32)).toEqual([255, 0, 0, 255])
    const colours = new Set<string>()
    for (let i = 0; i < map.length; i += 4) colours.add(`${map[i]},${map[i + 1]},${map[i + 2]}`)
    const allowed = new Set(REGIONS.map((r) => r.rgb.join(',')))
    expect([...colours].every((c) => allowed.has(c))).toBe(true)
  })
})

describe('TGA files', () => {
  it('encode the exact skin as a game TGA that decodes to the same pixels', () => {
    const { psd, structure, outline } = open('ferrari')
    const exact = renderExact(psd, structure, { insertion: outline.defaultInsertion, visibility: {} }, userRaster(), decoder)
    const bytes = encodeTga24(exact.data, SIZE, SIZE)
    expect(bytes.length).toBe(tgaSize(SIZE, SIZE))
    expect(readTgaHeader(bytes)).toEqual({ width: SIZE, height: SIZE, bitsPerPixel: 24, topOrigin: false })
    expect(decodeTga(bytes).rgba).toEqual(exact.data)
  })
})

describe('template folder', () => {
  let folder: string
  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), 'lmu-templates-'))
    await writeTemplates(folder)
  })
  afterAll(() => rm(folder, { recursive: true, force: true }))

  it('scans the folder into categories and cars, and serves only catalogue files', async () => {
    const catalogue = await scanTemplates(folder)
    expect(catalogue.map((c) => [c.name, c.cars.map((car) => car.name)])).toEqual([
      ['Hypercar', ['Aston Martin Valkyrie', 'Lamborghini SC63']],
      ['LMGT3', ['Aston Martin Vantage', 'Ferrari 296 LMGT3']]
    ])
    const ferrari = TEMPLATES.ferrari.fileName
    expect(resolveTemplateUrl(templateUrl(ferrari), catalogue)).toBe(join(folder, ferrari))
    expect(resolveTemplateUrl(templateUrl('../secret.psd'), catalogue)).toBeNull()
  })
})
