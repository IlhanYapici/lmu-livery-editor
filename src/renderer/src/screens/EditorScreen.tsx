import { Tabs, Toggle, ToggleGroup, Tooltip } from 'radix-ui'
import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import type { Car, Category, TemplateVariant } from '../../../shared/api'
import { REGIONS } from '../../../shared/psd/regions'
import { Button } from '../components/Button'
import { ClassBadge } from '../components/ClassBadge'
import { TemplateCanvas, type CanvasView, type GuideOptions } from '../editor/TemplateCanvas'
import { TemplatePanel } from '../editor/TemplatePanel'
import { createTemplateStore, type TemplateStore } from '../editor/templateStore'
import styles from './EditorScreen.module.css'

type Props = { category: Category; car: Car; variant: TemplateVariant }

const rgb = ([r, g, b]: number[]) => `rgb(${r} ${g} ${b})`

const STAGE_TEXT = { reading: 'Reading the template', parsing: 'Reading the layers', guides: 'Drawing the guides', segments: 'Drawing the template' }

const seconds = (ms: number | null) => (ms === null ? '…' : `${(ms / 1000).toFixed(1)} s`)

/** Editor in the style of the game livery showroom. */
export function EditorScreen({ category, car, variant }: Props) {
  const [view, setView] = useState<CanvasView>('livery')
  const [guides, setGuides] = useState<GuideOptions>({ wireframe: true, mask: true })
  const [fitSignal, setFitSignal] = useState(0)
  const [zoom, setZoom] = useState(0)
  const [store, setStore] = useState<TemplateStore | null>(null)

  useEffect(() => {
    const next = createTemplateStore(variant.id)
    setStore(next)
    return () => next.getState().dispose()
  }, [variant.id])

  if (!store) return null
  return (
    <EditorBody
      {...{ category, car, variant, store, view, setView, guides, setGuides, fitSignal, setFitSignal, zoom, setZoom }}
    />
  )
}

type BodyProps = Props & {
  store: TemplateStore
  view: CanvasView
  setView: (v: CanvasView) => void
  guides: GuideOptions
  setGuides: (g: GuideOptions) => void
  fitSignal: number
  setFitSignal: (n: number) => void
  zoom: number
  setZoom: (z: number) => void
}

function EditorBody({ category, car, variant, store, view, setView, guides, setGuides, fitSignal, setFitSignal, zoom, setZoom }: BodyProps) {
  const t = useStore(store)

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
        <TemplateCanvas template={t} view={view} guides={guides} fitSignal={fitSignal} onZoomChange={setZoom} />
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
        <div className={styles.canvasTools}>
          <span>{Math.round(zoom * 100)} %</span>
          <button className={styles.toolButton} onClick={() => setFitSignal(fitSignal + 1)}>
            Fit
          </button>
        </div>
      </section>

      <Tabs.Root className={styles.panel} defaultValue="layers">
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
          <p className={styles.empty}>No layers yet.</p>
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="template">
          {t.outline ? (
            <TemplatePanel
              content={t.outline.content}
              visibility={t.visibility}
              insertion={t.insertion}
              maxInsertion={t.outline.maxInsertion}
              onVisible={t.setVisible}
              onInsertion={t.setInsertion}
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
        <ToggleGroup.Root
          type="single"
          className={styles.segmented}
          value={view}
          onValueChange={(v) => v && setView(v as CanvasView)}
          aria-label="View"
        >
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
        <span className={styles.status}>
          {t.status === 'ready' && (
            <>
              Loaded in {seconds(t.timings.loadMs)} · template drawn in {seconds(t.timings.segmentsMs)} · preview{' '}
              {t.segments?.fastIsExact ? 'exact' : 'approximate'}
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
