import { Toggle } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { WarningIcon } from '../components/WarningIcon'
import { assetUrl, enlargement, isUpscaled } from './assets'
import type { LiveryDocument, UserLayer } from './document'
import type { DocumentState } from './documentStore'
import { RegionSelect } from './RegionSelect'
import styles from './LayersPanel.module.css'

type Props = Pick<DocumentState, 'selectedId' | 'select' | 'updateLayer' | 'removeLayer' | 'duplicateLayer' | 'moveLayer'> & {
  layers: UserLayer[]
  assets: LiveryDocument['assets']
}

/** User layers, top to bottom. Drag a row to reorder it. */
export function LayersPanel({ layers, assets, selectedId, select, updateLayer, removeLayer, duplicateLayer, moveLayer }: Props) {
  const { t, i18n } = useTranslation()
  const [dragged, setDragged] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)

  if (layers.length === 0) {
    return <p className={styles.empty}>{t('layers.empty')}</p>
  }

  return (
    <ul className={styles.list} aria-label={t('layers.label')}>
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
            <Toggle.Root
              className={styles.icon}
              pressed={layer.visible}
              onPressedChange={(visible) => updateLayer(layer.id, { visible })}
              aria-label={t('layers.visible')}
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                {layer.visible ? (
                  <circle cx="12" cy="12" r="3" fill="currentColor" />
                ) : (
                  <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.6" />
                )}
              </svg>
            </Toggle.Root>
            <Toggle.Root
              className={styles.icon}
              pressed={layer.locked}
              onPressedChange={(locked) => updateLayer(layer.id, { locked })}
              aria-label={t('layers.locked')}
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <rect
                  x="5"
                  y="11"
                  width="14"
                  height="9"
                  fill={layer.locked ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d={layer.locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2'}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
            </Toggle.Root>
            <span
              className={styles.color}
              style={
                layer.kind === 'image' && assets[layer.assetId]
                  ? {
                      backgroundImage: `url(${assetUrl(layer.assetId, assets[layer.assetId])})`,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center'
                    }
                  : { background: 'color' in layer ? layer.color : 'transparent' }
              }
            />
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
              <span className={styles.name} onDoubleClick={() => setRenaming(layer.id)} title={t('layers.renameHint')}>
                {layer.name}
              </span>
            )}
            {layer.kind === 'image' && assets[layer.assetId] && isUpscaled(layer, assets[layer.assetId]) && (
              <WarningIcon
                label={t('properties.upscaled', {
                  factor: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
                    enlargement(layer, assets[layer.assetId])
                  )
                })}
              />
            )}
            <span onClick={(e) => e.stopPropagation()}>
              <RegionSelect value={layer.region} onChange={(region) => updateLayer(layer.id, { region })} />
            </span>
            <span className={styles.actions} onClick={(e) => e.stopPropagation()}>
              <button
                className={styles.action}
                onClick={() => moveLayer(layer.id, index + 1)}
                disabled={index === layers.length - 1}
                aria-label={t('layers.moveUp')}
              >
                ▲
              </button>
              <button
                className={styles.action}
                onClick={() => moveLayer(layer.id, index - 1)}
                disabled={index === 0}
                aria-label={t('layers.moveDown')}
              >
                ▼
              </button>
              <button className={styles.action} onClick={() => duplicateLayer(layer.id)} aria-label={t('layers.duplicate')}>
                ⧉
              </button>
              <button className={styles.action} onClick={() => removeLayer(layer.id)} aria-label={t('layers.delete')}>
                ✕
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
