import { writePsd, type Layer, type Psd } from 'ag-psd'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Synthetic livery templates (ADR-0027). Real templates are game content and stay out of the repository
// (ADR-0002), so tests generate small PSD files with the structures that the audit of the 60 game templates
// found. Geometry (64 × 64 px) is fixed, so tests can check exact pixels.

export const SIZE = 64

/** Known places, in template pixels. */
export const AREA = {
  carbon: { x: 0, y: 0, w: 16, h: 16 },
  wecPlate: { x: 40, y: 40, w: 16, h: 8 },
  lmPlate: { x: 40, y: 48, w: 16, h: 8 },
  sticker: { x: 20, y: 40, w: 8, h: 8 },
  /** Off the car: the mask guide covers it. */
  offCar: { x: 60, y: 0, w: 4, h: SIZE }
} as const

/** The base paint comes from a colour overlay effect, as in many game templates. */
export const BASE_COLOUR = [32, 80, 160] as const

type Rect = { x: number; y: number; w: number; h: number }

const pixels = (fn: (x: number, y: number) => number[] | null) => {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) data.set(fn(x, y) ?? [0, 0, 0, 0], (y * SIZE + x) * 4)
  return { width: SIZE, height: SIZE, data }
}
const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
const layer = (name: string, fn: (x: number, y: number) => number[] | null, extra: Partial<Layer> = {}): Layer => ({
  name,
  left: 0,
  top: 0,
  right: SIZE,
  bottom: SIZE,
  imageData: pixels(fn),
  ...extra
})
const fill = (name: string, rgba: number[], extra: Partial<Layer> = {}) => layer(name, () => rgba, extra)
const rect = (name: string, r: Rect, rgba: number[], extra: Partial<Layer> = {}) =>
  layer(name, (x, y) => (inside(r, x, y) ? rgba : null), extra)
/** A layer mask: white where `fn` is true. */
const mask = (fn: (x: number, y: number) => boolean, defaultColor = 0): Layer['mask'] => ({
  left: 0,
  top: 0,
  right: SIZE,
  bottom: SIZE,
  defaultColor,
  imageData: pixels((x, y) => (fn(x, y) ? [255, 255, 255, 255] : [0, 0, 0, 255]))
})
const levels = (name: string, out: [number, number]): Layer => ({
  name,
  adjustment: {
    type: 'levels',
    channels: [{ shadowInput: 0, highlightInput: 255, shadowOutput: out[0], highlightOutput: out[1], midtoneInput: 1 }]
  }
})

function base(name: string): Layer {
  const [r, g, b] = BASE_COLOUR
  return fill(name, [200, 200, 200, 255], {
    effects: { solidFill: [{ enabled: true, color: { r, g, b }, opacity: 1, blendMode: 'normal' }] }
  })
}

function content(baseName = 'base'): Layer[] {
  return [
    base(baseName),
    { name: 'carbon', children: [rect('Shape 502', AREA.carbon, [20, 20, 20, 255])] },
    {
      name: "Number Plates - Don't move!",
      children: [
        { name: 'WEC', children: [rect('plate', AREA.wecPlate, [255, 255, 255, 255])] },
        { name: 'LM', hidden: true, children: [rect('plate', AREA.lmPlate, [255, 212, 0, 255])] }
      ]
    },
    { name: 'Class Stickers', children: [rect('LMGT3', AREA.sticker, [0, 150, 57, 255])] }
  ]
}

/** Region layers: flat colours shaped by masks; the layer number is not the region (ADR-0013). */
function regions(groupName = 'Region'): Layer {
  return {
    name: groupName,
    hidden: true,
    children: [
      fill('Region 0', [0, 0, 0, 255]),
      fill('Region 1', [255, 0, 0, 255], { mask: mask((x, y) => inside(AREA.carbon, x, y)) }),
      fill('Region 2', [0, 0, 255, 255], { mask: mask((x, y) => inside(AREA.wecPlate, x, y)) }),
      fill('Region 3', [255, 255, 255, 255], { mask: mask(() => false) }),
      fill('Region 4', [0, 255, 0, 255], { mask: { left: 0, top: 0, right: 0, bottom: 0, defaultColor: 0 } })
    ]
  }
}

const maskGuide = (name = 'Mask(Disable for export)') => fill(name, [0, 0, 0, 255], { mask: mask((x, y) => inside(AREA.offCar, x, y)) })
const wireframe = (name: string) =>
  layer(name, (_x, y) => (y % 8 === 0 ? [255, 255, 255, 255] : null), { blendMode: 'screen', opacity: 0.6 })

export type TemplateKind = 'ferrari' | 'aston' | 'lambo' | 'valkyrie'

/** The template layout, and the file name under which the game would ship it. */
export const TEMPLATES: Record<TemplateKind, { fileName: string; layers: () => Layer[] }> = {
  // Ferrari 296 LMGT3: names as expected, Levels 10–225.
  ferrari: {
    fileName: 'Template_GT3_Ferrari296LMGT3_2025.psd',
    layers: () => [...content(), levels('Levels 1', [10, 225]), maskGuide(), regions(), wireframe('Wireframe')]
  },
  // Aston Martin Vantage: the wireframe is named "Background"; found from its position.
  aston: {
    fileName: 'Template_GT3_AstonMartinVantage_2025.psd',
    layers: () => [...content('Base'), levels('Levels 1', [10, 210]), maskGuide(), regions(), wireframe('Background')]
  },
  // Lamborghini SC63: Levels and Hue/Saturation in a pass-through "Clamp" group with a group mask; "Maks" typo.
  lambo: {
    fileName: 'Template_HYPER_LamborghiniSC63.psd',
    layers: () => [
      ...content('Base'),
      {
        name: 'Clamp',
        mask: mask(() => true),
        children: [
          levels('Levels 1', [5, 210]),
          { name: 'Hue/Saturation 1', adjustment: { type: 'hue/saturation', master: { hue: 0, saturation: -10, lightness: 0 } } }
        ]
      },
      maskGuide('Maks(Disable for export)'),
      regions(),
      wireframe('Wireframe')
    ]
  },
  // Aston Martin Valkyrie: no mask guide, "Regions" group, "UVW" wireframe.
  valkyrie: {
    fileName: 'Template_HYPER_AstonMartinValkyrie.psd',
    layers: () => [...content('Color Fill 2'), levels('Levels 1', [10, 210]), regions('Regions'), wireframe('UVW')]
  }
}

export function makeTemplate(kind: TemplateKind): Uint8Array {
  const psd: Psd = { width: SIZE, height: SIZE, children: TEMPLATES[kind].layers() }
  return new Uint8Array(writePsd(psd, { generateThumbnail: false }))
}

/** Writes all synthetic templates into `folder`; returns their paths. */
export async function writeTemplates(folder: string): Promise<string[]> {
  await mkdir(folder, { recursive: true })
  return Promise.all(
    (Object.keys(TEMPLATES) as TemplateKind[]).map(async (kind) => {
      const path = join(folder, TEMPLATES[kind].fileName)
      await writeFile(path, makeTemplate(kind))
      return path
    })
  )
}
