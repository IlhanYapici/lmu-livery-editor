import type { Layer, PixelData, Psd } from 'ag-psd'
import { describe, expect, it } from 'vitest'
import { compositeLayers, levelsTable, type LayerDecoder } from './composite'
import { buildRegionMap } from './regions'
import { classifyTemplate } from './roles'

const W = 4
const H = 2

/** A layer filled with one colour over the rectangle (left, top, width, height). */
function solid(name: string, rgba: number[], rect = { left: 0, top: 0, width: W, height: H }, extra: Partial<Layer> = {}): Layer {
  const data = new Uint8ClampedArray(rect.width * rect.height * 4)
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i)
  return {
    name,
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    imageData: { width: rect.width, height: rect.height, data },
    ...extra
  }
}

/** A mask over the full canvas: one grey value per pixel. */
function mask(values: number[], defaultColor = 0): Layer['mask'] {
  const data = new Uint8ClampedArray(W * H * 4)
  values.forEach((v, i) => data.set([v, v, v, 255], i * 4))
  return { left: 0, top: 0, right: W, bottom: H, defaultColor, imageData: { width: W, height: H, data } }
}

// The compositor changes decoded pixels in place, so return a copy like the real decoder does.
const decoder: LayerDecoder = {
  pixels: (l) => {
    const d = l.imageData as PixelData | undefined
    return d && { width: d.width, height: d.height, data: new Uint8ClampedArray(d.data as Uint8ClampedArray) }
  },
  mask: (l) => l.mask?.imageData as PixelData | undefined
}

const run = (layers: Layer[], isVisible?: (l: Layer) => boolean) =>
  compositeLayers(layers, { width: W, height: H, decoder, ...(isVisible ? { isVisible } : {}) })

const pixel = (data: Uint8ClampedArray, x: number, y = 0) => Array.from(data.slice((y * W + x) * 4, (y * W + x) * 4 + 4))

