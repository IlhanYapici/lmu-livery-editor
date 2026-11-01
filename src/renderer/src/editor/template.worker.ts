/// <reference lib="webworker" />
import { getLayerImageData, getLayerMaskImageData, initializeCanvas, readPsd, type Psd } from 'ag-psd'
import type { LayerDecoder, Raster } from '../../../shared/psd/composite'
import { classifyTemplate, type TemplateStructure } from '../../../shared/psd/roles'
import { applyUserRegions } from '../../../shared/psd/regions'
import { outlineTemplate, renderExact, renderGuides, renderSegments } from '../../../shared/psd/templateRender'
import { encodeTga24 } from '../../../shared/tga'
import type { WorkerRequest, WorkerResponse } from './templateMessages'

// Reads one template and makes the canvas bitmaps (ADR-0008: raw read, one layer decoded at a time).

declare const self: DedicatedWorkerGlobalScope

// ag-psd cannot make image buffers in a worker by itself (no DOM canvas).
initializeCanvas(
  () => {
    throw new Error('canvas is not available in the template worker')
  },
  (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as ImageData
)

const decoder: LayerDecoder = {
  pixels: (layer) => getLayerImageData(layer),
  mask: (layer) => (layer.mask ? getLayerMaskImageData(layer) : undefined)
}

let psd: Psd | null = null
let structure: TemplateStructure | null = null
/** The template region map, kept for the export (64 MB). */
let templateRegions: Raster | null = null

const post = (message: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(message, transfer)

function bitmapPixels(bitmap: ImageBitmap): Uint8ClampedArray<ArrayBuffer> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')!
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return context.getImageData(0, 0, canvas.width, canvas.height).data
}

const toBitmap = (raster: Raster) => createImageBitmap(new ImageData(raster.data, raster.width, raster.height))

async function readAll(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`cannot read the template (${response.status})`)
  const total = Number(response.headers.get('Content-Length')) || 0
  // With a known size, write into one buffer: a 455 MB template must not exist twice in memory.
  let buffer = new Uint8Array(total)
  let received = 0
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (received + value.length > buffer.length) {
      const bigger = new Uint8Array(Math.max(buffer.length * 2, received + value.length))
      bigger.set(buffer.subarray(0, received))
      buffer = bigger
    }
    buffer.set(value, received)
    received += value.length
    post({ type: 'progress', stage: 'reading', fraction: total ? received / total : null })
  }
  return received === buffer.length ? buffer.buffer : buffer.slice(0, received).buffer
}

async function load(url: string) {
  const start = performance.now()
  const buffer = await readAll(url)
  post({ type: 'progress', stage: 'parsing', fraction: null })
  psd = readPsd(buffer, { useRawData: true, useRawThumbnail: true, useImageData: true, skipCompositeImageData: true })
  structure = classifyTemplate(psd)
  post({ type: 'outline', outline: outlineTemplate(psd, structure) })

  post({ type: 'progress', stage: 'guides', fraction: null })
  const guides = renderGuides(psd, structure, decoder)
  templateRegions = guides.regions
  const wireframe = guides.wireframe && (await toBitmap(guides.wireframe))
  const mask = guides.mask && (await toBitmap(guides.mask))
  const regions = await toBitmap(guides.regions)
  post(
    { type: 'guides', wireframe, mask, regions, ms: performance.now() - start },
    [wireframe, mask, regions].filter((b) => b !== null)
  )
}

async function segments(request: Extract<WorkerRequest, { type: 'segments' }>) {
  if (!psd || !structure) return
  const start = performance.now()
  post({ type: 'progress', stage: 'segments', fraction: null })
  const s = renderSegments(psd, structure, { insertion: request.insertion, visibility: request.visibility }, decoder)
  const below = await toBitmap(s.below)
  const above = await toBitmap(s.above)
  post(
    {
      type: 'segments',
      requestId: request.requestId,
      below,
      above,
      table: s.table,
      fastIsExact: s.fastIsExact,
      unsupported: s.unsupported,
      ms: performance.now() - start
    },
    [below, above]
  )
}

async function exact(request: Extract<WorkerRequest, { type: 'exact' }>) {
  if (!psd || !structure) return
  const start = performance.now()
  const { width, height } = request.user
  const user: Raster = { left: 0, top: 0, width, height, data: bitmapPixels(request.user) }
  const image = await toBitmap(renderExact(psd, structure, { insertion: request.insertion, visibility: request.visibility }, user, decoder))
  post({ type: 'exact', requestId: request.requestId, image, ms: performance.now() - start }, [image])
}

/**
 * The two game files. Skin: the exact compositor with the user layers. Region map: the template regions,
 * then the user region shapes where they cover at least half a pixel, snapped to the 5 region colours.
 */
async function exportFiles(request: Extract<WorkerRequest, { type: 'export' }>) {
  if (!psd || !structure || !templateRegions) return
  const start = performance.now()
  const { width, height } = psd
  post({ type: 'progress', stage: 'export-skin', fraction: null })
  const user: Raster = { left: 0, top: 0, width, height, data: bitmapPixels(request.user) }
  const skinImage = renderExact(psd, structure, { insertion: request.insertion, visibility: request.visibility }, user, decoder)
  const skin = encodeTga24(skinImage.data, width, height)

  post({ type: 'progress', stage: 'export-regions', fraction: null })
  const regions = applyUserRegions(templateRegions.data, bitmapPixels(request.userRegions))
  const region = encodeTga24(regions, width, height)
  post({ type: 'exported', skin: skin.buffer, region: region.buffer, ms: performance.now() - start }, [skin.buffer, region.buffer])
}

// Requests run one after the other, in order.
let queue = Promise.resolve()
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  queue = queue
    .then(() => {
      switch (request.type) {
        case 'load':
          return load(request.url)
        case 'segments':
          return segments(request)
        case 'exact':
          return exact(request)
        case 'export':
          return exportFiles(request)
      }
    })
    .catch((e: Error) => post({ type: 'error', message: e.message }))
}
