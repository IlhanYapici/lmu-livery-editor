import { Tabs, Toggle, ToggleGroup } from 'radix-ui'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import type { Car, Category, TemplateVariant } from '../../../shared/api'
import { ASSET_TYPES, serializeProject } from '../../../shared/project'
import { REGIONS } from '../../../shared/psd/regions'
import { Button } from '../components/Button'
import { ClassBadge } from '../components/ClassBadge'
import { createDocumentStore, hasUnsavedChanges, type DocumentStore, type InitialProject } from '../editor/documentStore'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EditorCanvas, type CanvasView, type GuideOptions, type Tool } from '../editor/EditorCanvas'
import { importImageFile, importSize } from '../editor/assets'
import { rasterizeRegions, rasterizeSkin } from '../editor/rasterize'
import { LayersPanel } from '../editor/LayersPanel'
import { PropertiesPanel } from '../editor/PropertiesPanel'
import { TemplatePanel } from '../editor/TemplatePanel'
import { createTemplateStore, type TemplateStore } from '../editor/templateStore'
import { Toolbar } from '../editor/Toolbar'
import { formatSeconds } from '../i18n'
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

type ExportTarget = 'game' | 'folder'
type ExportReport = { title: string; lines: string[] }

/** Delay after the last edit before the exact preview starts (only for templates where the fast one is not exact). */
const EXACT_DELAY_MS = 600

const TOOL_KEYS: Record<string, Tool> = { v: 'select', r: 'rect', p: 'polygon', t: 'text' }

const seconds = (ms: number | null) => (ms === null ? '…' : formatSeconds(ms))

/** Editor in the style of the game livery showroom. */
export function EditorScreen(props: Props) {
  const [stores, setStores] = useState<{ template: TemplateStore; document: DocumentStore } | null>(null)

  // The template store starts a Worker (an external system), so it is made in an effect, not during render:
  // StrictMode runs effects twice and the cleanup ends the extra worker; during render it would leak one.
  // The app gives the editor a new key for each opened project, so `project` does not change during its life.
  useEffect(() => {
    const template = createTemplateStore(props.variant.id)
    // oxlint-disable-next-line react/set-state-in-effect -- the stores own the worker (see above)
    setStores({ template, document: createDocumentStore(props.variant.id, props.project ?? undefined) })
    return () => template.getState().dispose()
  }, [props.variant.id, props.project])

  return stores ? <EditorBody {...props} templateStore={stores.template} documentStore={stores.document} /> : null
}

