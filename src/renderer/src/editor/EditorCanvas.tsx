import type Konva from 'konva'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import { REGIONS } from '../../../shared/psd/regions'
import { loadAssetImage, regionShape } from './assets'
import { FONTS, type LiveryDocument, type UserLayer } from './document'
import type { DocumentState } from './documentStore'
import type { TemplateState } from './templateStore'
import styles from './EditorCanvas.module.css'

// The editor canvas. One Konva layer (one HTML canvas) per part, so that CSS can treat each part alone:
// the paint gets the template table filter (ADR-0018), the wireframe blends with "screen".
// User layers live in template pixels inside a group that carries the camera (zoom and pan).

export type CanvasView = 'livery' | 'regions'
export type GuideOptions = { wireframe: boolean; mask: boolean }
export type Tool = 'select' | 'rect' | 'polygon' | 'text'

type DocumentProps = Pick<DocumentState, 'selectedId' | 'select' | 'addLayer' | 'updateLayer' | 'beginGesture' | 'endGesture'> & {
  layers: UserLayer[]
  assets: LiveryDocument['assets']
}

type Props = {
  template: Pick<TemplateState, 'outline' | 'guides' | 'segments' | 'exact'>
  document: DocumentProps
  tool: Tool
  onToolDone: () => void
  view: CanvasView
  guides: GuideOptions
  /** Changes when the user asks to fit the template in the view. */
  fitSignal: number
  onZoomChange?: (scale: number) => void
  /** Image files dropped on the canvas, with the drop point in template pixels. */
  onDropFiles: (files: File[], at: { x: number; y: number }) => void
  /** Gives the centre of the visible area in template pixels (where pasted or picked images go). */
  viewCenterRef: RefObject<(() => { x: number; y: number }) | null>
}

const FILTER_ID = 'lmu-template-table'
const MIN_SCALE = 0.05
const MAX_SCALE = 8
const REGION_RGB = Object.fromEntries(REGIONS.map((r) => [r.id, `rgb(${r.rgb.join(' ')})`]))
const REGION_TRIPLET = Object.fromEntries(REGIONS.map((r) => [r.id, r.rgb]))

/** Decoded images of the document assets; the map grows as images finish decoding. */
function useAssetImages(assets: LiveryDocument['assets']): Record<string, HTMLImageElement> {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({})
  useEffect(() => {
    let alive = true
    for (const [id, asset] of Object.entries(assets)) {
      if (images[id]) continue
      loadAssetImage(id, asset).then((image) => alive && setImages((all) => ({ ...all, [id]: image })))
    }
    return () => {
      alive = false
    }
  }, [assets, images])
  return images
}

type Draft = { kind: 'rect'; x0: number; y0: number; x1: number; y1: number } | { kind: 'polygon'; points: number[]; cursor: [number, number] | null }

