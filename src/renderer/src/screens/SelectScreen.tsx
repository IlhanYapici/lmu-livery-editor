import { ToggleGroup } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, type CSSProperties } from 'react'
import type { Catalogue } from '../../../shared/api'
import { classColor } from '../classColors'
import { Button } from '../components/Button'
import { ClassBadge } from '../components/ClassBadge'
import { formatMegabytes } from '../i18n'
import styles from './SelectScreen.module.css'

export type Selection = { categoryId: string; carId: string; variantId: string }

type Props = {
  catalogue: Catalogue
  selection: Selection
  onSelect: (selection: Selection) => void
  onContinue: () => void
}

/** Category → car → variant, in the style of the car selection screen of the game. */
export function SelectScreen({ catalogue, selection, onSelect, onContinue }: Props) {
  const { t } = useTranslation()
  const category = catalogue.find((c) => c.id === selection.categoryId) ?? catalogue[0]
  const car = category.cars.find((c) => c.id === selection.carId) ?? category.cars[0]
  const variant = car.variants.find((v) => v.id === selection.variantId) ?? car.variants[0]

  const selectCategory = (id: string) => {
    const next = catalogue.find((c) => c.id === id)
    if (next) onSelect({ categoryId: id, carId: next.cars[0].id, variantId: next.cars[0].variants[0].id })
  }
  const selectCar = (id: string) => {
    const next = category.cars.find((c) => c.id === id)
    if (next) onSelect({ categoryId: category.id, carId: id, variantId: next.variants[0].id })
  }
  const selectVariant = (id: string) => id && onSelect({ categoryId: category.id, carId: car.id, variantId: id })

  // Keep the selected tiles visible in the scrolling rows.
  const pickerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    pickerRef.current
      ?.querySelectorAll<HTMLElement>(`.${styles.tiles} [data-state='on']`)
      .forEach((tile) => tile.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
  }, [car.id, variant.id])

  return (
    <main className={styles.screen}>
      <section className={styles.hero}>
        <div className={styles.heading}>
          <h2 className={styles.carName}>{car.name}</h2>
          <ClassBadge categoryId={category.id} shortName={category.shortName} />
        </div>
        <p className={styles.variantLine}>{variant.label}</p>
        <span className={styles.fileChip}>{variant.id}</span>
      </section>

      <aside className={styles.info}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path d="m4 12 5 5L20 6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        {t('select.templateFound', { size: formatMegabytes(variant.sizeBytes) })}
      </aside>

      <section className={styles.picker} ref={pickerRef}>
        <div className={styles.pickerHead}>
          <ToggleGroup.Root
            type="single"
            className={styles.classTabs}
            value={category.id}
            onValueChange={(id) => id && selectCategory(id)}
            aria-label={t('select.category')}
          >
            {catalogue.map((c) => (
              <ToggleGroup.Item
                key={c.id}
                value={c.id}
                className={styles.classTab}
                style={{ '--class-color': classColor(c.id) } as CSSProperties}
              >
                {c.name}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
          <Button variant="primary" size="large" onClick={onContinue}>
            {t('select.continue')}
          </Button>
        </div>

        <ToggleGroup.Root
          type="single"
          className={styles.tiles}
          value={car.id}
          onValueChange={(id) => id && selectCar(id)}
          aria-label={t('select.car')}
        >
          {category.cars.map((c) => (
            <ToggleGroup.Item key={c.id} value={c.id} className={styles.carTile}>
              <span className={styles.tileName}>{c.name}</span>
              <span className={styles.tileCount}>{t('select.variantCount', { count: c.variants.length })}</span>
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>

        <ToggleGroup.Root
          type="single"
          className={styles.tiles}
          value={variant.id}
          onValueChange={selectVariant}
          aria-label={t('select.variant')}
        >
          {car.variants.map((v) => (
            <ToggleGroup.Item key={v.id} value={v.id} className={styles.variantTile}>
              <span className={styles.variantLabel}>{v.label}</span>
              <span className={styles.variantSize}>{formatMegabytes(v.sizeBytes)}</span>
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </section>
    </main>
  )
}
