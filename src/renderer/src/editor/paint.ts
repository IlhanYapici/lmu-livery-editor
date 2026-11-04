import type { Gradient, UserLayer } from './document'

// The Konva fill properties of a user layer: a solid colour or a gradient (ADR-0034). The editor canvas and
// the export (rasterize.ts) both use this function, so the preview and the TGA files get the same paint.

type Box = { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number }

/** Every Konva fill key, always present: react-konva must clear the gradient keys when a layer goes back to solid. */
export type PaintProps = {
  fill: string | undefined
  fillPriority: 'color' | 'linear-gradient' | 'radial-gradient'
  fillLinearGradientStartPoint: Point | undefined
  fillLinearGradientEndPoint: Point | undefined
  fillLinearGradientColorStops: (number | string)[] | undefined
  fillRadialGradientStartPoint: Point | undefined
  fillRadialGradientEndPoint: Point | undefined
  fillRadialGradientStartRadius: number | undefined
  fillRadialGradientEndRadius: number | undefined
  fillRadialGradientColorStops: (number | string)[] | undefined
}

const NO_GRADIENT = {
  fillLinearGradientStartPoint: undefined,
  fillLinearGradientEndPoint: undefined,
  fillLinearGradientColorStops: undefined,
  fillRadialGradientStartPoint: undefined,
  fillRadialGradientEndPoint: undefined,
  fillRadialGradientStartRadius: undefined,
  fillRadialGradientEndRadius: undefined,
  fillRadialGradientColorStops: undefined
}

/** The box of the gradient, in the layer's own coordinates (before its transform). */
export function layerBox(layer: UserLayer, width: number, height: number): Box {
  switch (layer.kind) {
    case 'fill':
      return { x: 0, y: 0, width, height }
    case 'polygon': {
      const xs = layer.points.filter((_, i) => i % 2 === 0)
      const ys = layer.points.filter((_, i) => i % 2 === 1)
      if (!xs.length) return { x: 0, y: 0, width: 0, height: 0 }
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
    }
    case 'rect':
    case 'image':
      return { x: 0, y: 0, width: layer.width, height: layer.height }
    case 'text':
      return { x: 0, y: 0, width: 0, height: 0 }
  }
}

/**
 * The start and end points of a linear gradient: through the centre of the box, long enough that the first
 * and the last stop touch the corners (the same rule as CSS linear-gradient).
 */
export function linearPoints(box: Box, angle: number): { start: Point; end: Point } {
  const rad = (angle * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const half = (Math.abs(box.width * dx) + Math.abs(box.height * dy)) / 2
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  return { start: { x: cx - dx * half, y: cy - dy * half }, end: { x: cx + dx * half, y: cy + dy * half } }
}

/** Konva colour stops: [offset, colour, offset, colour, …], sorted by offset. */
export function colorStops(gradient: Gradient): (number | string)[] {
  return [...gradient.stops]
    .sort((a, b) => a.offset - b.offset)
    .flatMap((s) => [
      s.offset,
      `rgba(${parseInt(s.color.slice(1, 3), 16)}, ${parseInt(s.color.slice(3, 5), 16)}, ${parseInt(s.color.slice(5, 7), 16)}, ${s.alpha})`
    ])
}

/**
 * The fill of a layer. `solid` replaces the paint of the layer (the region colour in the region view and in
 * the region map, where a layer is one region over its whole shape).
 */
export function paintProps(layer: UserLayer, width: number, height: number, solid?: string): PaintProps {
  const gradient = 'gradient' in layer && solid === undefined ? layer.gradient : null
  if (!gradient) return { ...NO_GRADIENT, fill: solid ?? ('color' in layer ? layer.color : undefined), fillPriority: 'color' }
  const box = layerBox(layer, width, height)
  const stops = colorStops(gradient)
  if (gradient.type === 'linear') {
    const { start, end } = linearPoints(box, gradient.angle)
    return {
      ...NO_GRADIENT,
      fill: undefined,
      fillPriority: 'linear-gradient',
      fillLinearGradientStartPoint: start,
      fillLinearGradientEndPoint: end,
      fillLinearGradientColorStops: stops
    }
  }
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  return {
    ...NO_GRADIENT,
    fill: undefined,
    fillPriority: 'radial-gradient',
    fillRadialGradientStartPoint: centre,
    fillRadialGradientEndPoint: centre,
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: Math.hypot(box.width, box.height) / 2,
    fillRadialGradientColorStops: stops
  }
}