describe('compositeLayers', () => {
  it('draws layers bottom to top with opacity', () => {
    const { image } = run([solid('blue', [0, 0, 255, 255]), solid('red', [255, 0, 0, 255], undefined, { opacity: 0.5 })])
    expect(pixel(image.data, 0)).toEqual([128, 0, 128, 255])
  })

  it('keeps transparency where nothing is drawn', () => {
    const { image } = run([solid('dot', [255, 255, 255, 255], { left: 1, top: 0, width: 1, height: 1 })])
    expect(pixel(image.data, 0)).toEqual([0, 0, 0, 0])
    expect(pixel(image.data, 1)).toEqual([255, 255, 255, 255])
  })

  it('applies the screen blend mode', () => {
    const { image } = run([
      solid('grey', [128, 128, 128, 255]),
      solid('wire', [128, 0, 0, 255], undefined, { blendMode: 'screen' })
    ])
    expect(pixel(image.data, 0)).toEqual([192, 128, 128, 255])
  })

  it('uses the layer mask and its default colour outside the mask bounds', () => {
    const m = mask([255, 0, 128, 255, 255, 255, 255, 255])
    m!.right = 2 // mask covers x = 0..1 only; outside it is defaultColor = 0
    m!.imageData = { width: 2, height: 2, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 255]) }
    const { image } = run([solid('red', [255, 0, 0, 255], undefined, { mask: m })])
    expect(pixel(image.data, 0)[3]).toBe(255)
    expect(pixel(image.data, 1)[3]).toBe(0)
    expect(pixel(image.data, 2)[3]).toBe(0)
  })

  it('limits a clipped layer to the alpha of its base layer', () => {
    const { image } = run([
      solid('base', [0, 0, 0, 255], { left: 0, top: 0, width: 2, height: H }),
      solid('clip', [255, 255, 255, 255], undefined, { clipping: true })
    ])
    expect(pixel(image.data, 0)).toEqual([255, 255, 255, 255])
    expect(pixel(image.data, 3)).toEqual([0, 0, 0, 0])
  })

  it('applies the colour overlay effect', () => {
    const effects = { solidFill: [{ enabled: true, color: { r: 0, g: 200, b: 0 }, opacity: 1, blendMode: 'normal' as const }] }
    const { image } = run([solid('base', [10, 10, 10, 255], undefined, { effects })])
    expect(pixel(image.data, 0)).toEqual([0, 200, 0, 255])
  })

  it('applies a Levels adjustment to the layers below it', () => {
    const levels: Layer = {
      name: 'Levels 1',
      adjustment: {
        type: 'levels',
        channels: [{ shadowInput: 0, highlightInput: 255, shadowOutput: 10, highlightOutput: 225, midtoneInput: 1 }]
      }
    }
    const { image } = run([solid('white', [255, 255, 255, 255]), levels, solid('black', [0, 0, 0, 255], { left: 0, top: 0, width: 1, height: 1 })])
    expect(pixel(image.data, 1)).toEqual([225, 225, 225, 255])
    // The black layer is above the adjustment, so it keeps its value.
    expect(pixel(image.data, 0)).toEqual([0, 0, 0, 255])
  })

  it('skips hidden layers and draws hidden ones when isVisible says so', () => {
    const layers = [solid('red', [255, 0, 0, 255], undefined, { hidden: true })]
    expect(pixel(run(layers).image.data, 0)).toEqual([0, 0, 0, 0])
    expect(pixel(run(layers, () => true).image.data, 0)).toEqual([255, 0, 0, 255])
  })

  it('applies exclusion and lighter color', () => {
    const { image } = run([
      solid('grey', [128, 128, 128, 255]),
      solid('x', [255, 0, 0, 255], { left: 0, top: 0, width: 1, height: 1 }, { blendMode: 'exclusion' }),
      solid('y', [255, 255, 255, 255], { left: 1, top: 0, width: 1, height: 1 }, { blendMode: 'lighter color' }),
      solid('z', [0, 0, 0, 255], { left: 2, top: 0, width: 1, height: 1 }, { blendMode: 'lighter color' })
    ])
    expect(pixel(image.data, 0)).toEqual([127, 128, 128, 255])
    expect(pixel(image.data, 1)).toEqual([255, 255, 255, 255])
    expect(pixel(image.data, 2)).toEqual([128, 128, 128, 255])
  })

  it('applies hue/saturation (master) and brightness/contrast', () => {
    const hueSat: Layer = { name: 'h', adjustment: { type: 'hue/saturation', master: { hue: 0, saturation: -100, lightness: 0 } } }
    const { image } = run([solid('red', [255, 0, 0, 255]), hueSat])
    expect(pixel(image.data, 0)).toEqual([128, 128, 128, 255])

    const bc: Layer = { name: 'b', adjustment: { type: 'brightness/contrast', brightness: 100, contrast: 0 } }
    const { image: bright } = run([solid('grey', [128, 128, 128, 255]), bc])
    expect(pixel(bright.data, 0)).toEqual([192, 192, 192, 255])
  })

  it('records the features that it does not support', () => {
    const effects = { stroke: [{ enabled: true }] }
    const { unsupported } = run([
      solid('a', [0, 0, 0, 255], undefined, { blendMode: 'dissolve' }),
      solid('b', [0, 0, 0, 255], undefined, { effects })
    ])
    expect(Object.fromEntries(unsupported)).toEqual({ 'blend:dissolve': 1, 'effect:stroke': 1 })
  })
})

describe('levelsTable', () => {
  it('maps the input range to the output range', () => {
    const table = levelsTable({ shadowInput: 0, highlightInput: 255, shadowOutput: 10, highlightOutput: 225, midtoneInput: 1 })
    expect([table[0], table[128], table[255]]).toEqual([10, 118, 225])
  })
})

