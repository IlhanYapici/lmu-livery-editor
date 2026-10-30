import { Tabs, ToggleGroup, Tooltip } from 'radix-ui'
import { useState } from 'react'
import type { Car, Category, TemplateVariant } from '../../../shared/api'
import { REGIONS } from '../../../shared/psd/regions'
import { Button } from '../components/Button'
import { ClassBadge } from '../components/ClassBadge'
import styles from './EditorScreen.module.css'

type Props = { category: Category; car: Car; variant: TemplateVariant }

const rgb = ([r, g, b]: number[]) => `rgb(${r} ${g} ${b})`

/** Editor layout in the style of the game livery showroom. The canvas and the layers come in Phase 3c. */
export function EditorScreen({ category, car, variant }: Props) {
  const [view, setView] = useState('livery')

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
        <p>Template canvas · Phase 3c</p>
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
          <p className={styles.empty}>Template groups and their visibility come in Phase 3c.</p>
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
          onValueChange={(v) => v && setView(v)}
          aria-label="View"
        >
          <ToggleGroup.Item className={styles.segment} value="livery">
            Livery
          </ToggleGroup.Item>
          <ToggleGroup.Item className={styles.segment} value="regions">
            Region map
          </ToggleGroup.Item>
        </ToggleGroup.Root>
        <span className={styles.spacer} />
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
