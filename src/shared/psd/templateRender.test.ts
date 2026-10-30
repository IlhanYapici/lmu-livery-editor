import type { Layer, PixelData, Psd } from 'ag-psd'
import { describe, expect, it } from 'vitest'
import type { LayerDecoder } from './composite'
import { classifyTemplate } from './roles'
import { outlineTemplate, renderGuides, renderSegments } from './templateRender'

const W = 2
const H = 1

function solid(name: string, rgba: number[], extra: Partial<Layer> = {}): Layer {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i)
  return { name, left: 0, top: 0, right: W, bottom: H, imageData: { width: W, height: H, data }, ...extra }
}

const decoder: LayerDecoder = {
  pixels: (l) => l.imageData as PixelData | undefined,
  mask: (l) => l.mask?.imageData as PixelData | undefined
}

const levels = (out: [number, number], extra: Partial<Layer> = {}): Layer => ({
  name: 'Levels 1',
  adjustment: { type: 'levels', channels: [{ shadowInput: 0, highlightInput: 255, shadowOutput: out[0], highlightOutput: out[1], midtoneInput: 1 }] },
  mask: { left: 0, top: 0, right: 0, bottom: 0, defaultColor: 255 },
  ...extra
})

/** Ferrari 296 LMGT3 layout, simplified. */
function ferrari(extraAbove: Layer[] = []): Psd {
  return {
    width: W,
    height: H,
    children: [
      solid('base', [200, 200, 200, 255]),
      { name: 'carbon', children: [solid('Shape 502', [20, 20, 20, 255])], hidden: true },
      { name: 'Number Plates', children: [{ name: 'WEC', children: [solid('plate', [255, 255, 255, 255])] }, { name: 'LM', children: [], hidden: true }] },
      ...extraAbove,
      levels([10, 225]),
      solid('Mask(Disable for export)', [0, 0, 0, 255]),
      { name: 'Region', hidden: true, children: [solid('Region 0', [0, 0, 0, 255])] },
      solid('Wireframe', [255, 255, 255, 255], { blendMode: 'screen', opacity: 0.6 })
    ]
  }
}

describe('outlineTemplate', () => {
  it('lists content layers with index paths and sub-groups, and puts the user layers above carbon', () => {
    const psd = ferrari()
    const outline = outlineTemplate(psd, classifyTemplate(psd))
    expect(outline.content.map((n) => `${n.path}:${n.name}:${n.kind}`)).toEqual(['0:base:layer', '1:carbon:group', '2:Number Plates:group', '3:Levels 1:adjustment'])
    expect(outline.content[2].children.map((c) => `${c.path}:${c.name}:${c.hidden}`)).toEqual(['2/0:WEC:false', '2/1:LM:true'])
    expect(outline.defaultInsertion).toBe(2)
    expect(outline.maxInsertion).toBe(3)
  })
})

describe('renderSegments', () => {
  it('splits the template at the insertion point and turns the Levels into a table', () => {
    const psd = ferrari()
    const s = renderSegments(psd, classifyTemplate(psd), { insertion: 2, visibility: {} }, decoder)
    expect(Array.from(s.below.data.slice(0, 4))).toEqual([200, 200, 200, 255])
    expect(Array.from(s.above.data.slice(0, 4))).toEqual([255, 255, 255, 255])
    expect([s.table[0], s.table[255]]).toEqual([10, 225])
    expect(s.fastIsExact).toBe(true)
  })

  it('applies visibility overrides by path', () => {
    const psd = ferrari()
    const s = renderSegments(psd, classifyTemplate(psd), { insertion: 2, visibility: { '1': true, '2/0': false } }, decoder)
    expect(Array.from(s.below.data.slice(0, 4))).toEqual([20, 20, 20, 255])
    expect(s.above.data[3]).toBe(0)
  })

  it('is not exact when a Hue/Saturation group sits above the user layers (the "Clamp" group)', () => {
    const clamp: Layer = { name: 'Clamp', children: [{ name: 'Hue/Saturation 1', adjustment: { type: 'hue/saturation', master: { hue: 0, saturation: -10, lightness: 0 } } }] }
    const psd = ferrari([clamp])
    expect(renderSegments(psd, classifyTemplate(psd), { insertion: 2, visibility: {} }, decoder).fastIsExact).toBe(false)
  })

  it('is not exact when a content layer sits above an adjustment, or blends in another mode', () => {
    const psd1 = ferrari()
    psd1.children!.splice(4, 0, solid('sticker over levels', [1, 2, 3, 255]))
    expect(renderSegments(psd1, classifyTemplate(psd1), { insertion: 2, visibility: {} }, decoder).fastIsExact).toBe(false)

    const psd2 = ferrari([solid('wire-ish', [9, 9, 9, 255], { blendMode: 'exclusion' })])
    expect(renderSegments(psd2, classifyTemplate(psd2), { insertion: 2, visibility: {} }, decoder).fastIsExact).toBe(false)
  })
})

describe('renderGuides', () => {
  it('draws the guides plain, whatever their saved blend mode, opacity and visibility', () => {
    const psd = ferrari()
    const g = renderGuides(psd, classifyTemplate(psd), decoder)
    expect(Array.from(g.wireframe!.data.slice(0, 4))).toEqual([255, 255, 255, 255])
    expect(Array.from(g.mask!.data.slice(0, 4))).toEqual([0, 0, 0, 255])
    expect(Array.from(g.regions.data.slice(0, 4))).toEqual([0, 0, 0, 255])
  })
})
