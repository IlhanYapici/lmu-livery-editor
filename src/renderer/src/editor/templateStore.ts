import { createStore } from 'zustand/vanilla'
import { templateUrl } from '../../../shared/api'
import type { TemplateOutline, Visibility } from '../../../shared/psd/templateRender'
import type { LoadStage, WorkerRequest, WorkerResponse } from './templateMessages'

// State of the template shown in the editor. One store per opened template; it owns the worker.

export type TemplateState = {
  status: 'loading' | 'ready' | 'error'
  stage: LoadStage | null
  /** 0..1 while the file is read, else null. */
  fraction: number | null
  error: string | null
  outline: TemplateOutline | null
  guides: { wireframe: ImageBitmap | null; mask: ImageBitmap | null; regions: ImageBitmap } | null
  segments: { below: ImageBitmap; above: ImageBitmap; table: Uint8Array; fastIsExact: boolean; unsupported: Record<string, number> } | null
  /** True while the worker makes new segments (old ones stay on screen). */
  updating: boolean
  /** Number of template content layers below the user layers. */
  insertion: number
  visibility: Visibility
  timings: { loadMs: number | null; segmentsMs: number | null }

  setInsertion: (insertion: number) => void
  setVisible: (path: string, visible: boolean) => void
  dispose: () => void
}

const SEGMENTS_DELAY_MS = 250

export function createTemplateStore(fileName: string) {
  const worker = new Worker(new URL('./template.worker.ts', import.meta.url), { type: 'module' })
  const send = (request: WorkerRequest) => worker.postMessage(request)
  let lastRequest = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const store = createStore<TemplateState>()((set, get) => {
    const requestSegments = () => {
      clearTimeout(timer)
      set({ updating: true })
      timer = setTimeout(() => {
        const { insertion, visibility } = get()
        send({ type: 'segments', requestId: ++lastRequest, insertion, visibility })
      }, SEGMENTS_DELAY_MS)
    }

    return {
      status: 'loading',
      stage: 'reading',
      fraction: 0,
      error: null,
      outline: null,
      guides: null,
      segments: null,
      updating: false,
      insertion: 0,
      visibility: {},
      timings: { loadMs: null, segmentsMs: null },

      setInsertion: (insertion) => {
        const outline = get().outline
        if (!outline) return
        set({ insertion: Math.max(1, Math.min(outline.maxInsertion, insertion)) })
        requestSegments()
      },
      setVisible: (path, visible) => {
        set({ visibility: { ...get().visibility, [path]: visible } })
        requestSegments()
      },
      dispose: () => {
        clearTimeout(timer)
        worker.terminate()
        const { guides, segments } = get()
        for (const bitmap of [guides?.wireframe, guides?.mask, guides?.regions, segments?.below, segments?.above]) bitmap?.close()
      }
    }
  })

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data
    const state = store.getState()
    switch (message.type) {
      case 'progress':
        store.setState({ stage: message.stage, fraction: message.fraction })
        break
      case 'outline':
        store.setState({ outline: message.outline, insertion: message.outline.defaultInsertion })
        send({ type: 'segments', requestId: ++lastRequest, insertion: message.outline.defaultInsertion, visibility: {} })
        break
      case 'guides':
        store.setState({
          guides: { wireframe: message.wireframe, mask: message.mask, regions: message.regions },
          timings: { ...state.timings, loadMs: message.ms }
        })
        break
      case 'segments': {
        if (message.requestId !== lastRequest) {
          message.below.close()
          message.above.close()
          break
        }
        state.segments?.below.close()
        state.segments?.above.close()
        const { below, above, table, fastIsExact, unsupported } = message
        store.setState({
          status: 'ready',
          stage: null,
          fraction: null,
          updating: false,
          segments: { below, above, table, fastIsExact, unsupported },
          timings: { ...state.timings, segmentsMs: message.ms }
        })
        break
      }
      case 'error':
        store.setState({ status: 'error', error: message.message, updating: false })
        break
    }
  }
  worker.onerror = (event) => store.setState({ status: 'error', error: event.message || 'template worker failed' })

  send({ type: 'load', url: templateUrl(fileName) })
  return store
}

export type TemplateStore = ReturnType<typeof createTemplateStore>
