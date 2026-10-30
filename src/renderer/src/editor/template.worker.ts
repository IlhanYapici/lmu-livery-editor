/// <reference lib="webworker" />
import { getLayerImageData, getLayerMaskImageData, initializeCanvas, readPsd, type Psd } from 'ag-psd'
import type { LayerDecoder, Raster } from '../../../shared/psd/composite'
import { classifyTemplate, type TemplateStructure } from '../../../shared/psd/roles'
import { outlineTemplate, renderExact, renderGuides, renderSegments } from '../../../shared/psd/templateRender'
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

const post = (message: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(message, transfer)

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
  const wireframe = guides.wireframe && (await toBitmap(guides.wireframe))
  const mask = guides.mask && (await toBitmap(guides.mask))
  const regions = await toBitmap(guides.regions)
  post({ type: 'guides', wireframe, mask, regions, ms: performance.now() - start }, [wireframe, mask, regions].filter((b) => b !== null))
}

async function segments(request: Extract<WorkerRequest, { type: 'segments' }>) {
  if (!psd || !structure) return
  const start = performance.now()
  post({ type: 'progress', stage: 'segments', fraction: null })
  const s = renderSegments(psd, structure, { insertion: request.insertion, visibility: request.visibility }, decoder)
  const below = await toBitmap(s.below)
  const above = await toBitmap(s.above)
  post(
    { type: 'segments', requestId: request.requestId, below, above, table: s.table, fastIsExact: s.fastIsExact, unsupported: s.unsupported, ms: performance.now() - start },
    [below, above]
  )
}

async function exact(request: Extract<WorkerRequest, { type: 'exact' }>) {
  if (!psd || !structure) return
  const start = performance.now()
  const { width, height } = request.user
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')!
  context.drawImage(request.user, 0, 0)
  request.user.close()
  const user: Raster = { left: 0, top: 0, width, height, data: context.getImageData(0, 0, width, height).data }
  const image = await toBitmap(renderExact(psd, structure, { insertion: request.insertion, visibility: request.visibility }, user, decoder))
  post({ type: 'exact', requestId: request.requestId, image, ms: performance.now() - start }, [image])
}

// Requests run one after the other, in order.
let queue = Promise.resolve()
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  queue = queue
    .then(() => (request.type === 'load' ? load(request.url) : request.type === 'segments' ? segments(request) : exact(request)))
    .catch((e: Error) => post({ type: 'error', message: e.message }))
}
