import { Tabs, Toggle, ToggleGroup, Tooltip } from 'radix-ui'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useStore } from 'zustand'
import type { Car, Category, TemplateVariant } from '../../../shared/api'
import { serializeProject } from '../../../shared/project'
import { REGIONS } from '../../../shared/psd/regions'
import { Button } from '../components/Button'
import { ClassBadge } from '../components/ClassBadge'
import { createDocumentStore, hasUnsavedChanges, type DocumentStore, type InitialProject } from '../editor/documentStore'
import { EditorCanvas, type CanvasApi, type CanvasView, type GuideOptions, type Tool } from '../editor/EditorCanvas'
import { LayersPanel } from '../editor/LayersPanel'
import { PropertiesPanel } from '../editor/PropertiesPanel'
import { TemplatePanel } from '../editor/TemplatePanel'
import { createTemplateStore, type TemplateStore } from '../editor/templateStore'
import { Toolbar } from '../editor/Toolbar'
import styles from './EditorScreen.module.css'

/** Lets the app ask the editor about unsaved changes before it leaves the editor. */
export type EditorGuard = { hasUnsavedChanges: () => boolean; save: () => Promise<boolean> }

type Props = {
  category: Category
  car: Car
  variant: TemplateVariant
  /** An opened project, or null for a new livery. */
  project: InitialProject | null
  /** The template file changed since the project was saved (a game update). */
  templateChanged: boolean
  guardRef: RefObject<EditorGuard | null>
  onTitle: (title: string) => void
  onError: (lines: string[]) => void
}

const rgb = ([r, g, b]: number[]) => `rgb(${r} ${g} ${b})`

const STAGE_TEXT = { reading: 'Reading the template', parsing: 'Reading the layers', guides: 'Drawing the guides', segments: 'Drawing the template' }

/** Delay after the last edit before the exact preview starts (only for templates where the fast one is not exact). */
const EXACT_DELAY_MS = 600

const TOOL_KEYS: Record<string, Tool> = { v: 'select', r: 'rect', p: 'polygon', t: 'text' }

const seconds = (ms: number | null) => (ms === null ? '…' : `${(ms / 1000).toFixed(1)} s`)

/** Editor in the style of the game livery showroom. */
export function EditorScreen(props: Props) {
  const [stores, setStores] = useState<{ template: TemplateStore; document: DocumentStore } | null>(null)

  useEffect(() => {
    const template = createTemplateStore(props.variant.id)
    setStores({ template, document: createDocumentStore(props.variant.id, props.project ?? undefined) })
    return () => template.getState().dispose()
  }, [props.variant.id])

  return stores ? <EditorBody {...props} templateStore={stores.template} documentStore={stores.document} /> : null
}