describe('buildRegionMap', () => {
  it('shapes each flat colour layer with its mask and snaps to region colours', () => {
    const regions = [
      solid('Region 0', [0, 0, 0, 255]),
      solid('Region 1', [255, 0, 0, 255], undefined, { mask: mask([255, 255, 0, 0, 0, 0, 0, 0]) }),
      solid('Region 2', [0, 0, 255, 255], undefined, { mask: mask([0, 0, 0, 0, 0, 0, 200, 0]) }),
      solid('Region 3', [255, 255, 255, 255], undefined, { hidden: true, mask: mask([0, 0, 0, 0, 0, 0, 0, 255]) })
    ]
    const { image, counts } = buildRegionMap(regions, decoder, W, H)
    expect(pixel(image.data, 0)).toEqual([255, 0, 0, 255])
    expect(pixel(image.data, 2, 1)).toEqual([0, 0, 255, 255])
    expect(pixel(image.data, 3, 1)).toEqual([255, 255, 255, 255])
    expect(counts).toEqual([4, 2, 0, 1, 1])
  })
})

describe('classifyTemplate', () => {
  const group = (name: string, children: Layer[], extra: Partial<Layer> = {}): Layer => ({ name, children, ...extra })
  const levels: Layer = { name: 'Levels 1', adjustment: { type: 'levels' } }
  const regions = group('Region', [{ name: 'Region 0' }, { name: 'Region 1' }], { hidden: true })
  const names = (layers: Layer[]) => layers.map((l) => l.name)
  const classify = (children: Layer[]) => classifyTemplate({ width: W, height: H, children })

  it('finds the guides by name (Ferrari 296 LMGT3 layout)', () => {
    const s = classify([
      { name: 'base' },
      group('carbon', [{ name: 'Shape 502' }]),
      group('Number Plates - Don\'t move!', []),
      levels,
      { name: 'Mask(Disable for export)' },
      regions,
      { name: 'Wireframe', blendMode: 'screen' }
    ])
    expect(names(s.content)).toEqual(['base', 'carbon', "Number Plates - Don't move!", 'Levels 1'])
    expect(s.base?.name).toBe('base')
    expect(s.mask?.name).toBe('Mask(Disable for export)')
    expect(s.wireframe?.name).toBe('Wireframe')
    expect(names(s.regions)).toEqual(['Region 0', 'Region 1'])
    expect(s.warnings).toEqual([])
  })

  it('accepts the name variants seen in the game templates', () => {
    for (const wire of ['UVW', 'Wire', 'WIRE', 'WireEVO', 'Body_UV']) {
      expect(classify([{ name: 'Base' }, levels, regions, { name: wire }]).wireframe?.name).toBe(wire)
    }
    const s = classify([{ name: 'Base' }, levels, { name: 'Maks(Disable for export)' }, group('Regions', [{ name: 'Region 0' }]), { name: 'UVW' }])
    expect(s.mask?.name).toBe('Maks(Disable for export)')
    expect(names(s.regions)).toEqual(['Region 0'])
  })

  it('guesses the wireframe and the mask from their position (Aston Martin Vantage, Ferrari 488 GTE)', () => {
    const s = classify([{ name: 'Base' }, { name: 'Albedo', adjustment: { type: 'levels' } }, { name: 'Color Fill 1' }, regions, { name: 'Background', blendMode: 'screen' }])
    expect(s.wireframe?.name).toBe('Background')
    expect(s.mask?.name).toBe('Color Fill 1')
    expect(names(s.content)).toEqual(['Base', 'Albedo'])
    expect(s.warnings).toHaveLength(2)
  })

  it('accepts templates without a mask (Aston Martin Valkyrie)', () => {
    const s = classify([{ name: 'Color Fill 2' }, group('Carbon', []), levels, regions, { name: 'UVW' }])
    expect(s.mask).toBeUndefined()
    expect(s.base?.name).toBe('Color Fill 2')
    expect(s.warnings).toEqual([])
  })
})
