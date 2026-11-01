import { describe, expect, it } from 'vitest'
import {
  bytesToBase64,
  MAX_LAYERS,
  parseProject,
  serializeProject,
  sha256Hex,
  verifyAssets,
  type LiveryDocument,
  type UserLayer
} from './project'

const TEMPLATE = 'Template_GT3_Ferrari296LMGT3_2025.psd'
const transform = { x: 10, y: 20, rotation: 15, scaleX: 1, scaleY: -1 }
const base = { visible: true, locked: false, opacity: 0.5, region: 'base' as const, color: '#d7262e', transform }
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])

const doc: LiveryDocument = {
  version: 2,
  templateId: TEMPLATE,
  insertion: 2,
  templateVisibility: { '2/1': true, '5': false },
  layers: [
    { ...base, id: 'a', name: 'Fill 1', kind: 'fill' },
    { ...base, id: 'b', name: 'Rectangle 1', kind: 'rect', width: 400, height: 200, cornerRadius: 8 },
    { ...base, id: 'c', name: 'Polygon 1', kind: 'polygon', points: [0, 0, 100, 0, 50, 80], region: 'option1' },
    {
      ...base,
      id: 'd',
      name: 'Text 1',
      kind: 'text',
      text: '#24',
      fontFamily: 'Oswald',
      fontSize: 240,
      outline: { color: '#000000', width: 12 },
      region: 'stickers'
    }
  ],
  assets: {}
}

const fileWith = (change: (project: any) => void) => {
  const project = JSON.parse(serializeProject(doc, 28011489))
  change(project)
  return JSON.stringify(project)
}
/** Errors as short texts for the assertions: the code, or "path: message" for field errors. */
const errorsOf = (text: string) => {
  const result = parseProject(text)
  return result.ok
    ? []
    : result.errors.map((e) =>
        e.code === 'field' ? `${e.path}: ${e.message}` : e.code === 'newerVersion' ? `newerVersion ${e.version}` : e.code
      )
}

describe('project files', () => {
  it('reads back exactly what it saved', () => {
    const text = serializeProject(doc, 28011489, new Date('2026-10-30T15:00:00Z'))
    const result = parseProject(text)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.document).toEqual(doc)
    expect(result.project.template).toEqual({ id: TEMPLATE, sizeBytes: 28011489 })
    expect(result.project.savedAt).toBe('2026-10-30T15:00:00.000Z')
  })

  it('ignores unknown fields', () => {
    const result = parseProject(fileWith((p) => ((p.extra = 1), (p.document.layers[0].future = 'x'))))
    expect(result.ok && 'future' in result.project.document.layers[0]).toBe(false)
  })

  it('refuses files that are not projects, or from a newer version', () => {
    expect(errorsOf('not json')).toEqual(['notJson'])
    expect(errorsOf('{"format":"other"}')).toEqual(['notProject'])
    expect(errorsOf('[]')).toEqual(['notProject'])
    expect(errorsOf(fileWith((p) => (p.version = 3)))).toEqual(['newerVersion 3'])
  })

  it('gives the location of each error', () => {
    const errors = errorsOf(
      fileWith((p) => {
        p.document.layers[1].region = 'gold'
        p.document.layers[1].color = 'red'
        p.document.layers[2].points = [0, 0, 1]
        p.document.layers[3].fontFamily = 'Comic Sans MS'
        p.document.templateVisibility['../x'] = true
      })
    )
    expect(errors.some((e) => e.startsWith('document.layers[1].region:'))).toBe(true)
    expect(errors.some((e) => e.startsWith('document.layers[1].color:') && e.includes('validation.colour'))).toBe(true)
    expect(errors.some((e) => e.startsWith('document.layers[2].points:') && e.includes('validation.minPoints'))).toBe(true)
    expect(errors.some((e) => e.startsWith('document.layers[3].fontFamily:'))).toBe(true)
    expect(errors.some((e) => e.includes('templateVisibility'))).toBe(true)
  })

  it('refuses non-finite numbers, duplicate IDs, too many layers and a template mismatch', () => {
    // JSON has no Infinity; 1e999 parses to Infinity.
    expect(errorsOf(fileWith((p) => (p.document.layers[1].width = 'X')).replace('"X"', '1e999')).length).toBeGreaterThan(0)
    expect(errorsOf(fileWith((p) => (p.document.layers[1].id = 'a')))).toContain('document.layers: validation.uniqueIds')
    const many: UserLayer[] = Array.from({ length: MAX_LAYERS + 1 }, (_, i) => ({ ...base, id: `l${i}`, name: 'F', kind: 'fill' }))
    expect(errorsOf(fileWith((p) => (p.document.layers = many))).length).toBeGreaterThan(0)
    expect(errorsOf(fileWith((p) => (p.template.id = 'Template_GT3_Other.psd')))).toEqual(['templateMismatch'])
  })

  it('opens version 1 files: an empty assets table is added', () => {
    const v1 = fileWith((p) => {
      p.version = 1
      p.document.version = 1
      delete p.document.assets
    })
    const result = parseProject(v1)
    expect(result.ok && result.project.version).toBe(2)
    expect(result.ok && result.project.document.assets).toEqual({})
  })
})

describe('image assets', () => {
  const withImage = async (change?: (doc: LiveryDocument) => void) => {
    const id = await sha256Hex(PNG_BYTES)
    const image: UserLayer = {
      visible: true,
      locked: false,
      opacity: 1,
      region: 'stickers',
      transform,
      id: 'img',
      name: 'Logo',
      kind: 'image',
      assetId: id,
      width: 300,
      height: 100
    }
    const d: LiveryDocument = {
      ...doc,
      layers: [...doc.layers, image],
      assets: { [id]: { type: 'image/png', data: bytesToBase64(PNG_BYTES), width: 3, height: 1 } }
    }
    change?.(d)
    return { id, d }
  }

  it('saves and reads back an image layer and its asset', async () => {
    const { d } = await withImage()
    const result = parseProject(serializeProject(d, 1))
    expect(result.ok && result.project.document).toEqual(d)
    expect(result.ok && (await verifyAssets(result.project.document))).toEqual([])
  })

  it('does not save assets that no layer uses', async () => {
    const { d } = await withImage((x) => (x.layers = x.layers.filter((l) => l.kind !== 'image')))
    const result = parseProject(serializeProject(d, 1))
    expect(result.ok && result.project.document.assets).toEqual({})
  })

  it('refuses a missing asset, a bad asset ID, bad base64 and an unknown type', async () => {
    const { id, d } = await withImage()
    const text = serializeProject(d, 1)
    const change = (fn: (p: any) => void) => {
      const p = JSON.parse(text)
      fn(p)
      return errorsOf(JSON.stringify(p))
    }
    expect(change((p) => (p.document.assets = {}))).toContain('document.layers[4].assetId: validation.missingAsset')
    expect(change((p) => (p.document.assets = { 'not-a-hash': p.document.assets[id] })).some((e) => e.includes('validation.assetId'))).toBe(
      true
    )
    expect(change((p) => (p.document.assets[id].data = 'not base64!'))).toContain(`document.assets.${id}.data: validation.base64`)
    expect(change((p) => (p.document.assets[id].type = 'image/gif')).some((e) => e.startsWith(`document.assets.${id}.type`))).toBe(true)
  })

  it('finds assets whose bytes do not match their ID', async () => {
    const { id, d } = await withImage()
    d.assets[id] = { ...d.assets[id], data: bytesToBase64(new Uint8Array([1, 2, 3])) }
    expect(await verifyAssets(d)).toEqual([{ code: 'assetHash', id }])
  })
})
