import type { Layer, Psd } from 'ag-psd'
import { adjustmentTable, compositeLayers, type LayerDecoder, type Raster } from './composite'
import { buildRegionMap } from './regions'
import type { TemplateStructure } from './roles'

// Turns a template into the bitmaps of the editor canvas. The user layers go between two template
// segments: "below" (content layers under the insertion point) and "above" (content layers over it).
// The fast preview draws: below → user layers → above, then the per-channel adjustments of the "above"
// segment (Levels, Brightness) as a GPU table filter. `fastIsExact` tells when this equals the compositor.

/** Template layers shown in the Template panel. `path` is the index path in the PSD tree, e.g. "3/1". */
export type TemplateNode = {
  path: string
  name: string
  kind: 'group' | 'layer' | 'adjustment'
  hidden: boolean
  children: TemplateNode[]
}

export type TemplateOutline = {
  width: number
  height: number
  /** Top-level content layers, bottom to top. Children: sub-groups only. */
  content: TemplateNode[]
  /** Default number of content layers below the user layers. */
  defaultInsertion: number
  /** The user layers cannot go above the first Levels adjustment of the template. */
  maxInsertion: number
  warnings: string[]
}

export type Visibility = Record<string, boolean>

export type Segments = {
  below: Raster
  above: Raster
  /** Table applied to R, G and B after the user layers (identity if no adjustment). */
  table: Uint8Array
  /** True if below → user → above → table gives the same image as the exact compositor. */
  fastIsExact: boolean
  unsupported: Record<string, number>
}

export type Guides = { wireframe: Raster | null; mask: Raster | null; regions: Raster }

function layerPaths(layers: Layer[], prefix = '', out = new Map<Layer, string>()): Map<Layer, string> {
  layers.forEach((layer, i) => {
    const path = prefix ? `${prefix}/${i}` : String(i)
    out.set(layer, path)
    if (layer.children) layerPaths(layer.children, path, out)
  })
  return out
}

function node(layer: Layer, path: string, paths: Map<Layer, string>): TemplateNode {
  return {
    path,
    name: layer.name ?? '',
    kind: layer.adjustment ? 'adjustment' : layer.children ? 'group' : 'layer',
    hidden: !!layer.hidden,
    children: (layer.children ?? []).filter((c) => c.children).map((c) => node(c, paths.get(c)!, paths))
  }
}

export function outlineTemplate(psd: Psd, structure: TemplateStructure): TemplateOutline {
  const paths = layerPaths(psd.children ?? [])
  const content = structure.content
  const firstLevels = content.findIndex((l) => l.adjustment?.type === 'levels')
  const maxInsertion = firstLevels >= 0 ? firstLevels : content.length

  const lastCarbon = content.findLastIndex((l) => /carbon/i.test(l.name ?? ''))
  const base = structure.base ? content.indexOf(structure.base) : 0
  const defaultInsertion = Math.min(maxInsertion, Math.max(lastCarbon, base) + 1)

  return {
    width: psd.width,
    height: psd.height,
    content: content.map((l) => node(l, paths.get(l)!, paths)),
    defaultInsertion,
    maxInsertion,
    warnings: structure.warnings
  }
}

/** A mask with no area and a white default colour has no effect (all template Levels layers have one). */
const hasEffectiveMask = ({ mask }: Layer) =>
  !!mask && !mask.disabled && ((mask.defaultColor ?? 0) !== 255 || (mask.right ?? 0) > (mask.left ?? 0))

const isNormal = (l: Layer) => ['normal', 'pass through', undefined].includes(l.blendMode)

/** True if the layer or its children blend in another way than normal, or contain an adjustment. */
function needsBackdrop(layer: Layer, isVisible: (l: Layer) => boolean): boolean {
  if (!isVisible(layer)) return false
  if (!isNormal(layer) || layer.adjustment) return true
  return (layer.children ?? []).some((c) => needsBackdrop(c, isVisible))
}

export function renderSegments(
  psd: Psd,
  structure: TemplateStructure,
  options: { insertion: number; visibility: Visibility },
  decoder: LayerDecoder
): Segments {
  const paths = layerPaths(psd.children ?? [])
  const isVisible = (l: Layer) => options.visibility[paths.get(l) ?? ''] ?? !l.hidden
  const { width, height } = psd
  const below = structure.content.slice(0, options.insertion)
  const aboveAll = structure.content.slice(options.insertion)

  // Split the "above" segment: content layers into a bitmap, top-level per-channel adjustments into one table.
  const aboveContent: Layer[] = []
  const table = new Uint8Array(256).map((_, v) => v)
  let fastIsExact = true
  let adjustmentSeen = false
  for (const layer of aboveAll) {
    if (!isVisible(layer)) continue
    const layerTable = layer.adjustment ? adjustmentTable(layer) : null
    if (layer.adjustment) {
      adjustmentSeen = true
      const plain = !hasEffectiveMask(layer) && (layer.opacity ?? 1) === 1
      if (layerTable && plain) for (let v = 0; v < 256; v++) table[v] = layerTable[table[v]]
      else fastIsExact = false
      continue
    }
    // A content layer above an adjustment, or one that needs the real backdrop, makes the fast preview inexact.
    if (adjustmentSeen || needsBackdrop(layer, isVisible)) fastIsExact = false
    aboveContent.push(layer)
  }

  const belowResult = compositeLayers(below, { width, height, decoder, isVisible })
  const aboveResult = compositeLayers(aboveContent, { width, height, decoder, isVisible })
  const unsupported: Record<string, number> = {}
  for (const map of [belowResult.unsupported, aboveResult.unsupported])
    for (const [k, v] of map) unsupported[k] = (unsupported[k] ?? 0) + v

  return { below: belowResult.image, above: aboveResult.image, table, fastIsExact, unsupported }
}

/** Guides are drawn plain (normal blend, full opacity); the canvas chooses how to show them. */
export function renderGuides(psd: Psd, structure: TemplateStructure, decoder: LayerDecoder): Guides {
  const { width, height } = psd
  const plain = (layer: Layer | undefined) =>
    layer
      ? compositeLayers([{ ...layer, hidden: false, blendMode: 'normal', opacity: 1 }], { width, height, decoder }).image
      : null
  return {
    wireframe: plain(structure.wireframe),
    mask: plain(structure.mask),
    regions: buildRegionMap(structure.regions, decoder, width, height).image
  }
}

/**
 * The exact image with the user layers: their pixels go into the template stack at the insertion point as
 * one layer, and the compositor draws everything. Used when the fast preview is not exact (`fastIsExact`).
 */
export function renderExact(
  psd: Psd,
  structure: TemplateStructure,
  options: { insertion: number; visibility: Visibility },
  user: Raster,
  decoder: LayerDecoder
): Raster {
  const paths = layerPaths(psd.children ?? [])
  const userLayer: Layer = { name: 'User layers', left: user.left, top: user.top, right: user.left + user.width, bottom: user.top + user.height }
  const content = [...structure.content.slice(0, options.insertion), userLayer, ...structure.content.slice(options.insertion)]
  const withUser: LayerDecoder = {
    pixels: (l) => (l === userLayer ? { width: user.width, height: user.height, data: user.data } : decoder.pixels(l)),
    mask: (l) => decoder.mask(l)
  }
  const isVisible = (l: Layer) => l === userLayer || (options.visibility[paths.get(l) ?? ''] ?? !l.hidden)
  return compositeLayers(content, { width: psd.width, height: psd.height, decoder: withUser, isVisible }).image
}
