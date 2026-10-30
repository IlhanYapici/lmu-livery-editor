import type { RegionId } from '../../../shared/psd/regions'
import type { Visibility } from '../../../shared/psd/templateRender'

// The livery document: what the user makes, and what a project file saves.
// Coordinates are template pixels (0..4096). Shapes keep their scale in `transform` (no baking).

export type Transform = { x: number; y: number; rotation: number; scaleX: number; scaleY: number }

type LayerBase = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  region: RegionId
  color: string
  transform: Transform
}

export type FillLayer = LayerBase & { kind: 'fill' }
export type RectLayer = LayerBase & { kind: 'rect'; width: number; height: number; cornerRadius: number }
export type PolygonLayer = LayerBase & { kind: 'polygon'; points: number[] }
export type TextLayer = LayerBase & {
  kind: 'text'
  text: string
  fontFamily: string
  fontSize: number
  outline: { color: string; width: number } | null
}

export type UserLayer = FillLayer | RectLayer | PolygonLayer | TextLayer
export type LayerKind = UserLayer['kind']

export type LiveryDocument = {
  version: 1
  /** The template file name. */
  templateId: string
  /** Template content layers below the user layers; null = the template default. */
  insertion: number | null
  /** Template visibility overrides, by layer index path. */
  templateVisibility: Visibility
  /** Bottom to top. */
  layers: UserLayer[]
}

export const FONTS = ['Bebas Neue', 'Oswald', 'Roboto'] as const

export function emptyDocument(templateId: string): LiveryDocument {
  return { version: 1, templateId, insertion: null, templateVisibility: {}, layers: [] }
}

const KIND_NAME: Record<LayerKind, string> = { fill: 'Fill', rect: 'Rectangle', polygon: 'Polygon', text: 'Text' }

let counter = 0
export const newId = () => `layer-${Date.now().toString(36)}-${(counter++).toString(36)}`

/** A new layer with default values. All new layers start in the Base region. */
export function createLayer(kind: LayerKind, existing: UserLayer[], props: Partial<UserLayer> = {}): UserLayer {
  const count = existing.filter((l) => l.kind === kind).length + 1
  const base = {
    id: newId(),
    name: `${KIND_NAME[kind]} ${count}`,
    visible: true,
    locked: false,
    opacity: 1,
    region: 'base' as RegionId,
    color: '#d7262e',
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
  }
  switch (kind) {
    case 'fill':
      return { ...base, kind, color: '#1d1f24', ...props } as FillLayer
    case 'rect':
      return { ...base, kind, width: 400, height: 200, cornerRadius: 0, ...props } as RectLayer
    case 'polygon':
      return { ...base, kind, points: [], ...props } as PolygonLayer
    case 'text':
      return { ...base, kind, color: '#ffffff', text: '24', fontFamily: 'Bebas Neue', fontSize: 240, outline: null, ...props } as TextLayer
  }
}
