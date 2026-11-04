import { describe, expect, it } from 'vitest'
import { buildEntries, entryHtml, latestId, parseEntryFile, unseen } from './whatsNew'

const md = (kind: string, body = '## Title\n\nText.') => `---\nkind: ${kind}\n---\n\n${body}\n`
const both = (folder: string, kind = 'new', body?: string) => ({
  [`../../whats-new/${folder}/en.md`]: md(kind, body),
  [`../../whats-new/${folder}/fr.md`]: md(kind, body)
})

describe('whats-new entry files', () => {
  it('reads the kind and the Markdown after the front matter', () => {
    expect(parseEntryFile(md('fixed'))).toEqual({ kind: 'fixed', markdown: '## Title\n\nText.' })
    expect(parseEntryFile('---\r\nkind: new\r\n---\r\nText')).toEqual({ kind: 'new', markdown: 'Text' })
  })

  it('refuses a missing front matter, a bad kind, an unknown field or an empty text', () => {
    expect(() => parseEntryFile('## Title')).toThrow(/front matter/)
    expect(() => parseEntryFile(md('feature'))).toThrow(/kind must be/)
    expect(() => parseEntryFile('---\nkind: new\nversion: 1.0\n---\nText')).toThrow(/unknown front matter field: version/)
    expect(() => parseEntryFile('---\nkind: new\n---\n  \n')).toThrow(/empty/)
  })

  it('makes the entries newest first, with the images of each folder', () => {
    const entries = buildEntries(
      { ...both('0001-first'), ...both('0002-second', 'fixed') },
      { '../../whats-new/0002-second/shot.webp': '/assets/shot-abc.webp' }
    )
    expect(entries.map((e) => [e.id, e.kind, e.images])).toEqual([
      [2, 'fixed', { 'shot.webp': '/assets/shot-abc.webp' }],
      [1, 'new', {}]
    ])
  })

  it('accepts Windows paths', () => {
    const entries = buildEntries(
      { 'C:\\app\\whats-new\\0001-a\\en.md': md('new'), 'C:\\app\\whats-new\\0001-a\\fr.md': md('new') },
      { 'C:\\app\\whats-new\\0001-a\\shot.png': 'shot.png' }
    )
    expect(entries.map((e) => [e.folder, e.images])).toEqual([['0001-a', { 'shot.png': 'shot.png' }]])
  })

  it('refuses a bad folder name, id 0, a duplicate id, a missing language or two kinds', () => {
    expect(() => buildEntries(both('1-short'), {})).toThrow(/NNNN-name/)
    expect(() => buildEntries(both('0001-Upper'), {})).toThrow(/NNNN-name/)
    expect(() => buildEntries(both('0000-zero'), {})).toThrow(/1 or more/)
    expect(() => buildEntries({ ...both('0001-a'), ...both('0001-b') }, {})).toThrow(/another folder has the id 1/)
    expect(() => buildEntries({ '../../whats-new/0001-a/en.md': md('new') }, {})).toThrow(/fr\.md is missing/)
    expect(() => buildEntries({ '../../whats-new/0001-a/en.md': md('new'), '../../whats-new/0001-a/fr.md': md('fixed') }, {})).toThrow(
      /same kind/
    )
  })

  it('gives the unseen entries and the latest id', () => {
    const entries = buildEntries({ ...both('0001-a'), ...both('0002-b'), ...both('0003-c') }, {})
    expect(unseen(entries, 1).map((e) => e.id)).toEqual([3, 2])
    expect(unseen(entries, 3)).toEqual([])
    expect(latestId(entries)).toBe(3)
    expect(latestId([])).toBe(0)
  })
})

describe('whats-new HTML', () => {
  const entry = (body: string, images = {}) => ({ ...buildEntries(both('0001-a', 'new', body), {})[0], images })

  it('renders Markdown and changes an image name to its bundled URL', () => {
    const html = entryHtml(entry('## Title\n\n**Bold** ![Dialog](shot.webp)', { 'shot.webp': '/assets/shot-abc.webp' }), 'en')
    expect(html).toContain('<h2>Title</h2>')
    expect(html).toContain('<strong>Bold</strong>')
    expect(html).toContain('<img src="/assets/shot-abc.webp" alt="Dialog">')
  })

  it('refuses raw HTML, a link that is not https and an image that is not in the folder', () => {
    expect(() => entryHtml(entry('<script>alert(1)</script>'), 'en')).toThrow(/raw HTML is not permitted/)
    expect(() => entryHtml(entry('Text <img src=x onerror=alert(1)>'), 'en')).toThrow(/raw HTML is not permitted/)
    expect(() => entryHtml(entry('[site](http://example.com)'), 'en')).toThrow(/https/)
    expect(() => entryHtml(entry('[site](javascript:alert(1))'), 'en')).toThrow(/https/)
    expect(() => entryHtml(entry('![x](missing.webp)'), 'en')).toThrow(/no image "missing.webp"/)
    expect(entryHtml(entry('[site](https://example.com)'), 'en')).toContain('<a href="https://example.com">site</a>')
  })
})