export function EditorCanvas({ template, document: doc, tool, onToolDone, view, guides, fitSignal, onZoomChange, onDropFiles, viewCenterRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [camera, setCamera] = useState({ scale: 0.2, x: 0, y: 0 })
  // A draft belongs to the tool that started it: after a tool change, the old draft counts as none.
  const [draftState, setDraftState] = useState<{ tool: Tool; draft: Draft } | null>(null)
  const draft = draftState?.tool === tool ? draftState.draft : null
  const setDraft = (next: Draft | null | ((current: Draft | null) => Draft | null)) =>
    setDraftState((state) => {
      const value = typeof next === 'function' ? next(state?.tool === tool ? state.draft : null) : next
      return value ? { tool, draft: value } : null
    })
  const paintRef = useRef<Konva.Layer>(null)
  const wireRef = useRef<Konva.Layer>(null)
  const userRef = useRef<Konva.Group>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const pan = useRef<{ x: number; y: number } | null>(null)
  const spaceDown = useRef(false)
  const width = template.outline?.width ?? 4096
  const height = template.outline?.height ?? 4096
  const hasSize = size.width > 0
  const assetImages = useAssetImages(doc.assets)

  useEffect(() => {
    viewCenterRef.current = () => ({ x: (size.width / 2 - camera.x) / camera.scale, y: (size.height / 2 - camera.y) / camera.scale })
  }, [viewCenterRef, size, camera])

  useLayoutEffect(() => {
    const element = containerRef.current!
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Fit when the view size is first known, and when the user asks (fitSignal). Not at each resize: that would
  // lose the user's zoom and pan, so size.width and size.height are left out on purpose.
  useEffect(() => {
    if (!hasSize) return
    const scale = Math.min(size.width / width, size.height / height) * 0.96
    // oxlint-disable-next-line react/set-state-in-effect -- the camera reacts to a command (fitSignal) or the first layout
    setCamera({ scale, x: (size.width - width * scale) / 2, y: (size.height - height * scale) / 2 })
    // oxlint-disable-next-line react/exhaustive-deps -- see above
  }, [hasSize, fitSignal, width, height])

  useEffect(() => onZoomChange?.(camera.scale), [camera.scale, onZoomChange])

  // Canvas text needs the fonts loaded; the browser loads a web font only when the page uses it.
  useEffect(() => {
    Promise.all(FONTS.map((font) => document.fonts.load(`40px "${font}"`))).then(() => userRef.current?.getLayer()?.batchDraw())
  }, [hasSize])

  // CSS on the layer canvases: table filter on the paint (not on the exact image), "screen" on the wireframe.
  useEffect(() => {
    const paint = paintRef.current?.getNativeCanvasElement()
    if (paint) paint.style.filter = view === 'livery' && template.segments && !template.exact ? `url(#${FILTER_ID})` : 'none'
    const wire = wireRef.current?.getNativeCanvasElement()
    if (wire) {
      wire.style.mixBlendMode = 'screen'
      wire.style.opacity = '0.6'
    }
  }, [view, template.segments, template.exact, guides.wireframe])

  // Attach the transformer to the selected shape (fill layers cover everything and have no handles).
  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    const layer = doc.layers.find((l) => l.id === doc.selectedId)
    const node = layer && layer.kind !== 'fill' && !layer.locked && layer.visible ? userRef.current?.findOne(`#${layer.id}`) : null
    transformer.nodes(node && tool === 'select' ? [node] : [])
  }, [doc.selectedId, doc.layers, tool, assetImages]) // assetImages: an image node exists only after its image is decoded.

  /** The pointer in template pixels. */
  const pointer = (): [number, number] => {
    const p = userRef.current!.getStage()!.getPointerPosition()!
    return [(p.x - camera.x) / camera.scale, (p.y - camera.y) / camera.scale]
  }

  const finishPolygon = () => {
    if (draft?.kind !== 'polygon' || draft.points.length < 6) return
    const xs = draft.points.filter((_, i) => i % 2 === 0)
    const ys = draft.points.filter((_, i) => i % 2 === 1)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    const points = draft.points.map((v, i) => (i % 2 === 0 ? v - x : v - y))
    doc.addLayer('polygon', { points, transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 } })
    setDraft(null)
    onToolDone()
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = true
      if (draft?.kind === 'polygon' && e.key === 'Enter') finishPolygon()
      if (draft && e.key === 'Escape') setDraft(null)
    }
    const up = (e: KeyboardEvent) => e.code === 'Space' && (spaceDown.current = false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const p = e.target.getStage()!.getPointerPosition()!
    setCamera((c) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, c.scale * (e.evt.deltaY < 0 ? 1.15 : 1 / 1.15)))
      const k = scale / c.scale
      return { scale, x: p.x - (p.x - c.x) * k, y: p.y - (p.y - c.y) * k }
    })
  }

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Pan with the middle button, or with Space + left button.
    if (e.evt.button === 1 || (e.evt.button === 0 && spaceDown.current)) {
      e.evt.preventDefault()
      pan.current = { x: e.evt.clientX, y: e.evt.clientY }
      return
    }
    if (e.evt.button !== 0) return
    const [x, y] = pointer()
    if (tool === 'rect') setDraft({ kind: 'rect', x0: x, y0: y, x1: x, y1: y })
    else if (tool === 'polygon') setDraft((d) => ({ kind: 'polygon', points: [...(d?.kind === 'polygon' ? d.points : []), x, y], cursor: null }))
    else if (tool === 'text') {
      doc.addLayer('text', { transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 } })
      onToolDone()
    } else if (e.target === e.target.getStage()) {
      // Template images ignore the mouse, so a click on an empty area reaches the stage itself.
      doc.select(null)
    }
  }

  const onMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (pan.current) {
      const dx = e.evt.clientX - pan.current.x
      const dy = e.evt.clientY - pan.current.y
      pan.current = { x: e.evt.clientX, y: e.evt.clientY }
      setCamera((c) => ({ ...c, x: c.x + dx, y: c.y + dy }))
      return
    }
    if (!draft) return
    const [x, y] = pointer()
    setDraft(draft.kind === 'rect' ? { ...draft, x1: x, y1: y } : { ...draft, cursor: [x, y] })
  }

  const onMouseUp = () => {
    pan.current = null
    if (draft?.kind !== 'rect') return
    const w = Math.abs(draft.x1 - draft.x0)
    const h = Math.abs(draft.y1 - draft.y0)
    if (w > 4 && h > 4) {
      doc.addLayer('rect', { width: w, height: h, transform: { x: Math.min(draft.x0, draft.x1), y: Math.min(draft.y0, draft.y1), rotation: 0, scaleX: 1, scaleY: 1 } })
      onToolDone()
    }
    setDraft(null)
  }

  const { segments, exact } = template
  const g = template.guides
  const at = { x: camera.x, y: camera.y, scaleX: camera.scale, scaleY: camera.scale }
  const smoothing = camera.scale < 1

  // In the region view, Base layers keep the template regions and the others show at full opacity (ADR-0023).
  const userNodes = (regionColors: boolean) =>
    (regionColors ? doc.layers.filter((l) => l.region !== 'base').map((l) => ({ ...l, opacity: 1 })) : doc.layers).map((layer) => (
      <UserLayerNode
        key={layer.id}
        layer={layer}
        width={width}
        height={height}
        color={regionColors ? REGION_RGB[layer.region] : 'color' in layer ? layer.color : ''}
        image={layer.kind === 'image' && assetImages[layer.assetId] ? (regionColors ? regionShape(layer.assetId, assetImages[layer.assetId], REGION_TRIPLET[layer.region]) : assetImages[layer.assetId]) : undefined}
        interactive={!regionColors && tool === 'select'}
        document={doc}
      />
    ))

  return (
    <div
      ref={containerRef}
      className={styles.container}
      data-tool={tool}
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const files = [...e.dataTransfer.files]
        if (!files.length) return
        const box = containerRef.current!.getBoundingClientRect()
        onDropFiles(files, { x: (e.clientX - box.left - camera.x) / camera.scale, y: (e.clientY - box.top - camera.y) / camera.scale })
      }}
    >
      <svg className={styles.filters} aria-hidden>
        <filter id={FILTER_ID} colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            {(['feFuncR', 'feFuncG', 'feFuncB'] as const).map((Func) => (
              <Func key={Func} type="table" tableValues={segments ? tableValues(segments.table) : '0 1'} />
            ))}
          </feComponentTransfer>
        </filter>
      </svg>
      {hasSize && (
        <Stage
          width={size.width}
          height={size.height}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => (pan.current = null)}
          onDblClick={finishPolygon}
        >
          <Layer ref={paintRef} visible={view === 'livery'} imageSmoothingEnabled={smoothing}>
            {exact && <KonvaImage image={exact} listening={false} {...at} />}
            {segments && <KonvaImage image={segments.below} listening={false} visible={!exact} {...at} />}
            <Group ref={userRef} {...at} visible={!exact}>
              {userNodes(false)}
            </Group>
            {segments && <KonvaImage image={segments.above} listening={false} visible={!exact} {...at} />}
          </Layer>
          <Layer listening={false} visible={view === 'regions'} imageSmoothingEnabled={smoothing}>
            {g && <KonvaImage image={g.regions} {...at} />}
            <Group {...at}>{userNodes(true)}</Group>
          </Layer>
          <Layer listening={false} visible={guides.mask} opacity={0.75}>
            {g?.mask && <KonvaImage image={g.mask} {...at} />}
          </Layer>
          <Layer ref={wireRef} listening={false} visible={guides.wireframe}>
            {g?.wireframe && <KonvaImage image={g.wireframe} {...at} />}
          </Layer>
          <Layer>
            <Group {...at} listening={false}>
              {draft?.kind === 'rect' && (
                <Rect
                  x={Math.min(draft.x0, draft.x1)}
                  y={Math.min(draft.y0, draft.y1)}
                  width={Math.abs(draft.x1 - draft.x0)}
                  height={Math.abs(draft.y1 - draft.y0)}
                  stroke="#ffffff"
                  strokeWidth={2 / camera.scale}
                  dash={[8 / camera.scale, 6 / camera.scale]}
                />
              )}
              {draft?.kind === 'polygon' && (
                <Line points={[...draft.points, ...(draft.cursor ?? [])]} stroke="#ffffff" strokeWidth={2 / camera.scale} dash={[8 / camera.scale, 6 / camera.scale]} />
              )}
            </Group>
            <Transformer
              ref={transformerRef}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              rotationSnapTolerance={4}
              borderStroke="#ffffff"
              anchorStroke="#ffffff"
              anchorFill="#26262c"
              anchorSize={10}
              keepRatio={false}
            />
          </Layer>
        </Stage>
      )}
    </div>
  )
}

