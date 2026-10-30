import { createStore } from 'zustand/vanilla'
import { createLayer, emptyDocument, newId, type LayerKind, type LiveryDocument, type UserLayer } from './document'

// The document with an undo history. Each action is one step. A gesture (drag, transform, colour drag)
// is one step too: beginGesture() keeps the start state, and endGesture() saves it once.

export const HISTORY_LIMIT = 100

export type DocumentState = {
  doc: LiveryDocument
  /** The document as it is in the project file. The project has unsaved changes when doc !== savedDoc. */
  savedDoc: LiveryDocument
  /** The project file (an opaque handle from the main process), or null before the first save. */
  handle: string | null
  fileName: string | null
  selectedId: string | null
  past: LiveryDocument[]
  future: LiveryDocument[]
  /** The document at the start of the current gesture, or null. */
  gestureStart: LiveryDocument | null

  select: (id: string | null) => void
  /** Adds a layer at `index` (default: on top) and selects it. */
  addLayer: (kind: LayerKind, props?: Partial<UserLayer>, index?: number) => string
  /** Inside a gesture, changes do not make history steps. */
  updateLayer: (id: string, patch: Partial<UserLayer>) => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  /** Moves a layer to a new index (0 = bottom). */
  moveLayer: (id: string, index: number) => void
  setInsertion: (insertion: number) => void
  setTemplateVisible: (path: string, visible: boolean) => void
  beginGesture: () => void
  endGesture: () => void
  undo: () => void
  redo: () => void
  /** Records that `doc` is now in the file `handle`. */
  markSaved: (doc: LiveryDocument, handle: string, fileName: string) => void
}

export type InitialProject = { doc: LiveryDocument; handle: string; fileName: string }

/** True when the document differs from the saved one. Undo back to the saved state makes it false again. */
export const hasUnsavedChanges = (state: Pick<DocumentState, 'doc' | 'savedDoc'>) => state.doc !== state.savedDoc

export function createDocumentStore(templateId: string, initial?: InitialProject) {
  const startDoc = initial?.doc ?? emptyDocument(templateId)
  return createStore<DocumentState>()((set, get) => {
    /** Applies a change to the document and records the old document as one history step. */
    const commit = (change: (doc: LiveryDocument) => LiveryDocument, selectedId = get().selectedId) => {
      const { doc, past, gestureStart } = get()
      const next = change(doc)
      if (next === doc) return
      if (gestureStart) {
        set({ doc: next, selectedId })
        return
      }
      set({ doc: next, selectedId, past: [...past, doc].slice(-HISTORY_LIMIT), future: [] })
    }
    const mapLayers = (doc: LiveryDocument, fn: (layers: UserLayer[]) => UserLayer[]) => ({ ...doc, layers: fn(doc.layers) })

    return {
      doc: startDoc,
      savedDoc: startDoc,
      handle: initial?.handle ?? null,
      fileName: initial?.fileName ?? null,
      selectedId: null,
      past: [],
      future: [],
      gestureStart: null,

      select: (id) => set({ selectedId: id }),

      addLayer: (kind, props, index) => {
        const layer = createLayer(kind, get().doc.layers, props)
        commit((doc) => mapLayers(doc, (layers) => {
          const at = index ?? layers.length
          return [...layers.slice(0, at), layer, ...layers.slice(at)]
        }), layer.id)
        return layer.id
      },

      updateLayer: (id, patch) =>
        commit((doc) => mapLayers(doc, (layers) => layers.map((l) => (l.id === id ? ({ ...l, ...patch } as UserLayer) : l)))),

      removeLayer: (id) =>
        commit(
          (doc) => mapLayers(doc, (layers) => layers.filter((l) => l.id !== id)),
          get().selectedId === id ? null : get().selectedId
        ),

      duplicateLayer: (id) => {
        const layers = get().doc.layers
        const index = layers.findIndex((l) => l.id === id)
        if (index < 0) return
        const source = layers[index]
        const copy: UserLayer = {
          ...structuredClone(source),
          id: newId(),
          name: `${source.name} copy`,
          transform: { ...source.transform, x: source.transform.x + 40, y: source.transform.y + 40 }
        }
        commit((doc) => mapLayers(doc, (all) => [...all.slice(0, index + 1), copy, ...all.slice(index + 1)]), copy.id)
      },

      moveLayer: (id, index) =>
        commit((doc) =>
          mapLayers(doc, (layers) => {
            const from = layers.findIndex((l) => l.id === id)
            const to = Math.max(0, Math.min(layers.length - 1, index))
            if (from < 0 || from === to) return layers
            const next = layers.filter((l) => l.id !== id)
            next.splice(to, 0, layers[from])
            return next
          })
        ),

      setInsertion: (insertion) => commit((doc) => (doc.insertion === insertion ? doc : { ...doc, insertion })),

      setTemplateVisible: (path, visible) =>
        commit((doc) => ({ ...doc, templateVisibility: { ...doc.templateVisibility, [path]: visible } })),

      beginGesture: () => {
        if (!get().gestureStart) set({ gestureStart: get().doc })
      },

      endGesture: () => {
        const { gestureStart, doc, past } = get()
        if (!gestureStart) return
        if (gestureStart === doc) set({ gestureStart: null })
        else set({ gestureStart: null, past: [...past, gestureStart].slice(-HISTORY_LIMIT), future: [] })
      },

      undo: () => {
        const { past, future, doc, selectedId } = get()
        if (!past.length) return
        const previous = past[past.length - 1]
        set({
          doc: previous,
          past: past.slice(0, -1),
          future: [doc, ...future],
          selectedId: previous.layers.some((l) => l.id === selectedId) ? selectedId : null
        })
      },

      markSaved: (doc, handle, fileName) => set({ savedDoc: doc, handle, fileName }),

      redo: () => {
        const { past, future, doc, selectedId } = get()
        if (!future.length) return
        const next = future[0]
        set({
          doc: next,
          past: [...past, doc],
          future: future.slice(1),
          selectedId: next.layers.some((l) => l.id === selectedId) ? selectedId : null
        })
      }
    }
  })
}

export type DocumentStore = ReturnType<typeof createDocumentStore>
