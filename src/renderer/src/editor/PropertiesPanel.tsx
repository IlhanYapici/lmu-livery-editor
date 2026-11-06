import { Select, Slider, ToggleGroup } from 'radix-ui'
import { useEffect, useState } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { useTranslation } from 'react-i18next'
import { WarningIcon } from '../components/WarningIcon'
import { enlargement, isUpscaled } from './assets'
import { FONTS, type Asset, type Gradient, type UserLayer } from './document'
import type { DocumentState } from './documentStore'
import { addStop, clamp01, defaultGradient, normalAngle, removeStop, updateStop } from './gradient'
import { GradientBar } from './GradientBar'
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

      {'gradient' in layer ? (
        <Paint layer={layer} table={table} update={update} beginGesture={beginGesture} />
      ) : (
        'color' in layer && (
          <ColorRow color={layer.color} table={table} onChange={(color) => update({ color })} beginGesture={beginGesture} />
        )
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
          <NumberField
            label={t('properties.scaleX')}
            value={layer.transform.scaleX}
            step={0.01}
            onCommit={(scaleX) => transform({ scaleX })}
          />
          <NumberField
            label={t('properties.scaleY')}
            value={layer.transform.scaleY}
            step={0.01}
            onCommit={(scaleY) => transform({ scaleY })}
          />
          {layer.kind === 'rect' && (
            <>
              <NumberField label={t('properties.width')} value={layer.width} min={1} onCommit={(width) => update({ width })} />
              <NumberField label={t('properties.height')} value={layer.height} min={1} onCommit={(height) => update({ height })} />
              <NumberField
                label={t('properties.cornerRadius')}
                value={layer.cornerRadius}
                min={0}
                onCommit={(cornerRadius) => update({ cornerRadius })}
              />
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
              <Select.Root
                value={layer.fontFamily}
                onValueChange={(fontFamily) => update({ fontFamily: fontFamily as (typeof FONTS)[number] })}
              >
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
                  <HexColorInput
                    className={styles.input}
                    color={layer.outline.color}
                    onChange={(color) => update({ outline: { ...layer.outline!, color } })}
                    prefixed
                  />
                </label>
                <NumberField
                  label={t('properties.outlineWidth')}
                  value={layer.outline.width}
                  min={0}
                  onCommit={(width) => update({ outline: { ...layer.outline!, width } })}
                />
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}

type Paintable = Extract<UserLayer, { gradient: unknown }>

/**
 * Solid colour or gradient (ADR-0034). With a gradient, the colour picker edits the selected stop. The layer
 * colour stays as the solid colour, and is the colour of a new gradient.
 */
function Paint({
  layer,
  table,
  update,
  beginGesture
}: {
  layer: Paintable
  table: Uint8Array | null
  update: (patch: Partial<UserLayer>) => void
  beginGesture: () => void
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(0)
  const gradient = layer.gradient
  const index = gradient ? Math.min(selected, gradient.stops.length - 1) : 0
  const stop = gradient?.stops[index]
  const setGradient = (next: Gradient | null) => update({ gradient: next })

  return (
    <>
      <div className={styles.label}>
        {t('properties.paint')}
        <ToggleGroup.Root
          type="single"
          className={styles.segments}
          value={gradient?.type ?? 'solid'}
          onValueChange={(v) => {
            if (!v || v === (gradient?.type ?? 'solid')) return
            setSelected(0)
            setGradient(
              v === 'solid'
                ? null
                : gradient
                  ? { ...gradient, type: v as Gradient['type'] }
                  : defaultGradient(v as Gradient['type'], layer.color)
            )
          }}
          aria-label={t('properties.paint')}
        >
          {(['solid', 'linear', 'radial'] as const).map((v) => (
            <ToggleGroup.Item key={v} value={v} className={styles.segment}>
              {t(`properties.${v}`)}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>

      {gradient && stop ? (
        <>
          <GradientBar
            gradient={gradient}
            selected={index}
            onSelect={setSelected}
            onDragStart={beginGesture}
            onMove={(i, offset) => setGradient(updateStop(gradient, i, { offset }))}
            onAdd={(offset) => {
              const added = addStop(gradient, offset)
              if (!added) return
              setGradient(added.gradient)
              setSelected(added.index)
            }}
            onRemove={(i) => {
              setGradient(removeStop(gradient, i))
              setSelected(0)
            }}
          />
          <ColorRow
            color={stop.color}
            table={table}
            onChange={(color) => setGradient(updateStop(gradient, index, { color }))}
            beginGesture={beginGesture}
          />
          <div className={styles.grid}>
            <NumberField
              label={t('properties.stopPosition')}
              value={Math.round(stop.offset * 1000) / 10}
              onCommit={(v) => setGradient(updateStop(gradient, index, { offset: clamp01(v / 100) }))}
            />
            {gradient.type === 'linear' && (
              <NumberField
                label={t('properties.angle')}
                value={gradient.angle}
                onCommit={(v) => setGradient({ ...gradient, angle: normalAngle(v) })}
              />
            )}
            <button
              type="button"
              className={styles.removeStop}
              disabled={gradient.stops.length <= 2}
              onClick={() => {
                setGradient(removeStop(gradient, index))
                setSelected(0)
              }}
            >
              {t('properties.removeStop')}
            </button>
          </div>
          <label className={styles.label}>
            {t('properties.stopAlpha', { value: Math.round(stop.alpha * 100) })}
            <Slider.Root
              className={styles.slider}
              min={0}
              max={100}
              step={1}
              value={[Math.round(stop.alpha * 100)]}
              onPointerDown={beginGesture}
              onValueChange={([v]) => setGradient(updateStop(gradient, index, { alpha: v / 100 }))}
            >
              <Slider.Track className={styles.track}>
                <Slider.Range className={styles.range} />
              </Slider.Track>
              <Slider.Thumb className={styles.thumb} aria-label={t('properties.stopAlpha', { value: Math.round(stop.alpha * 100) })} />
            </Slider.Root>
          </label>
        </>
      ) : (
        <ColorRow color={layer.color} table={table} onChange={(color) => update({ color })} beginGesture={beginGesture} />
      )}
    </>
  )
}

/** The colour picker, the hex field, and the colour as the game shows it. */
function ColorRow({
  color,
  table,
  onChange,
  beginGesture
}: {
  color: string
  table: Uint8Array | null
  onChange: (color: string) => void
  beginGesture: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.colorRow}>
      <div onPointerDown={beginGesture}>
        <HexColorPicker className={styles.picker} color={color} onChange={onChange} />
      </div>
      <div className={styles.colorSide}>
        <label className={styles.label}>
          {t('properties.colour')}
          <HexColorInput className={styles.input} color={color} onChange={onChange} prefixed />
        </label>
        <div className={styles.swatches}>
          <span className={styles.swatch} style={{ background: color }} title={t('properties.yourColour')} />
          <span
            className={styles.swatch}
            style={{ background: table ? gameColor(color, table) : color }}
            title={t('properties.gameColour')}
          />
        </div>
        <span className={styles.note}>{t('properties.colourNote')}</span>
      </div>
    </div>
  )
}

/** Source size, and a warning when a raster image is enlarged so much that it looks blurred in game. */
function ImageInfo({ layer, asset }: { layer: Extract<UserLayer, { kind: 'image' }>; asset: Asset }) {
  const { t } = useTranslation()
  const text = t('properties.upscaled', {
    factor: new Intl.NumberFormat(document.documentElement.lang || 'en', { maximumFractionDigits: 1 }).format(enlargement(layer, asset))
  })
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
function NumberField({
  label,
  value,
  onCommit,
  step = 1,
  min
}: {
  label: string
  value: number
  onCommit: (v: number) => void
  step?: number
  min?: number
}) {
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
  return (
    <input
      className={styles.input}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onCommit(text)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

const format = (v: number) => String(Math.round(v * 100) / 100)

/** The colour after the template table, as a hex string. */
function gameColor(hex: string, table: Uint8Array): string {
  const n = parseInt(hex.slice(1), 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => table[v])
  return `#${channels.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