type NodeProps = {
  layer: UserLayer
  width: number
  height: number
  color: string
  /** For image layers: the decoded image, or its region shape in the region view. */
  image?: CanvasImageSource
  interactive: boolean
  document: DocumentProps
}

function UserLayerNode({ layer, width, height, color, image, interactive, document: doc }: NodeProps) {
  const movable = interactive && !layer.locked && layer.kind !== 'fill'
  const common = {
    id: layer.id,
    ...layer.transform,
    opacity: layer.opacity,
    visible: layer.visible,
    listening: movable,
    draggable: movable && doc.selectedId === layer.id,
    onMouseDown: () => movable && doc.select(layer.id),
    onDragStart: doc.beginGesture,
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => doc.updateLayer(layer.id, { transform: { ...layer.transform, x: e.target.x(), y: e.target.y() } }),
    onDragEnd: doc.endGesture,
    onTransformStart: doc.beginGesture,
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const n = e.target
      doc.updateLayer(layer.id, { transform: { x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() } })
      doc.endGesture()
    }
  }
  switch (layer.kind) {
    case 'fill':
      return <Rect {...common} x={0} y={0} rotation={0} scaleX={1} scaleY={1} width={width} height={height} fill={color} />
    case 'rect':
      return <Rect {...common} width={layer.width} height={layer.height} cornerRadius={layer.cornerRadius} fill={color} />
    case 'polygon':
      return <Line {...common} points={layer.points} closed fill={color} />
    case 'image':
      return image ? <KonvaImage {...common} image={image} width={layer.width} height={layer.height} /> : null
    case 'text':
      return (
        <Text
          {...common}
          text={layer.text}
          fontFamily={layer.fontFamily}
          fontSize={layer.fontSize}
          fill={color}
          stroke={layer.outline?.color}
          strokeWidth={layer.outline?.width ?? 0}
          fillAfterStrokeEnabled
        />
      )
  }
}

/** feFuncX tableValues for a 256-entry table (values 0..1). */
function tableValues(table: Uint8Array): string {
  return Array.from(table, (v) => (v / 255).toFixed(4)).join(' ')
}
