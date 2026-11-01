// Audits LMU livery templates: layer roles, PSD features, region map, and a comparison of our compositor
// with the composite image that Photoshop saved in the file.
//
// Build: npm run audit:build  (one CommonJS file, no dependencies)
// Run:   node out/audit/audit-templates.cjs <file.psd|folder>... [--json out.json] [--dump folder] [--no-compare]
// On a PC without Node, the packaged app can run it: set ELECTRON_RUN_AS_NODE=1 and run
//        "LMU Livery Editor.exe" audit-templates.cjs <folder>

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  getCompositeImageData,
  getLayerImageData,
  getLayerMaskImageData,
  initializeCanvas,
  readPsd,
  type Layer,
  type PixelData
} from 'ag-psd'
import { compositeLayers, type LayerDecoder, type Raster } from '../src/shared/psd/composite'
import { buildRegionMap, REGIONS } from '../src/shared/psd/regions'
import { classifyTemplate } from '../src/shared/psd/roles'

initializeCanvas(
  () => {
    throw new Error('canvas is not available')
  },
  (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as ImageData
)

const decoder: LayerDecoder = {
  pixels: (layer) => getLayerImageData(layer),
  mask: (layer) => (layer.mask ? getLayerMaskImageData(layer) : undefined)
}

type Diff = { meanAbs: number; over4: number; over16: number; over64: number; alphaMismatch: number }

/** Per-pixel max channel difference, on colours premultiplied by alpha. Values are fractions of all pixels. */
function compare(a: Raster, b: PixelData): Diff {
  const n = a.width * a.height
  const step = b.data.length / n
  let sum = 0
  let over4 = 0
  let over16 = 0
  let over64 = 0
  let alphaMismatch = 0
  for (let p = 0; p < n; p++) {
    const i = p * 4
    const j = p * step
    const aa = a.data[i + 3] / 255
    const ba = step === 4 ? b.data[j + 3] / 255 : 1
    if (Math.abs(aa - ba) > 0.05) alphaMismatch++
    let max = 0
    for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs(a.data[i + c] * aa - (b.data[j + c] as number) * ba))
    sum += max
    if (max > 4) over4++
    if (max > 16) over16++
    if (max > 64) over64++
  }
  const f = (v: number) => +(v / n).toFixed(5)
  return { meanAbs: +(sum / n).toFixed(3), over4: f(over4), over16: f(over16), over64: f(over64), alphaMismatch: f(alphaMismatch) }
}

/** Features used by any layer, visible or not. */
function scanFeatures(layers: Layer[], out = new Map<string, number>()): Map<string, number> {
  const add = (k: string) => out.set(k, (out.get(k) ?? 0) + 1)
  for (const layer of layers) {
    if (layer.blendMode && !['normal', 'pass through'].includes(layer.blendMode)) add(`blend:${layer.blendMode}`)
    if (layer.clipping) add('clipping')
    if (layer.mask && !layer.mask.disabled) add('mask')
    if (layer.vectorMask) add('vector-mask')
    if ((layer.fillOpacity ?? 1) < 1) add('fill-opacity')
    if (layer.adjustment) add(`adjustment:${layer.adjustment.type}`)
    if (layer.placedLayer) add('smart-object')
    if (layer.text) add('text')
    if (layer.effects && !layer.effects.disabled) {
      for (const [key, value] of Object.entries(layer.effects)) {
        if (key === 'disabled' || key === 'scale') continue
        for (const fx of Array.isArray(value) ? value : [value]) if (fx?.enabled) add(`effect:${key}`)
      }
    }
    if (layer.children) scanFeatures(layer.children, out)
  }
  return out
}

function allLayers(layers: Layer[], path: string[] = []): { layer: Layer; path: string[] }[] {
  return layers.flatMap((layer) => [{ layer, path }, ...allLayers(layer.children ?? [], [...path, layer.name ?? ''])])
}

function dump(dir: string, name: string, data: Uint8ClampedArray | Uint8Array | Uint16Array | Float32Array) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
}

