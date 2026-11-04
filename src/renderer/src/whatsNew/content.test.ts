import { describe, expect, it } from 'vitest'
import { ENTRIES, safeEntryHtml } from './content'

describe('bundled whats-new entries (import.meta.glob)', () => {
  it('finds the entries, with their text', () => {
    // tests/integration/whatsNew.test.ts checks the folder itself.
    expect(ENTRIES.length).toBeGreaterThan(0)
    expect(ENTRIES.every((e) => e.folder && e.markdown.en && e.markdown.fr)).toBe(true)
  })

  it('gives escaped text, not raw HTML, when there is no DOM for DOMPurify (Node)', () => {
    const entry = { ...ENTRIES[0], markdown: { en: '## A & <b>', fr: '' } }
    expect(safeEntryHtml(entry, 'en')).toBe('## A &amp; &lt;b&gt;')
  })
})
