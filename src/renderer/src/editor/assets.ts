import { ASSET_TYPES, base64ToBytes, bytesToBase64, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, sha256Hex, type Asset, type AssetType } from '../../../shared/project'

// Imported images (ADR-0025): checks on import, a cache of decoded images, and region shapes.
// Images are drawn through <img> elements: for SVG, Chromium then runs no script and loads nothing.

export type ImportedImage = { id: string; asset: Asset }

export type ImportError = 'unsupportedType' | 'tooLarge' | 'tooManyPixels' | 'decodeFailed'

const EXTENSION_TYPES: Record<string, AssetType> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' }

/** The image type from the File type, else from the file name (Windows sometimes gives no type for SVG). */
export function imageType(file: { type: string; name: string }): AssetType | null {
  if ((ASSET_TYPES as readonly string[]).includes(file.type)) return file.type as AssetType
  return EXTENSION_TYPES[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? null
}

/**
 * The size of an SVG: its width and height attributes when they are plain numbers (or px), else its viewBox,
 * else 1024 × 1024. Do not use the browser size: Chromium gives 300 × 150 to an SVG without width and height.
 */
export function svgSize(text: string): { width: number; height: number } {
  const root = text.match(/<svg\b[^>]*>/i)?.[0] ?? ''
  const attribute = (name: string) => Number(root.match(new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)\\s*(px)?\\s*["']`, 'i'))?.[1] ?? 0)
  const [w, h] = [attribute('width'), attribute('height')]
  if (w > 0 && h > 0) return { width: Math.round(w), height: Math.round(h) }
  const viewBox = root.match(/viewBox\s*=\s*["']\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)[\s,]+([\d.e]+)/i)
  const width = viewBox ? Number(viewBox[1]) : 0
  const height = viewBox ? Number(viewBox[2]) : 0
  if (width > 0 && height > 0) return { width: Math.round(width), height: Math.round(height) }
  return { width: 1024, height: 1024 }
}

/** The display size at import: the natural size, with the larger side at most `max` template pixels. */
export function importSize(width: number, height: number, max = 2048): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * k), height: Math.round(height * k) }
}

/** Above this enlargement, a raster image can look blurred in game. */
export const UPSCALE_WARNING = 1.5

/** How much a layer enlarges its source image (the larger of the two axes). */
export function enlargement(layer: { width: number; height: number; transform: { scaleX: number; scaleY: number } }, asset: Asset): number {
  return Math.max((layer.width * Math.abs(layer.transform.scaleX)) / asset.width, (layer.height * Math.abs(layer.transform.scaleY)) / asset.height)
}

/** True for a raster image enlarged more than UPSCALE_WARNING times. SVG stays sharp at any size. */
export const isUpscaled = (layer: Parameters<typeof enlargement>[0], asset: Asset) =>
  asset.type !== 'image/svg+xml' && enlargement(layer, asset) > UPSCALE_WARNING

const objectUrls = new Map<string, string>()

/** A blob URL for an asset (kept for the session: assets never change). */
export function assetUrl(id: string, asset: Asset): string {
  let url = objectUrls.get(id)
  if (!url) {
    url = URL.createObjectURL(new Blob([base64ToBytes(asset.data) as Uint8Array<ArrayBuffer>], { type: asset.type }))
    objectUrls.set(id, url)
  }
  return url
}

async function decode(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
}

export async function importImageFile(file: File): Promise<ImportedImage | ImportError> {
  const type = imageType(file)
  if (!type) return 'unsupportedType'
  if (file.size > MAX_IMAGE_BYTES) return 'tooLarge'
  const bytes = new Uint8Array(await file.arrayBuffer())
  const id = await sha256Hex(bytes)
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  try {
    const image = await decode(url)
    const { width, height } = type === 'image/svg+xml' ? svgSize(await file.text()) : { width: image.naturalWidth, height: image.naturalHeight }
    if (width > MAX_IMAGE_PIXELS || height > MAX_IMAGE_PIXELS) return 'tooManyPixels'
    if (!objectUrls.has(id)) objectUrls.set(id, url)
    return { id, asset: { type, data: bytesToBase64(bytes), width, height } }
  } catch {
    URL.revokeObjectURL(url)
    return 'decodeFailed'
  }
}

const images = new Map<string, Promise<HTMLImageElement>>()

/** The decoded image of an asset, cached for the session. */
export function loadAssetImage(id: string, asset: Asset): Promise<HTMLImageElement> {
  let image = images.get(id)
  if (!image) {
    image = decode(assetUrl(id, asset))
    images.set(id, image)
  }
  return image
}

const regionShapes = new Map<string, HTMLCanvasElement>()

/**
 * The shape of an image in one colour: pixels with 50 % alpha or more become `rgb`, the others transparent,
 * so the region map gets hard edges and pure region colours (ADR-0023).
 */
export function regionShape(id: string, image: HTMLImageElement, rgb: [number, number, number]): HTMLCanvasElement {
  const key = `${id}:${rgb.join(',')}`
  let canvas = regionShapes.get(key)
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth || 1024
    canvas.height = image.naturalHeight || 1024
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    const d = pixels.data
    for (let i = 0; i < d.length; i += 4) {
      const on = d[i + 3] >= 128
      d[i] = rgb[0]
      d[i + 1] = rgb[1]
      d[i + 2] = rgb[2]
      d[i + 3] = on ? 255 : 0
    }
    context.putImageData(pixels, 0, 0)
    regionShapes.set(key, canvas)
  }
  return canvas
}
