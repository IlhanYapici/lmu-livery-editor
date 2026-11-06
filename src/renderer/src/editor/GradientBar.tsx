import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Gradient } from './document'
import { clamp01, cssPreview } from './gradient'
import styles from './GradientBar.module.css'

type Props = {
  gradient: Gradient
  selected: number
  onSelect: (index: number) => void
  /** Moves a stop. A drag is one history step: the parent starts the gesture in `onDragStart`. */
  onMove: (index: number, offset: number) => void
  onAdd: (offset: number) => void
  onRemove: (index: number) => void
  onDragStart: () => void
}

/**
 * The gradient from left to right, over a checkerboard for the alpha, with one marker for each stop. Click the
 * bar to add a stop; drag a marker to move it; arrow keys move the selected marker by 1 %, Delete removes it.
 */
export function GradientBar({ gradient, selected, onSelect, onMove, onAdd, onRemove, onDragStart }: Props) {
  const { t } = useTranslation()
  const bar = useRef<HTMLDivElement>(null)
  const offsetOf = (clientX: number) => {
    const box = bar.current!.getBoundingClientRect()
    return Math.round(clamp01((clientX - box.left) / box.width) * 1000) / 1000
  }

  const startDrag = (index: number, e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onSelect(index)
    onDragStart()
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  return (
    <div className={styles.wrap}>
      <div
        ref={bar}
        className={styles.bar}
        title={t('properties.addStopHint')}
        onPointerDown={(e) => e.button === 0 && onAdd(offsetOf(e.clientX))}
      >
        <div className={styles.preview} style={{ background: cssPreview(gradient) }} />
        {gradient.stops.map((stop, i) => {
          const label = t('properties.stop', { n: i + 1, value: Math.round(stop.offset * 100) })
          return (
            <button
              key={i}
              type="button"
              className={styles.marker}
              style={{ left: `${stop.offset * 100}%`, background: stop.color }}
              aria-label={label}
              title={label}
              aria-pressed={i === selected}
              onPointerDown={(e) => startDrag(i, e)}
              onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && onMove(i, offsetOf(e.clientX))}
              onKeyDown={(e) => {
                const step = e.key === 'ArrowLeft' ? -0.01 : e.key === 'ArrowRight' ? 0.01 : 0
                if (step) {
                  e.preventDefault()
                  onMove(i, Math.round(clamp01(stop.offset + step) * 1000) / 1000)
                } else if (e.key === 'Delete') onRemove(i)
              }}
              onFocus={() => onSelect(i)}
            />
          )
        })}
      </div>
    </div>
  )
}