function auditFile(file: string, options: { compare: boolean; dumpDir?: string }) {
  const start = performance.now()
  const psd = readPsd(readFileSync(file), { useRawData: true, useRawThumbnail: true, useImageData: true })
  const structure = classifyTemplate(psd)
  const { width, height } = psd

  const regionMap = buildRegionMap(structure.regions, decoder, width, height)
  const regionLayers = structure.regions.map((l) => ({ name: l.name, hidden: !!l.hidden, mask: !!l.mask }))

  const result: Record<string, unknown> = {
    file: basename(file),
    sizeMB: Math.round(statSync(file).size / 1048576),
    canvas: `${width}x${height}`,
    bits: psd.bitsPerChannel,
    colorMode: psd.colorMode,
    content: structure.content.map((l) => `${l.name}${l.hidden ? ' (hidden)' : ''}`),
    base: structure.base?.name ?? null,
    mask: structure.mask?.name ?? null,
    wireframe: structure.wireframe?.name ?? null,
    warnings: structure.warnings,
    regionLayers,
    regionPercent: Object.fromEntries(REGIONS.map((r, i) => [r.id, +((100 * regionMap.counts[i]) / (width * height)).toFixed(2)])),
    features: Object.fromEntries(scanFeatures(psd.children ?? [])),
    adjustments: allLayers(psd.children ?? [])
      .filter(({ layer }) => layer.adjustment)
      .map(({ layer, path }) => ({
        path: [...path, layer.name].join(' / '),
        hidden: !!layer.hidden,
        opacity: layer.opacity,
        adjustment: layer.adjustment
      })),
    topLayers: (psd.children ?? []).map((l) => ({
      name: l.name,
      group: !!l.children,
      hidden: !!l.hidden,
      blend: l.blendMode,
      opacity: l.opacity,
      bounds: [l.left, l.top, l.right, l.bottom],
      adjustment: l.adjustment
    }))
  }

  if (options.compare) {
    const reference = getCompositeImageData(psd)
    if (!reference) result.compare = 'no composite image in file'
    else {
      const ours = compositeLayers(psd.children ?? [], { width, height, decoder })
      result.compare = compare(ours.image, reference)
      result.unsupportedVisible = Object.fromEntries(ours.unsupported)
      if (options.dumpDir) {
        const stem = basename(file, '.psd')
        dump(options.dumpDir, `${stem}.ours.rgba`, ours.image.data)
        dump(options.dumpDir, `${stem}.photoshop.rgba`, reference.data)
        dump(options.dumpDir, `${stem}.regions.rgba`, regionMap.image.data)
      }
    }
  }

  result.seconds = +((performance.now() - start) / 1000).toFixed(1)
  result.peakRssMB = Math.round(process.resourceUsage().maxRSS / 1024)
  return result
}

function main() {
  const args = process.argv.slice(2)
  const option = (name: string) => {
    const i = args.indexOf(name)
    return i >= 0 ? args.splice(i, 2)[1] : undefined
  }
  const jsonFile = option('--json')
  const dumpDir = option('--dump')
  const noCompare = args.includes('--no-compare')
  const inputs = args.filter((a) => !a.startsWith('--'))
  if (inputs.length === 0) {
    console.error('Usage: audit-templates <file.psd|folder>... [--json out.json] [--dump folder] [--no-compare]')
    process.exit(2)
  }

  const files = inputs.flatMap((input) =>
    statSync(input).isDirectory()
      ? readdirSync(input)
          .filter((n) => n.toLowerCase().endsWith('.psd'))
          .sort()
          .map((n) => join(input, n))
      : [input]
  )

  const results = []
  for (const file of files) {
    try {
      const r = auditFile(file, { compare: !noCompare, dumpDir })
      results.push(r)
      const c = r.compare as Diff | string | undefined
      const cmp = typeof c === 'object' ? `diff mean=${c.meanAbs} >16=${(c.over16 * 100).toFixed(2)}%` : (c ?? '')
      console.log(
        `${String(r.file).padEnd(50)} ${String(r.seconds).padStart(5)}s ${cmp} base=${r.base} mask=${r.mask} wire=${r.wireframe} ${(r.warnings as string[]).join('; ')}`
      )
    } catch (e) {
      results.push({ file: basename(file), error: (e as Error).message })
      console.log(`${basename(file).padEnd(50)} ERROR ${(e as Error).message}`)
    }
    if (jsonFile) writeFileSync(jsonFile, JSON.stringify(results, null, 2))
  }
}

main()
