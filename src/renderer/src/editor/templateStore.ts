import { createStore } from 'zustand/vanilla'
import { templateUrl } from '../../../shared/api'
import type { TemplateOutline, Visibility } from '../../../shared/psd/templateRender'
import type { LoadStage, WorkerRequest, WorkerResponse } from './templateMessages'

// State of the template shown in the editor. One store per opened template; it owns the worker.
// The insertion point and the visibility belong to the document; the editor passes them to render().

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
  /** Exact image with the user layers (only when the fast preview is not exact); null after any edit. */
  exact: ImageBitmap | null
  exactPending: boolean
  timings: { loadMs: number | null; segmentsMs: number | null; exactMs: number | null }

  /** Draws the template segments for this insertion point and visibility (debounced). */
  render: (insertion: number, visibility: Visibility) => void
  /** Asks for the exact image. `user` is the user layers at template size; the store takes ownership. */
  requestExact: (user: ImageBitmap, insertion: number, visibility: Visibility) => void
  /** Drops the exact image (an edit made it old). */
  clearExact: () => void
  dispose: () => void
}

const SEGMENTS_DELAY_MS = 250

export function createTemplateStore(fileName: string) {
  const worker = new Worker(new URL('./template.worker.ts', import.meta.url), { type: 'module' })
  const send = (request: WorkerRequest, transfer: Transferable[] = []) => worker.postMessage(request, transfer)
  let lastSegments = 0
  let lastExact = 0
  let rendered: string | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const store = createStore<TemplateState>()((set, get) => ({
    status: 'loading',
    stage: 'reading',
    fraction: 0,
    error: null,
    outline: null,
    guides: null,
    segments: null,
    updating: false,
    exact: null,
    exactPending: false,
    timings: { loadMs: null, segmentsMs: null, exactMs: null },

    render: (insertion, visibility) => {
      const key = JSON.stringify([insertion, visibility])
      if (key === rendered) return
      rendered = key
      clearTimeout(timer)
      set({ updating: true })
      // The first drawing starts at once; later ones wait for the user to stop clicking.
      const delay = get().segments ? SEGMENTS_DELAY_MS : 0
      timer = setTimeout(() => send({ type: 'segments', requestId: ++lastSegments, insertion, visibility }), delay)
    },

    requestExact: (user, insertion, visibility) => {
      set({ exactPending: true })
      send({ type: 'exact', requestId: ++lastExact, insertion, visibility, user }, [user])
    },

    clearExact: () => {
      lastExact++
      get().exact?.close()
      if (get().exact || get().exactPending) set({ exact: null, exactPending: false })
    },

    dispose: () => {
      clearTimeout(timer)
      worker.terminate()
      const { guides, segments, exact } = get()
      for (const bitmap of [guides?.wireframe, guides?.mask, guides?.regions, segments?.below, segments?.above, exact]) bitmap?.close()
    }
  }))

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data
    const state = store.getState()
    switch (message.type) {
      case 'progress':
        store.setState({ stage: message.stage, fraction: message.fraction })
        break
      case 'outline':
        store.setState({ outline: message.outline })
        break
      case 'guides':
        store.setState({
          guides: { wireframe: message.wireframe, mask: message.mask, regions: message.regions },
          timings: { ...state.timings, loadMs: message.ms }
        })
        break
      case 'segments': {
        if (message.requestId !== lastSegments) {
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
      case 'exact':
        if (message.requestId !== lastExact) {
          message.image.close()
          break
        }
        state.exact?.close()
        store.setState({ exact: message.image, exactPending: false, timings: { ...state.timings, exactMs: message.ms } })
        break
      case 'error':
        store.setState({ status: 'error', error: message.message, updating: false, exactPending: false })
        break
    }
  }
  worker.onerror = (event) => store.setState({ status: 'error', error: event.message || 'template worker failed' })

  send({ type: 'load', url: templateUrl(fileName) })
  return store
}

export type TemplateStore = ReturnType<typeof createTemplateStore>
