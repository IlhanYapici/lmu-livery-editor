import { getLayerImageData, getLayerMaskImageData, initializeCanvas, readPsd, type Layer, type Psd } from 'ag-psd'
import type { LayerDecoder } from '../src/shared/psd/composite'

// ag-psd needs an image buffer factory in Node.js (ADR-0008); without it, layer decoding fails silently.
initializeCanvas(
  () => {
    throw new Error('canvas is not available in tests')
  },
  (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as ImageData
)

/** The same decoder as the template worker. */
export const decoder: LayerDecoder = {
  pixels: (layer: Layer) => getLayerImageData(layer),
  mask: (layer: Layer) => (layer.mask ? getLayerMaskImageData(layer) : undefined)
}

/** Reads a template the way the app does (raw, one layer decoded at a time). */
export const readTemplate = (bytes: Uint8Array): Psd =>
  readPsd(bytes, { useRawData: true, useRawThumbnail: true, useImageData: true, skipCompositeImageData: true })

/** RGBA of pixel (x, y) in a width-wide buffer. */
export const pixelAt = (data: ArrayLike<number>, width: number, x: number, y: number) =>
  Array.from({ length: 4 }, (_, c) => data[(y * width + x) * 4 + c])
