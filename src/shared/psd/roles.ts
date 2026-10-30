import type { Layer, Psd } from 'ag-psd'

// Finds the guide layers of an LMU livery template. An audit of the 60 templates of the game showed
// one stable order (bottom to top): content layers, Levels adjustment, mask (optional), region group,
// wireframe. The names change a lot ("Wire", "UVW", "Body_UV", "Background", "Layer 0" for the
// wireframe; "Maks(Disable for export)" for the mask), so position comes first and names second.

export type TemplateStructure = {
  /** Layers painted into customskin.tga, bottom to top, with the adjustments in place. */
  content: Layer[]
  /** The bottom content layer (the base paint). It can be a group, e.g. "Car". */
  base?: Layer
  /** Shows the areas that are not on the car. Never exported. */
  mask?: Layer
  wireframe?: Layer
  /** The region layers (leaf layers), bottom to top. */
  regions: Layer[]
  /** Rules that used a guess instead of a name. */
  warnings: string[]
}

const isWireframeName = (name: string) => /wire|\buvw?\b|_uv\b/i.test(name)
const isMaskName = (name: string) => /^\s*ma(sk|ks)\b/i.test(name)
const isRegionGroupName = (name: string) => /^\s*regions?\s*$/i.test(name)
const isRegionLayerName = (name: string) => /^\s*region\s*\d+\s*$/i.test(name)
const isPixelLayer = (layer: Layer) => !layer.children && !layer.adjustment

export function classifyTemplate(psd: Psd): TemplateStructure {
  const layers = psd.children ?? []
  const structure: TemplateStructure = { content: [], regions: [], warnings: [] }
  const guides = new Set<Layer>()

  const regionGroupIndex = layers.findIndex((l) => l.children && isRegionGroupName(l.name ?? ''))
  if (regionGroupIndex >= 0) {
    structure.regions = layers[regionGroupIndex].children!.filter((l) => !l.children)
    guides.add(layers[regionGroupIndex])
  } else {
    structure.regions = layers.filter((l) => !l.children && isRegionLayerName(l.name ?? ''))
    structure.regions.forEach((l) => guides.add(l))
    if (structure.regions.length === 0) structure.warnings.push('no region layers')
  }

  // Wireframe: by name, else the top pixel layer above the region group.
  structure.wireframe = layers.find((l) => isPixelLayer(l) && isWireframeName(l.name ?? ''))
  if (!structure.wireframe && regionGroupIndex >= 0) {
    const top = layers[layers.length - 1]
    if (layers.length - 1 > regionGroupIndex && isPixelLayer(top)) {
      structure.wireframe = top
      structure.warnings.push(`wireframe guessed from position: "${top.name}"`)
    }
  }
  if (structure.wireframe) guides.add(structure.wireframe)
  else structure.warnings.push('no wireframe')

  // Mask: by name, else a pixel layer between the last adjustment and the region group.
  structure.mask = layers.find((l) => isPixelLayer(l) && isMaskName(l.name ?? ''))
  if (!structure.mask && regionGroupIndex >= 0) {
    const lastAdjustment = layers.findLastIndex((l, i) => i < regionGroupIndex && l.adjustment)
    const between = lastAdjustment >= 0 ? layers.slice(lastAdjustment + 1, regionGroupIndex).filter(isPixelLayer) : []
    if (between.length === 1) {
      structure.mask = between[0]
      structure.warnings.push(`mask guessed from position: "${between[0].name}"`)
    }
  }
  if (structure.mask) guides.add(structure.mask)

  structure.content = layers.filter((l) => !guides.has(l))
  structure.base = structure.content.find((l) => !l.adjustment)
  return structure
}
