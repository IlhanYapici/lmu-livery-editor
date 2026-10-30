import type Konva from 'konva'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Image as KonvaImage, Layer, Stage } from 'react-konva'
import type { TemplateState } from './templateStore'
import styles from './TemplateCanvas.module.css'

// The editor canvas. One Konva layer (one HTML canvas) per part, so that CSS can treat each part alone:
// the paint gets the template table filter (Levels, Brightness), the wireframe blends with "screen".

export type CanvasView = 'livery' | 'regions'
export type GuideOptions = { wireframe: boolean; mask: boolean }

type Props = {
  template: Pick<TemplateState, 'outline' | 'guides' | 'segments'>
  view: CanvasView
  guides: GuideOptions
  /** Changes when the user asks to fit the template in the view. */
  fitSignal: number
  onZoomChange?: (scale: number) => void
}

const FILTER_ID = 'lmu-template-table'
const MIN_SCALE = 0.05
const MAX_SCALE = 8

export function TemplateCanvas({ template, view, guides, fitSignal, onZoomChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [camera, setCamera] = useState({ scale: 0.2, x: 0, y: 0 })
  const paintRef = useRef<Konva.Layer>(null)
  const wireRef = useRef<Konva.Layer>(null)
  const pan = useRef<{ x: number; y: number } | null>(null)
  const spaceDown = useRef(false)
  const width = template.outline?.width ?? 4096
  const height = template.outline?.height ?? 4096

  useLayoutEffect(() => {
    const element = containerRef.current!
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Fit when the view size is known, and when the user asks.
  useEffect(() => {
    if (!size.width || !size.height) return
    const scale = Math.min(size.width / width, size.height / height) * 0.96
    setCamera({ scale, x: (size.width - width * scale) / 2, y: (size.height - height * scale) / 2 })
  }, [size.width > 0, fitSignal, width, height])

  useEffect(() => onZoomChange?.(camera.scale), [camera.scale, onZoomChange])

  // CSS on the layer canvases: table filter on the paint, "screen" blend on the wireframe.
  useEffect(() => {
    const paint = paintRef.current?.getNativeCanvasElement()
    if (paint) paint.style.filter = view === 'livery' && template.segments ? `url(#${FILTER_ID})` : 'none'
    const wire = wireRef.current?.getNativeCanvasElement()
    if (wire) {
      wire.style.mixBlendMode = 'screen'
      wire.style.opacity = '0.6'
    }
  }, [view, template.segments, guides.wireframe])

  useEffect(() => {
    const down = (e: KeyboardEvent) => e.code === 'Space' && (spaceDown.current = true)
    const up = (e: KeyboardEvent) => e.code === 'Space' && (spaceDown.current = false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const pointer = e.target.getStage()!.getPointerPosition()!
    setCamera((c) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, c.scale * (e.evt.deltaY < 0 ? 1.15 : 1 / 1.15)))
      const k = scale / c.scale
      return { scale, x: pointer.x - (pointer.x - c.x) * k, y: pointer.y - (pointer.y - c.y) * k }
    })
  }

  // Pan with the middle button, or with Space + left button.
  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || (e.evt.button === 0 && spaceDown.current)) {
      e.evt.preventDefault()
      pan.current = { x: e.evt.clientX, y: e.evt.clientY }
    }
  }
  const onMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!pan.current) return
    const dx = e.evt.clientX - pan.current.x
    const dy = e.evt.clientY - pan.current.y
    pan.current = { x: e.evt.clientX, y: e.evt.clientY }
    setCamera((c) => ({ ...c, x: c.x + dx, y: c.y + dy }))
  }
  const endPan = () => (pan.current = null)

  const { segments } = template
  const g = template.guides
  const at = { x: camera.x, y: camera.y, scaleX: camera.scale, scaleY: camera.scale }

  return (
    <div ref={containerRef} className={styles.container}>
      <svg className={styles.filters} aria-hidden>
        <filter id={FILTER_ID} colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            {(['feFuncR', 'feFuncG', 'feFuncB'] as const).map((Func) => (
              <Func key={Func} type="table" tableValues={segments ? tableValues(segments.table) : '0 1'} />
            ))}
          </feComponentTransfer>
        </filter>
      </svg>
      {size.width > 0 && (
        <Stage width={size.width} height={size.height} onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={endPan} onMouseLeave={endPan}>
          <Layer ref={paintRef} listening={false} visible={view === 'livery'} imageSmoothingEnabled={camera.scale < 1}>
            {segments && <KonvaImage image={segments.below} {...at} />}
            {/* User layers go here (Phase 3c-2). */}
            {segments && <KonvaImage image={segments.above} {...at} />}
          </Layer>
          <Layer listening={false} visible={view === 'regions'} imageSmoothingEnabled={camera.scale < 1}>
            {g && <KonvaImage image={g.regions} {...at} />}
          </Layer>
          <Layer listening={false} visible={guides.mask} opacity={0.75}>
            {g?.mask && <KonvaImage image={g.mask} {...at} />}
          </Layer>
          <Layer ref={wireRef} listening={false} visible={guides.wireframe}>
            {g?.wireframe && <KonvaImage image={g.wireframe} {...at} />}
          </Layer>
        </Stage>
      )}
    </div>
  )
}

/** feFuncX tableValues for a 256-entry table (values 0..1). */
function tableValues(table: Uint8Array): string {
  return Array.from(table, (v) => (v / 255).toFixed(4)).join(' ')
}
