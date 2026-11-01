import { describe, expect, it } from 'vitest'
import { createDocumentStore, hasUnsavedChanges, HISTORY_LIMIT } from './documentStore'

const names = (store: ReturnType<typeof createDocumentStore>) => store.getState().doc.layers.map((l) => l.name)

describe('documentStore', () => {
  it('adds layers with default names, the Base region, and selects the new layer', () => {
    const store = createDocumentStore('Template_GT3_Ferrari296LMGT3_2025.psd')
    const s = store.getState()
    s.addLayer('rect')
    s.addLayer('rect')
    const text = s.addLayer('text')
    expect(names(store)).toEqual(['Rectangle 1', 'Rectangle 2', 'Text 1'])
    expect(store.getState().doc.layers.every((l) => l.region === 'base')).toBe(true)
    expect(store.getState().selectedId).toBe(text)
  })

  it('adds a layer at a given index in one history step', () => {
    const store = createDocumentStore('t')
    const s = store.getState()
    s.addLayer('rect', { name: 'A' })
    const steps = store.getState().past.length
    s.addLayer('fill', { name: 'Fill' }, 0)
    expect(names(store)).toEqual(['Fill', 'A'])
    expect(store.getState().past.length).toBe(steps + 1)
  })

  it('reorders, duplicates above the source, and removes with selection update', () => {
    const store = createDocumentStore('t')
    const s = store.getState()
    const a = s.addLayer('rect', { name: 'A' })
    s.addLayer('rect', { name: 'B' })
    s.addLayer('rect', { name: 'C' })
    s.moveLayer(a, 2)
    expect(names(store)).toEqual(['B', 'C', 'A'])
    s.duplicateLayer(a)
    expect(names(store)).toEqual(['B', 'C', 'A', 'A copy'])
    const copy = store.getState().selectedId!
    s.removeLayer(copy)
    expect(names(store)).toEqual(['B', 'C', 'A'])
    expect(store.getState().selectedId).toBeNull()
  })

  it('undoes and redoes each action, and a new action clears the redo list', () => {
    const store = createDocumentStore('t')
    const s = store.getState()
    const a = s.addLayer('rect', { name: 'A' })
    s.updateLayer(a, { color: '#00ff00' })
    s.undo()
    expect(store.getState().doc.layers[0]).not.toMatchObject({ color: '#00ff00' })
    s.redo()
    expect(store.getState().doc.layers[0]).toMatchObject({ color: '#00ff00' })
    s.undo()
    s.undo()
    expect(names(store)).toEqual([])
    expect(store.getState().selectedId).toBeNull()
    s.redo()
    s.addLayer('text')
    expect(store.getState().future).toEqual([])
  })

  it('makes one history step for a whole gesture', () => {
    const store = createDocumentStore('t')
    const s = store.getState()
    const a = s.addLayer('rect')
    const pastBefore = store.getState().past.length
    s.beginGesture()
    for (let x = 1; x <= 30; x++) s.updateLayer(a, { transform: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } })
    s.endGesture()
    expect(store.getState().past.length).toBe(pastBefore + 1)
    s.undo()
    expect(store.getState().doc.layers[0].transform.x).toBe(0)
  })

  it('records template insertion and visibility in the history', () => {
    const store = createDocumentStore('t')
    const s = store.getState()
    s.setInsertion(3)
    s.setTemplateVisible('2/1', true)
    expect(store.getState().doc.templateVisibility).toEqual({ '2/1': true })
    s.undo()
    s.undo()
    expect(store.getState().doc.insertion).toBeNull()
  })

  it(`keeps at most ${HISTORY_LIMIT} steps`, () => {
    const store = createDocumentStore('t')
    const s = store.getState()
    const a = s.addLayer('rect')
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s.updateLayer(a, { opacity: i / 200 })
    expect(store.getState().past.length).toBe(HISTORY_LIMIT)
  })

  it('tracks unsaved changes; undo back to the saved document clears them', () => {
    const store = createDocumentStore('t')
    const s = store.getState()
    expect(hasUnsavedChanges(store.getState())).toBe(false)
    const a = s.addLayer('rect')
    expect(hasUnsavedChanges(store.getState())).toBe(true)
    s.markSaved(store.getState().doc, 'h1', 'livery.lmulivery')
    expect(hasUnsavedChanges(store.getState())).toBe(false)
    s.updateLayer(a, { color: '#00ff00' })
    expect(hasUnsavedChanges(store.getState())).toBe(true)
    s.undo()
    expect(hasUnsavedChanges(store.getState())).toBe(false)
    expect(store.getState().handle).toBe('h1')
  })

  it('starts from an opened project without unsaved changes', () => {
    const doc = { version: 2 as const, templateId: 't', insertion: 3, templateVisibility: {}, layers: [], assets: {} }
    const store = createDocumentStore('t', { doc, handle: 'h', fileName: 'a.lmulivery' })
    expect(store.getState().doc).toBe(doc)
    expect(hasUnsavedChanges(store.getState())).toBe(false)
    expect(store.getState().past).toEqual([])
  })
})
