import { describe, expect, it } from 'vitest'
import { MAX_LAYERS, parseProject, serializeProject, type LiveryDocument, type UserLayer } from './project'

const TEMPLATE = 'Template_GT3_Ferrari296LMGT3_2025.psd'
const transform = { x: 10, y: 20, rotation: 15, scaleX: 1, scaleY: -1 }
const base = { visible: true, locked: false, opacity: 0.5, region: 'base' as const, color: '#d7262e', transform }

const doc: LiveryDocument = {
  version: 1,
  templateId: TEMPLATE,
  insertion: 2,
  templateVisibility: { '2/1': true, '5': false },
  layers: [
    { ...base, id: 'a', name: 'Fill 1', kind: 'fill' },
    { ...base, id: 'b', name: 'Rectangle 1', kind: 'rect', width: 400, height: 200, cornerRadius: 8 },
    { ...base, id: 'c', name: 'Polygon 1', kind: 'polygon', points: [0, 0, 100, 0, 50, 80], region: 'option1' },
    { ...base, id: 'd', name: 'Text 1', kind: 'text', text: '#24', fontFamily: 'Oswald', fontSize: 240, outline: { color: '#000000', width: 12 }, region: 'stickers' }
  ]
}

const fileWith = (change: (project: any) => void) => {
  const project = JSON.parse(serializeProject(doc, 28011489))
  change(project)
  return JSON.stringify(project)
}
/** Errors as short texts for the assertions: the code, or "path: message" for field errors. */
const errorsOf = (text: string) => {
  const result = parseProject(text)
  return result.ok ? [] : result.errors.map((e) => (e.code === 'field' ? `${e.path}: ${e.message}` : e.code === 'newerVersion' ? `newerVersion ${e.version}` : e.code))
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
    expect(errorsOf(fileWith((p) => (p.version = 2)))).toEqual(['newerVersion 2'])
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
})
