import type { RegionId } from '../../../shared/psd/regions'
import type { FillLayer, LayerKind, LiveryDocument, PolygonLayer, RectLayer, TextLayer, UserLayer } from '../../../shared/project'

// Factories for the livery document. The types and the validation are in src/shared/project.ts.
// Coordinates are template pixels (0..4096). Shapes keep their scale in `transform` (no baking).

export { FONTS } from '../../../shared/project'
export type { LayerKind, LiveryDocument, Transform, UserLayer } from '../../../shared/project'

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
