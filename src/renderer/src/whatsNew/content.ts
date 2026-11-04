import DOMPurify from 'dompurify'
import type { Language } from '../../../shared/i18n'
import { buildEntries, entryHtml, type Entry } from '../../../shared/whatsNew'

// The entries, bundled at build time (ADR-0033). Nothing is read from the disk or the network at runtime.
const texts = import.meta.glob<string>('../../whats-new/*/*.md', { query: '?raw', import: 'default', eager: true })
const images = import.meta.glob<string>('../../whats-new/*/*.{webp,png}', { import: 'default', eager: true })

export const ENTRIES = buildEntries(texts, images)

/**
 * Sanitized HTML for the dialog (DOMPurify, as the marked documentation recommends). Without a DOM,
 * DOMPurify returns its input unchanged: this function then gives escaped text, never raw HTML.
 */
export function safeEntryHtml(entry: Entry, language: Language): string {
  if (!DOMPurify.isSupported) return escapeHtml(entry.markdown[language])
  return DOMPurify.sanitize(entryHtml(entry, language))
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
