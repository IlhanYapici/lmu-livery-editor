import Konva from 'konva'
import { REGIONS } from '../../../shared/psd/regions'
import { loadAssetImage, regionShape } from './assets'
import type { LiveryDocument, UserLayer } from './document'

// Draws user layers at template size on a hidden stage, independent of the editor camera.
// Used by the exact preview and by the export (ADR-0022, ADR-0023).

const REGION_RGB = Object.fromEntries(REGIONS.map((r) => [r.id, `rgb(${r.rgb.join(' ')})`]))
const REGION_TRIPLET = Object.fromEntries(REGIONS.map((r) => [r.id, r.rgb]))

type Images = Record<string, HTMLImageElement>

/** Decodes the images that the layers use (cached for the session). */
async function loadImages(layers: UserLayer[], assets: LiveryDocument['assets']): Promise<Images> {
  const ids = [...new Set(layers.flatMap((l) => (l.kind === 'image' ? [l.assetId] : [])))]
  const images = await Promise.all(ids.map((id) => loadAssetImage(id, assets[id])))
  return Object.fromEntries(ids.map((id, i) => [id, images[i]]))
}

/** One Konva node for one user layer. The editor canvas draws the same shapes with react-konva. */
function layerNode(
  layer: UserLayer,
  width: number,
  height: number,
  color: string,
  opacity: number,
  image?: CanvasImageSource
): Konva.Shape | null {
  const common = { ...layer.transform, opacity, listening: false }
  switch (layer.kind) {
    case 'fill':
      return new Konva.Rect({ ...common, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, width, height, fill: color })
    case 'rect':
      return new Konva.Rect({ ...common, width: layer.width, height: layer.height, cornerRadius: layer.cornerRadius, fill: color })
    case 'polygon':
      return new Konva.Line({ ...common, points: layer.points, closed: true, fill: color })
    case 'image':
      return image ? new Konva.Image({ ...common, image, width: layer.width, height: layer.height }) : null
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

async function draw(nodes: (Konva.Shape | null)[], width: number, height: number): Promise<ImageBitmap> {
  const stage = new Konva.Stage({ container: document.createElement('div'), width, height })
  const layer = new Konva.Layer({ listening: false })
  stage.add(layer)
  nodes.forEach((node) => node && layer.add(node))
  try {
    return await createImageBitmap(layer.toCanvas({ pixelRatio: 1 }))
  } finally {
    stage.destroy()
  }
}

/** The visible user layers with their colours and opacity, as they go into the skin. */
export async function rasterizeSkin(
  layers: UserLayer[],
  assets: LiveryDocument['assets'],
  width: number,
  height: number
): Promise<ImageBitmap> {
  const images = await loadImages(layers, assets)
  return draw(
    layers
      .filter((l) => l.visible)
      .map((l) => layerNode(l, width, height, 'color' in l ? l.color : '', l.opacity, l.kind === 'image' ? images[l.assetId] : undefined)),
    width,
    height
  )
}

/**
 * The visible user layers in their region colour, at full opacity, for the region map. Base layers are left
 * out: they keep the template regions (ADR-0023).
 */
export async function rasterizeRegions(
  layers: UserLayer[],
  assets: LiveryDocument['assets'],
  width: number,
  height: number
): Promise<ImageBitmap> {
  const images = await loadImages(layers, assets)
  return draw(
    layers
      .filter((l) => l.visible && l.region !== 'base')
      .map((l) =>
        layerNode(
          l,
          width,
          height,
          REGION_RGB[l.region],
          1,
          l.kind === 'image' ? regionShape(l.assetId, images[l.assetId], REGION_TRIPLET[l.region]) : undefined
        )
      ),
    width,
    height
  )
}