function EditorBody({ category, car, variant, templateChanged, guardRef, onTitle, onError, templateStore, documentStore }: Props & { templateStore: TemplateStore; documentStore: DocumentStore }) {
  const { t } = useTranslation()
  const template = useStore(templateStore)
  const d = useStore(documentStore)
  const [view, setView] = useState<CanvasView>('livery')
  const [guides, setGuides] = useState<GuideOptions>({ wireframe: true, mask: true })
  const [tool, setTool] = useState<Tool>('select')
  const [tab, setTab] = useState('layers')
  const [fitSignal, setFitSignal] = useState(0)
  const [zoom, setZoom] = useState(0)
  const [confirmGameExport, setConfirmGameExport] = useState(false)
  const [writing, setWriting] = useState(false)
  const [report, setReport] = useState<ExportReport | null>(null)
  const [showTemplateWarning, setShowTemplateWarning] = useState(templateChanged)
  /** Set when the user chose "Save" in the close dialog: the next close must not be blocked. */
  const allowClose = useRef(false)
  const dirty = hasUnsavedChanges(d)

  const insertion = d.doc.insertion ?? template.outline?.defaultInsertion ?? null
  const selected = d.doc.layers.find((l) => l.id === d.selectedId) ?? null

  // Draw the template segments for the insertion point and visibility of the document.
  const { render: renderTemplate, clearExact, requestExact, segments, updating, outline } = template
  useEffect(() => {
    if (insertion !== null) renderTemplate(insertion, d.doc.templateVisibility)
  }, [insertion, d.doc.templateVisibility, renderTemplate])

  // Exact preview: after the edits stop, only when the fast preview is not exact (ADR-0018).
  // The selection is a dependency on purpose: selecting a layer drops the exact image, so the handles show.
  const { selectedId } = d
  useEffect(() => {
    clearExact()
    if (!segments || segments.fastIsExact || updating || insertion === null || !outline) return
    const { width, height } = outline
    const timer = setTimeout(async () => {
      requestExact(await rasterizeSkin(d.doc.layers, d.doc.assets, width, height), insertion, d.doc.templateVisibility)
    }, EXACT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [d.doc, selectedId, segments, updating, insertion, outline, clearExact, requestExact])

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

  useEffect(() => {
    guardRef.current = { hasUnsavedChanges: () => hasUnsavedChanges(documentStore.getState()), save: () => save(false) }
  }, [guardRef, documentStore, save])

  useEffect(() => onTitle(`${d.fileName ?? t('app.untitled')}${dirty ? ' •' : ''}`), [d.fileName, dirty, onTitle, t])

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

  /** Makes the two TGA files in the worker, then the main process writes them (ADR-0022). */
  const runExport = async (target: ExportTarget) => {
    if (!template.outline || insertion === null) return
    const { width, height } = template.outline
    const { doc } = documentStore.getState()
    try {
      const [user, userRegions] = await Promise.all([rasterizeSkin(doc.layers, doc.assets, width, height), rasterizeRegions(doc.layers, doc.assets, width, height)])
      const files = await template.exportFiles(user, userRegions, insertion, doc.templateVisibility)
      setWriting(true)
      const result = target === 'game' ? await window.lmu.exportToGame(files.skin, files.region) : await window.lmu.exportToFolder(files.skin, files.region)
      setWriting(false)
      if (result.status === 'cancelled') return
      if (result.status === 'error') return setReport({ title: t('export.failedTitle'), lines: [result.message] })
      setReport({
        title: t('export.doneTitle'),
        lines: [
          t('export.doneFiles', { folder: result.folder }),
          ...(result.backup ? [t('export.doneBackup', { folder: result.backup })] : []),
          ...(target === 'game' ? [t('export.doneReload', { car: car.name })] : [])
        ]
      })
    } catch (error) {
      setWriting(false)
      setReport({ title: t('export.failedTitle'), lines: [(error as Error).message] })
    }
  }

  const fileInput = useRef<HTMLInputElement>(null)
  const viewCenter = useRef<(() => { x: number; y: number }) | null>(null)

  /** Imports image files as image layers, centred on `at` (default: the centre of the visible area). */
  const importImages = useCallback(
    async (files: File[], at?: { x: number; y: number }) => {
      const point = at ?? viewCenter.current?.() ?? { x: 2048, y: 2048 }
      const errors: string[] = []
      for (const file of files) {
        const result = await importImageFile(file)
        if (typeof result === 'string') {
          errors.push(t(`images.error.${result}`, { file: file.name }))
          continue
        }
        const size = importSize(result.asset.width, result.asset.height)
        const name = file.name.replace(/\.[^.]+$/, '').slice(0, 200) || undefined
        documentStore.getState().addImage(result.id, result.asset, {
          ...size,
          ...(name ? { name } : {}),
          transform: { x: point.x - size.width / 2, y: point.y - size.height / 2, rotation: 0, scaleX: 1, scaleY: 1 }
        })
      }
      if (errors.length) setReport({ title: t('images.errorTitle'), lines: errors })
      if (files.length > errors.length) setTab('layers')
    },
    [documentStore, t]
  )

  // Paste an image (Ctrl+V), except while the user types in a field.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, [contenteditable="true"]')) return
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (!files.length) return
      e.preventDefault()
      void importImages(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [importImages])

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
      } else if (!e.ctrlKey && !e.altKey && key === 'i') fileInput.current?.click()
      else if (!e.ctrlKey && !e.altKey && TOOL_KEYS[key]) setTool(TOOL_KEYS[key])
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [documentStore, save])

  const previewText = !template.segments
    ? ''
    : template.segments.fastIsExact
      ? t('editor.preview.exact')
      : template.exact
        ? t('editor.preview.exactDone', { time: seconds(template.timings.exactMs) })
        : template.exactPending
          ? t('editor.preview.exactPending')
          : t('editor.preview.approximate')

  return (
    <main className={styles.screen}>
      <section className={styles.heading}>
        <div className={styles.titleRow}>
          <h2 className={styles.carName}>{car.name}</h2>
          <ClassBadge categoryId={category.id} shortName={category.shortName} />
        </div>
        <p className={styles.variant}>{variant.label}</p>
      </section>

      <section className={styles.canvas} aria-label={t('editor.canvas')}>
        <EditorCanvas
          template={template}
          document={{ ...d, layers: d.doc.layers, assets: d.doc.assets }}
          tool={tool}
          onToolDone={() => setTool('select')}
          view={view}
          guides={guides}
          fitSignal={fitSignal}
          onZoomChange={setZoom}
          onDropFiles={(files, at) => void importImages(files, at)}
          viewCenterRef={viewCenter}
        />
        <input
          ref={fileInput}
          type="file"
          accept={[...ASSET_TYPES, '.svg'].join(',')}
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) void importImages(files)
          }}
        />
        {template.status === 'ready' && <Toolbar tool={tool} onTool={setTool} onAddFill={addFill} onAddImage={() => fileInput.current?.click()} />}
        {template.status !== 'ready' && (
          <div className={styles.overlay}>
            {template.status === 'error' ? (
              <p className={styles.error}>{t('editor.cannotOpenTemplate', { error: template.error })}</p>
            ) : (
              <>
                <p>{t(`editor.stage.${template.stage ?? 'loading'}`)}…</p>
                <div className={styles.progress}>
                  <div className={template.fraction === null ? styles.progressBusy : styles.progressBar} style={{ width: template.fraction === null ? undefined : `${template.fraction * 100}%` }} />
                </div>
              </>
            )}
          </div>
        )}
        {(template.exporting || writing) && (
          <div className={styles.overlay}>
            <p>{t(`editor.stage.${writing ? 'writing' : (template.stage ?? 'loading')}`)}…</p>
            <div className={styles.progress}>
              <div className={styles.progressBusy} />
            </div>
          </div>
        )}
        {template.status === 'ready' && template.updating && <div className={styles.updating}>{t('editor.updating')}</div>}
        {showTemplateWarning && (
          <div className={styles.warning} role="alert">
            {t('editor.templateChanged')}
            <button className={styles.toolButton} onClick={() => setShowTemplateWarning(false)}>
              OK
            </button>
          </div>
        )}
        {template.status === 'ready' && (
          <div className={styles.status}>
            {t('editor.status', { load: seconds(template.timings.loadMs), draw: seconds(template.timings.segmentsMs), preview: previewText })}
          </div>
        )}
        <div className={styles.canvasTools}>
          <button className={styles.toolButton} onClick={d.undo} disabled={!d.past.length} aria-label={t('editor.undo')} title={t('editor.undo')}>
            ↶
          </button>
          <button className={styles.toolButton} onClick={d.redo} disabled={!d.future.length} aria-label={t('editor.redo')} title={t('editor.redo')}>
            ↷
          </button>
          <span>{Math.round(zoom * 100)} %</span>
          <button className={styles.toolButton} onClick={() => setFitSignal(fitSignal + 1)}>
            {t('editor.fit')}
          </button>
        </div>
      </section>

      <Tabs.Root className={styles.panel} value={tab} onValueChange={setTab}>
        <Tabs.List className={styles.tabs} aria-label={t('editor.tabs.label')}>
          <Tabs.Trigger className={styles.tab} value="layers">
            {t('editor.tabs.layers')}
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tab} value="template">
            {t('editor.tabs.template')}
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tab} value="regions">
            {t('editor.tabs.regions')}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content className={styles.tabContent} value="layers">
          <LayersPanel layers={d.doc.layers} assets={d.doc.assets} {...d} />
          {selected && (
            <PropertiesPanel
              key={selected.id}
              layer={selected}
              table={template.segments?.table ?? null}
              asset={selected.kind === 'image' ? d.doc.assets[selected.assetId] : undefined}
              updateLayer={d.updateLayer}
              beginGesture={d.beginGesture}
              endGesture={d.endGesture}
            />
          )}
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="template">
          {template.outline && insertion !== null ? (
            <TemplatePanel
              content={template.outline.content}
              visibility={d.doc.templateVisibility}
              insertion={insertion}
              maxInsertion={template.outline.maxInsertion}
              onVisible={d.setTemplateVisible}
              onInsertion={(n) => d.setInsertion(Math.max(1, Math.min(template.outline!.maxInsertion, n)))}
            />
          ) : (
            <p className={styles.empty}>{t('editor.loading')}</p>
          )}
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="regions">
          <div className={styles.rowHead}>
            <span>{t('editor.regionHead')}</span>
            <span>{t('editor.regionColourHead')}</span>
          </div>
          {REGIONS.map((r) => (
            <div key={r.id} className={styles.row}>
              <span className={styles.regionName}>
                <span className={styles.swatch} style={{ background: rgb(r.rgb) }} />
                {t(`regions.${r.id}`)}
              </span>
              <code>{rgb(r.rgb)}</code>
            </div>
          ))}
        </Tabs.Content>
      </Tabs.Root>

      <footer className={styles.bottom}>
        <span className={styles.bottomLabel}>{t('editor.view')}</span>
        <ToggleGroup.Root type="single" className={styles.segmented} value={view} onValueChange={(v) => v && setView(v as CanvasView)} aria-label={t('editor.view')}>
          <ToggleGroup.Item className={styles.segment} value="livery">
            {t('editor.viewLivery')}
          </ToggleGroup.Item>
          <ToggleGroup.Item className={styles.segment} value="regions">
            {t('editor.viewRegions')}
          </ToggleGroup.Item>
        </ToggleGroup.Root>
        <span className={styles.bottomLabel}>{t('editor.guides')}</span>
        <Toggle.Root className={styles.chip} pressed={guides.wireframe} onPressedChange={(wireframe) => setGuides({ ...guides, wireframe })}>
          {t('editor.wireframe')}
        </Toggle.Root>
        <Toggle.Root className={styles.chip} pressed={guides.mask} onPressedChange={(mask) => setGuides({ ...guides, mask })}>
          {t('editor.mask')}
        </Toggle.Root>
        <span className={styles.spacer} />
        <Button onClick={() => save(false)} title={t('editor.saveHint')}>
          {t('editor.save')}
        </Button>
        <Button onClick={() => save(true)} title={t('editor.saveAsHint')}>
          {t('editor.saveAs')}
        </Button>
        <Button onClick={() => runExport('folder')} disabled={template.status !== 'ready' || template.exporting || writing} title={t('editor.exportToFolderHint')}>
          {t('editor.exportToFolder')}
        </Button>
        <Button variant="primary" size="large" onClick={() => setConfirmGameExport(true)} disabled={template.status !== 'ready' || template.exporting || writing}>
          {t('editor.export')}
        </Button>
      </footer>

      <ConfirmDialog
        open={confirmGameExport}
        title={t('export.confirmTitle')}
        actions={[
          {
            label: t('editor.export'),
            primary: true,
            onSelect: () => {
              setConfirmGameExport(false)
              void runExport('game')
            }
          },
          { label: t('app.cancel'), onSelect: () => setConfirmGameExport(false) }
        ]}
      >
        <p>{t('export.confirmText', { slot: 'UserData\\Liveries', backups: 'UserData\\Liveries\\Backups' })}</p>
      </ConfirmDialog>
      <ConfirmDialog open={report !== null} title={report?.title ?? ''} actions={[{ label: t('app.ok'), primary: true, onSelect: () => setReport(null) }]}>
        {report?.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </ConfirmDialog>
    </main>
  )
}