function EditorBody({ category, car, variant, templateChanged, guardRef, onTitle, onError, templateStore, documentStore }: Props & { templateStore: TemplateStore; documentStore: DocumentStore }) {
  const t = useStore(templateStore)
  const d = useStore(documentStore)
  const [view, setView] = useState<CanvasView>('livery')
  const [guides, setGuides] = useState<GuideOptions>({ wireframe: true, mask: true })
  const [tool, setTool] = useState<Tool>('select')
  const [tab, setTab] = useState('layers')
  const [fitSignal, setFitSignal] = useState(0)
  const [zoom, setZoom] = useState(0)
  const canvasApi = useRef<CanvasApi | null>(null)
  const [showTemplateWarning, setShowTemplateWarning] = useState(templateChanged)
  /** Set when the user chose "Save" in the close dialog: the next close must not be blocked. */
  const allowClose = useRef(false)
  const dirty = hasUnsavedChanges(d)

  const insertion = d.doc.insertion ?? t.outline?.defaultInsertion ?? null
  const selected = d.doc.layers.find((l) => l.id === d.selectedId) ?? null

  // Draw the template segments for the insertion point and visibility of the document.
  useEffect(() => {
    if (insertion !== null) t.render(insertion, d.doc.templateVisibility)
  }, [insertion, d.doc.templateVisibility, t.render])

  // Exact preview: after the edits stop, only when the fast preview is not exact (ADR-0018).
  useEffect(() => {
    t.clearExact()
    if (!t.segments || t.segments.fastIsExact || t.updating || insertion === null) return
    const timer = setTimeout(async () => {
      const user = await canvasApi.current?.rasterizeUser()
      if (user) t.requestExact(user, insertion, d.doc.templateVisibility)
    }, EXACT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [d.doc, d.selectedId, t.segments, t.updating, insertion])

  /** Saves the project. "Save as" (or the first save) asks for a file. Returns true when the file is written. */
  const save = useCallback(
    async (asNew: boolean) => {
      const { doc, handle, markSaved } = documentStore.getState()
      const result = await window.lmu.saveProject(serializeProject(doc, variant.sizeBytes), asNew ? null : handle, `${car.name} ${variant.label}`)
      if (result.status === 'saved') markSaved(doc, result.handle, result.fileName)
      if (result.status === 'error') onError([result.message])
      return result.status === 'saved'
    },
    [documentStore, variant, car.name, onError]
  )

  guardRef.current = { hasUnsavedChanges: () => hasUnsavedChanges(documentStore.getState()), save: () => save(false) }

  useEffect(() => onTitle(`${d.fileName ?? 'Untitled livery'}${dirty ? ' •' : ''}`), [d.fileName, dirty, onTitle])

  // Closing the window with unsaved changes: block the unload; the main process asks the user (ADR-0021).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowClose.current || !hasUnsavedChanges(documentStore.getState())) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    const unsubscribe = window.lmu.onSaveBeforeClose(async () => {
      if (await save(false)) {
        allowClose.current = true
        window.lmu.closeWindow()
      }
    })
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      unsubscribe()
    }
  }, [documentStore, save])

  const addFill = useCallback(() => {
    documentStore.getState().addLayer('fill', {}, 0)
    setTab('layers')
  }, [documentStore])

  // Keyboard shortcuts. Not while the user types in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        // Blur a field first, so that its value is committed before the save.
        e.preventDefault()
        ;(document.activeElement as HTMLElement | null)?.blur()
        setTimeout(() => void save(e.shiftKey), 0)
        return
      }
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="listbox"]')) return
      const s = documentStore.getState()
      const key = e.key.toLowerCase()
      if (e.ctrlKey && key === 'z' && !e.shiftKey) s.undo()
      else if (e.ctrlKey && (key === 'y' || (key === 'z' && e.shiftKey))) s.redo()
      else if (e.ctrlKey && key === 'd' && s.selectedId) s.duplicateLayer(s.selectedId)
      else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) s.removeLayer(s.selectedId)
      else if (e.key === 'Escape') {
        s.select(null)
        setTool('select')
      } else if (!e.ctrlKey && !e.altKey && TOOL_KEYS[key]) setTool(TOOL_KEYS[key])
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [documentStore, save])

  const previewText = !t.segments
    ? ''
    : t.segments.fastIsExact
      ? 'preview exact'
      : t.exact
        ? `exact preview (${seconds(t.timings.exactMs)})`
        : t.exactPending
          ? 'fast preview · exact preview in progress…'
          : 'fast preview (approximate)'

  return (
    <main className={styles.screen}>
      <section className={styles.heading}>
        <div className={styles.titleRow}>
          <h2 className={styles.carName}>{car.name}</h2>
          <ClassBadge categoryId={category.id} shortName={category.shortName} />
        </div>
        <p className={styles.variant}>{variant.label}</p>
      </section>

      <section className={styles.canvas} aria-label="Canvas">
        <EditorCanvas
          template={t}
          document={{ ...d, layers: d.doc.layers }}
          tool={tool}
          onToolDone={() => setTool('select')}
          view={view}
          guides={guides}
          fitSignal={fitSignal}
          onZoomChange={setZoom}
          apiRef={canvasApi}
        />
        {t.status === 'ready' && <Toolbar tool={tool} onTool={setTool} onAddFill={addFill} />}
        {t.status !== 'ready' && (
          <div className={styles.overlay}>
            {t.status === 'error' ? (
              <p className={styles.error}>Cannot open the template: {t.error}</p>
            ) : (
              <>
                <p>{t.stage ? STAGE_TEXT[t.stage] : 'Loading'}…</p>
                <div className={styles.progress}>
                  <div className={t.fraction === null ? styles.progressBusy : styles.progressBar} style={{ width: t.fraction === null ? undefined : `${t.fraction * 100}%` }} />
                </div>
              </>
            )}
          </div>
        )}
        {t.status === 'ready' && t.updating && <div className={styles.updating}>Updating the template…</div>}
        {showTemplateWarning && (
          <div className={styles.warning} role="alert">
            This template changed since the project was saved (probably a game update). Check the positions of your layers.
            <button className={styles.toolButton} onClick={() => setShowTemplateWarning(false)}>
              OK
            </button>
          </div>
        )}
        <div className={styles.canvasTools}>
          <button className={styles.toolButton} onClick={d.undo} disabled={!d.past.length} aria-label="Undo (Ctrl+Z)">
            ↶
          </button>
          <button className={styles.toolButton} onClick={d.redo} disabled={!d.future.length} aria-label="Redo (Ctrl+Y)">
            ↷
          </button>
          <span>{Math.round(zoom * 100)} %</span>
          <button className={styles.toolButton} onClick={() => setFitSignal(fitSignal + 1)}>
            Fit
          </button>
        </div>
      </section>

      <Tabs.Root className={styles.panel} value={tab} onValueChange={setTab}>
        <Tabs.List className={styles.tabs} aria-label="Editor panels">
          <Tabs.Trigger className={styles.tab} value="layers">
            Layers
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tab} value="template">
            Template
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tab} value="regions">
            Regions
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content className={styles.tabContent} value="layers">
          <LayersPanel layers={d.doc.layers} {...d} />
          {selected && (
            <PropertiesPanel
              key={selected.id}
              layer={selected}
              table={t.segments?.table ?? null}
              updateLayer={d.updateLayer}
              beginGesture={d.beginGesture}
              endGesture={d.endGesture}
            />
          )}
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="template">
          {t.outline && insertion !== null ? (
            <TemplatePanel
              content={t.outline.content}
              visibility={d.doc.templateVisibility}
              insertion={insertion}
              maxInsertion={t.outline.maxInsertion}
              onVisible={d.setTemplateVisible}
              onInsertion={(n) => d.setInsertion(Math.max(1, Math.min(t.outline!.maxInsertion, n)))}
            />
          ) : (
            <p className={styles.empty}>Loading…</p>
          )}
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="regions">
          <div className={styles.rowHead}>
            <span>Region</span>
            <span>Colour in the region map</span>
          </div>
          {REGIONS.map((r) => (
            <div key={r.id} className={styles.row}>
              <span className={styles.regionName}>
                <span className={styles.swatch} style={{ background: rgb(r.rgb) }} />
                {r.name}
              </span>
              <code>{rgb(r.rgb)}</code>
            </div>
          ))}
        </Tabs.Content>
      </Tabs.Root>

      <footer className={styles.bottom}>
        <span className={styles.bottomLabel}>View</span>
        <ToggleGroup.Root type="single" className={styles.segmented} value={view} onValueChange={(v) => v && setView(v as CanvasView)} aria-label="View">
          <ToggleGroup.Item className={styles.segment} value="livery">
            Livery
          </ToggleGroup.Item>
          <ToggleGroup.Item className={styles.segment} value="regions">
            Region map
          </ToggleGroup.Item>
        </ToggleGroup.Root>
        <span className={styles.bottomLabel}>Guides</span>
        <Toggle.Root className={styles.chip} pressed={guides.wireframe} onPressedChange={(wireframe) => setGuides({ ...guides, wireframe })}>
          Wireframe
        </Toggle.Root>
        <Toggle.Root className={styles.chip} pressed={guides.mask} onPressedChange={(mask) => setGuides({ ...guides, mask })}>
          Mask
        </Toggle.Root>
        <span className={styles.spacer} />
        <Button onClick={() => save(false)} title="Save (Ctrl+S)">
          Save
        </Button>
        <Button onClick={() => save(true)} title="Save as (Ctrl+Shift+S)">
          Save as
        </Button>
        <span className={styles.status}>
          {t.status === 'ready' && (
            <>
              Loaded in {seconds(t.timings.loadMs)} · template drawn in {seconds(t.timings.segmentsMs)} · {previewText}
            </>
          )}
        </span>
        <Tooltip.Provider delayDuration={200}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span tabIndex={0}>
                <Button variant="primary" size="large" disabled>
                  Export
                </Button>
              </span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={6}>
                The TGA export comes in Phase 4.
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </footer>
    </main>
  )
}
