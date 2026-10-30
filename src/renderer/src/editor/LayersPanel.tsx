import { Toggle } from 'radix-ui'
import { useState } from 'react'
import type { UserLayer } from './document'
import type { DocumentState } from './documentStore'
import { RegionSelect } from './RegionSelect'
import styles from './LayersPanel.module.css'

type Props = Pick<DocumentState, 'selectedId' | 'select' | 'updateLayer' | 'removeLayer' | 'duplicateLayer' | 'moveLayer'> & {
  layers: UserLayer[]
}

/** User layers, top to bottom. Drag a row to reorder it. */
export function LayersPanel({ layers, selectedId, select, updateLayer, removeLayer, duplicateLayer, moveLayer }: Props) {
  const [dragged, setDragged] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)

  if (layers.length === 0) {
    return <p className={styles.empty}>No layers yet. Use the tools on the left of the canvas.</p>
  }

  return (
    <ul className={styles.list} aria-label="Your layers">
      {[...layers].reverse().map((layer) => {
        const index = layers.indexOf(layer)
        const selected = layer.id === selectedId
        return (
          <li
            key={layer.id}
            className={[styles.row, selected && styles.selected, dragged === layer.id && styles.dragging].filter(Boolean).join(' ')}
            draggable={renaming !== layer.id}
            onDragStart={() => setDragged(layer.id)}
            onDragEnd={() => setDragged(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dragged && moveLayer(dragged, index)}
            onClick={() => select(layer.id)}
          >
            <Toggle.Root className={styles.icon} pressed={layer.visible} onPressedChange={(visible) => updateLayer(layer.id, { visible })} aria-label="Visible" onClick={(e) => e.stopPropagation()}>
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                {layer.visible ? <circle cx="12" cy="12" r="3" fill="currentColor" /> : <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.6" />}
              </svg>
            </Toggle.Root>
            <Toggle.Root className={styles.icon} pressed={layer.locked} onPressedChange={(locked) => updateLayer(layer.id, { locked })} aria-label="Locked" onClick={(e) => e.stopPropagation()}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <rect x="5" y="11" width="14" height="9" fill={layer.locked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" />
                <path d={layer.locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2'} fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </Toggle.Root>
            <span className={styles.color} style={{ background: layer.color }} />
            {renaming === layer.id ? (
              <input
                className={styles.nameInput}
                defaultValue={layer.name}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  if (e.target.value.trim()) updateLayer(layer.id, { name: e.target.value.trim() })
                  setRenaming(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setRenaming(null)
                }}
              />
            ) : (
              <span className={styles.name} onDoubleClick={() => setRenaming(layer.id)} title="Double-click to rename">
                {layer.name}
              </span>
            )}
            <span onClick={(e) => e.stopPropagation()}>
              <RegionSelect value={layer.region} onChange={(region) => updateLayer(layer.id, { region })} />
            </span>
            <span className={styles.actions} onClick={(e) => e.stopPropagation()}>
              <button className={styles.action} onClick={() => moveLayer(layer.id, index + 1)} disabled={index === layers.length - 1} aria-label="Move up">
                ▲
              </button>
              <button className={styles.action} onClick={() => moveLayer(layer.id, index - 1)} disabled={index === 0} aria-label="Move down">
                ▼
              </button>
              <button className={styles.action} onClick={() => duplicateLayer(layer.id)} aria-label="Duplicate">
                ⧉
              </button>
              <button className={styles.action} onClick={() => removeLayer(layer.id)} aria-label="Delete">
                ✕
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
