import type { Layer } from 'ag-psd'
import { compositeLayers, type LayerDecoder, type Raster } from './composite'

// The region map (customskin_region.tga) tells the game which material goes where.
// Names follow the livery showroom of the game.

export const REGION_IDS = ['base', 'carbon', 'option1', 'option2', 'stickers'] as const
export type RegionId = (typeof REGION_IDS)[number]

export const REGIONS: { id: RegionId; name: string; rgb: [number, number, number] }[] = [
  { id: 'base', name: 'Base', rgb: [0, 0, 0] },
  { id: 'carbon', name: 'Carbon', rgb: [255, 0, 0] },
  { id: 'option1', name: 'Option 1', rgb: [0, 255, 0] },
  { id: 'option2', name: 'Option 2', rgb: [0, 0, 255] },
  { id: 'stickers', name: 'Stickers', rgb: [255, 255, 255] }
]

export function nearestRegion(r: number, g: number, b: number): number {
  let best = 0
  let bestDistance = Infinity
  for (let i = 0; i < REGIONS.length; i++) {
    const [rr, rg, rb] = REGIONS[i].rgb
    const distance = (r - rr) ** 2 + (g - rg) ** 2 + (b - rb) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  return best
}

export type RegionMap = {
  image: Raster
  /** Pixel count per region, in REGIONS order. */
  counts: number[]
  unsupported: Map<string, number>
}

/**
 * Merges the template region layers (each one: a flat colour, shaped by its layer mask) and snaps every
 * pixel to the nearest region colour. Transparent pixels become Base. The region group is hidden in the
 * templates, so all region layers are drawn whatever their saved visibility.
 */
export function buildRegionMap(regions: Layer[], decoder: LayerDecoder, width: number, height: number): RegionMap {
  const { image, unsupported } = compositeLayers(regions, { width, height, decoder, isVisible: () => true })
  const counts = REGIONS.map(() => 0)
  const d = image.data
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255
    const region = nearestRegion(d[i] * a, d[i + 1] * a, d[i + 2] * a)
    counts[region]++
    const [r, g, b] = REGIONS[region].rgb
    d[i] = r
    d[i + 1] = g
    d[i + 2] = b
    d[i + 3] = 255
  }
  return { image, counts, unsupported }
}

/**
 * Draws the user region shapes over a copy of the template region map (ADR-0023): every shape pixel with
 * 50 % alpha or more takes the nearest region colour, so the file never has mixed colours. `shapes` are
 * non-premultiplied RGBA pixels (as getImageData gives them) of the same size.
 */
export function applyUserRegions(templateRegions: Uint8ClampedArray, shapes: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
  if (shapes.length !== templateRegions.length) throw new Error('applyUserRegions: sizes differ')
  const regions = new Uint8ClampedArray(templateRegions)
  for (let i = 0; i < shapes.length; i += 4) {
    if (shapes[i + 3] < 128) continue
    const [r, g, b] = REGIONS[nearestRegion(shapes[i], shapes[i + 1], shapes[i + 2])].rgb
    regions[i] = r
    regions[i + 1] = g
    regions[i + 2] = b
  }
  return regions
}
