import { Select, Slider } from 'radix-ui'
import { useEffect, useState } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { useTranslation } from 'react-i18next'
import { WarningIcon } from '../components/WarningIcon'
import { enlargement, isUpscaled } from './assets'
import { FONTS, type Asset, type UserLayer } from './document'
import type { DocumentState } from './documentStore'
import styles from './PropertiesPanel.module.css'

type Props = Pick<DocumentState, 'updateLayer' | 'beginGesture' | 'endGesture'> & {
  layer: UserLayer
  /** The template table (Levels, Brightness) to show the colour as the game shows it. */
  table: Uint8Array | null
  /** For image layers: the image asset (source size). */
  asset?: Asset
}

/** Properties of the selected layer. A drag on the colour picker or the slider is one history step. */
export function PropertiesPanel({ layer, table, asset, updateLayer, beginGesture, endGesture }: Props) {
  const { t } = useTranslation()
  const update = (patch: Partial<UserLayer>) => updateLayer(layer.id, patch)
  const transform = (patch: Partial<UserLayer['transform']>) => update({ transform: { ...layer.transform, ...patch } })

  // A gesture ends when the pointer goes up anywhere, also outside the picker.
  useEffect(() => {
    window.addEventListener('pointerup', endGesture)
    return () => window.removeEventListener('pointerup', endGesture)
  }, [endGesture])

  return (
    <section className={styles.panel} aria-label={t('properties.label')}>
      <h3 className={styles.heading}>{layer.name}</h3>

      {'color' in layer && (
        <div className={styles.colorRow}>
          <div onPointerDown={beginGesture}>
            <HexColorPicker className={styles.picker} color={layer.color} onChange={(color) => update({ color })} />
          </div>
          <div className={styles.colorSide}>
            <label className={styles.label}>
              {t('properties.colour')}
              <HexColorInput className={styles.input} color={layer.color} onChange={(color) => update({ color })} prefixed />
            </label>
            <div className={styles.swatches}>
              <span className={styles.swatch} style={{ background: layer.color }} title={t('properties.yourColour')} />
              <span className={styles.swatch} style={{ background: table ? gameColor(layer.color, table) : layer.color }} title={t('properties.gameColour')} />
            </div>
            <span className={styles.note}>{t('properties.colourNote')}</span>
          </div>
        </div>
      )}

      <label className={styles.label}>
        {t('properties.opacity', { value: Math.round(layer.opacity * 100) })}
        <Slider.Root
          className={styles.slider}
          min={0}
          max={100}
          step={1}
          value={[Math.round(layer.opacity * 100)]}
          onPointerDown={beginGesture}
          onValueChange={([v]) => update({ opacity: v / 100 })}
        >
          <Slider.Track className={styles.track}>
            <Slider.Range className={styles.range} />
          </Slider.Track>
          <Slider.Thumb className={styles.thumb} aria-label={t('properties.opacity', { value: Math.round(layer.opacity * 100) })} />
        </Slider.Root>
      </label>

      {layer.kind !== 'fill' && (
        <div className={styles.grid}>
          <NumberField label="X" value={layer.transform.x} onCommit={(x) => transform({ x })} />
          <NumberField label="Y" value={layer.transform.y} onCommit={(y) => transform({ y })} />
          <NumberField label={t('properties.rotation')} value={layer.transform.rotation} onCommit={(rotation) => transform({ rotation })} />
          <NumberField label={t('properties.scaleX')} value={layer.transform.scaleX} step={0.01} onCommit={(scaleX) => transform({ scaleX })} />
          <NumberField label={t('properties.scaleY')} value={layer.transform.scaleY} step={0.01} onCommit={(scaleY) => transform({ scaleY })} />
          {layer.kind === 'rect' && (
            <>
              <NumberField label={t('properties.width')} value={layer.width} min={1} onCommit={(width) => update({ width })} />
              <NumberField label={t('properties.height')} value={layer.height} min={1} onCommit={(height) => update({ height })} />
              <NumberField label={t('properties.cornerRadius')} value={layer.cornerRadius} min={0} onCommit={(cornerRadius) => update({ cornerRadius })} />
            </>
          )}
        </div>
      )}

      {layer.kind === 'image' && (
        <>
          <div className={styles.grid}>
            <NumberField label={t('properties.width')} value={layer.width} min={1} onCommit={(width) => update({ width })} />
            <NumberField label={t('properties.height')} value={layer.height} min={1} onCommit={(height) => update({ height })} />
          </div>
          {asset && <ImageInfo layer={layer} asset={asset} />}
        </>
      )}

      {layer.kind === 'text' && (
        <>
          <label className={styles.label}>
            {t('properties.text')}
            <TextField value={layer.text} onCommit={(text) => update({ text })} />
          </label>
          <div className={styles.grid}>
            <label className={styles.label}>
              {t('properties.font')}
              <Select.Root value={layer.fontFamily} onValueChange={(fontFamily) => update({ fontFamily: fontFamily as (typeof FONTS)[number] })}>
                <Select.Trigger className={styles.input}>
                  <Select.Value />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className={styles.selectContent} position="popper" sideOffset={4}>
                    <Select.Viewport>
                      {FONTS.map((font) => (
                        <Select.Item key={font} value={font} className={styles.selectItem} style={{ fontFamily: font }}>
                          <Select.ItemText>{font}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </label>
            <NumberField label={t('properties.size')} value={layer.fontSize} min={4} onCommit={(fontSize) => update({ fontSize })} />
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={!!layer.outline}
                onChange={(e) => update({ outline: e.target.checked ? { color: '#000000', width: 12 } : null })}
              />
              {t('properties.outline')}
            </label>
            {layer.outline && (
              <>
                <label className={styles.label}>
                  {t('properties.outlineColour')}
                  <HexColorInput className={styles.input} color={layer.outline.color} onChange={(color) => update({ outline: { ...layer.outline!, color } })} prefixed />
                </label>
                <NumberField label={t('properties.outlineWidth')} value={layer.outline.width} min={0} onCommit={(width) => update({ outline: { ...layer.outline!, width } })} />
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}

/** Source size, and a warning when a raster image is enlarged so much that it looks blurred in game. */
function ImageInfo({ layer, asset }: { layer: Extract<UserLayer, { kind: 'image' }>; asset: Asset }) {
  const { t } = useTranslation()
  const text = t('properties.upscaled', { factor: new Intl.NumberFormat(document.documentElement.lang || 'en', { maximumFractionDigits: 1 }).format(enlargement(layer, asset)) })
  return (
    <>
      <span className={styles.note}>{t('properties.source', { width: asset.width, height: asset.height })}</span>
      {isUpscaled(layer, asset) && (
        <span className={styles.warning} role="status">
          <WarningIcon label={text} />
          <span>{text}</span>
        </span>
      )}
    </>
  )
}

/** A number field that commits on Enter or when it loses focus, so typing makes one history step. */
function NumberField({ label, value, onCommit, step = 1, min }: { label: string; value: number; onCommit: (v: number) => void; step?: number; min?: number }) {
  const [text, setText] = useState(format(value))
  // When the value changes from outside (undo, a drag on the canvas), show it. React's "previous value" pattern.
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setText(format(value))
  }
  const commit = () => {
    const v = Number(text)
    if (Number.isFinite(v) && v !== value) onCommit(min === undefined ? v : Math.max(min, v))
    else setText(format(value))
  }
  return (
    <label className={styles.label}>
      {label}
      <input
        className={styles.input}
        type="number"
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  )
}

function TextField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value)
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setText(value)
  }
  return <input className={styles.input} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text !== value && onCommit(text)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
}

const format = (v: number) => String(Math.round(v * 100) / 100)

/** The colour after the template table, as a hex string. */
function gameColor(hex: string, table: Uint8Array): string {
  const n = parseInt(hex.slice(1), 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => table[v])
  return `#${channels.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
