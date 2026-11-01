import type { RegionId } from '../../../shared/psd/regions'
import type { FillLayer, ImageLayer, LayerKind, LiveryDocument, PolygonLayer, RectLayer, TextLayer, UserLayer } from '../../../shared/project'
import { i18n } from '../i18n'

// Factories for the livery document. The types and the validation are in src/shared/project.ts.
// Coordinates are template pixels (0..4096). Shapes keep their scale in `transform` (no baking).

export { FONTS } from '../../../shared/project'
export type { Asset, ImageLayer, LayerKind, LiveryDocument, Transform, UserLayer } from '../../../shared/project'

export function emptyDocument(templateId: string): LiveryDocument {
  return { version: 2, templateId, insertion: null, templateVisibility: {}, layers: [], assets: {} }
}

let counter = 0
export const newId = () => `layer-${Date.now().toString(36)}-${(counter++).toString(36)}`

/**
 * A new layer with default values. New layers start in the Base region, except images: they are mostly
 * logos and sponsors, which the templates put in the Stickers region.
 */
export function createLayer(kind: LayerKind, existing: UserLayer[], props: Partial<UserLayer> = {}): UserLayer {
  const count = existing.filter((l) => l.kind === kind).length + 1
  const base = {
    id: newId(),
    name: i18n.t('layers.defaultName', { kind: i18n.t(`layers.kind.${kind}`), count }),
    visible: true,
    locked: false,
    opacity: 1,
    region: 'base' as RegionId,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
  }
  switch (kind) {
    case 'fill':
      return { ...base, kind, color: '#1d1f24', ...props } as FillLayer
    case 'rect':
      return { ...base, kind, color: '#d7262e', width: 400, height: 200, cornerRadius: 0, ...props } as RectLayer
    case 'polygon':
      return { ...base, kind, color: '#d7262e', points: [], ...props } as PolygonLayer
    case 'text':
      return { ...base, kind, color: '#ffffff', text: '24', fontFamily: 'Bebas Neue', fontSize: 240, outline: null, ...props } as TextLayer
    case 'image':
      // The caller gives assetId, width and height (from the imported asset).
      return { ...base, kind, region: 'stickers', assetId: '', width: 1, height: 1, ...props } as ImageLayer
  }
}
