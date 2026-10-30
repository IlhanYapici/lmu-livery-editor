import Konva from 'konva'
import { REGIONS } from '../../../shared/psd/regions'
import type { UserLayer } from './document'

// Draws user layers at template size on a hidden stage, independent of the editor camera.
// Used by the exact preview and by the export (ADR-0022, ADR-0023).

const REGION_RGB = Object.fromEntries(REGIONS.map((r) => [r.id, `rgb(${r.rgb.join(' ')})`]))

/** One Konva node for one user layer. The editor canvas draws the same shapes with react-konva. */
function layerNode(layer: UserLayer, width: number, height: number, color: string, opacity: number): Konva.Shape {
  const common = { ...layer.transform, opacity, listening: false }
  switch (layer.kind) {
    case 'fill':
      return new Konva.Rect({ ...common, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, width, height, fill: color })
    case 'rect':
      return new Konva.Rect({ ...common, width: layer.width, height: layer.height, cornerRadius: layer.cornerRadius, fill: color })
    case 'polygon':
      return new Konva.Line({ ...common, points: layer.points, closed: true, fill: color })
    case 'text':
      return new Konva.Text({
        ...common,
        text: layer.text,
        fontFamily: layer.fontFamily,
        fontSize: layer.fontSize,
        fill: color,
        stroke: layer.outline?.color,
        strokeWidth: layer.outline?.width ?? 0,
        fillAfterStrokeEnabled: true
      })
  }
}

async function draw(nodes: Konva.Shape[], width: number, height: number): Promise<ImageBitmap> {
  const stage = new Konva.Stage({ container: document.createElement('div'), width, height })
  const layer = new Konva.Layer({ listening: false })
  stage.add(layer)
  nodes.forEach((node) => layer.add(node))
  try {
    return await createImageBitmap(layer.toCanvas({ pixelRatio: 1 }))
  } finally {
    stage.destroy()
  }
}

/** The visible user layers with their colours and opacity, as they go into the skin. */
export function rasterizeSkin(layers: UserLayer[], width: number, height: number): Promise<ImageBitmap> {
  return draw(
    layers.filter((l) => l.visible).map((l) => layerNode(l, width, height, l.color, l.opacity)),
    width,
    height
  )
}

/**
 * The visible user layers in their region colour, at full opacity, for the region map. Base layers are left
 * out: they keep the template regions (ADR-0023).
 */
export function rasterizeRegions(layers: UserLayer[], width: number, height: number): Promise<ImageBitmap> {
  return draw(
    layers.filter((l) => l.visible && l.region !== 'base').map((l) => layerNode(l, width, height, REGION_RGB[l.region], 1)),
    width,
    height
  )
}
