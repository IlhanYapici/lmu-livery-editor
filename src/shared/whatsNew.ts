import { Marked, type Token } from 'marked'
import type { Language } from './i18n'

// "What's new" entries (ADR-0033). Each entry is a folder in src/renderer/whats-new: `NNNN-name/en.md`,
// `fr.md` and optional images. The number is the entry id: the app keeps the highest id that the user saw.

export type EntryKind = 'new' | 'fixed'

export type Entry = {
  id: number
  /** The folder name, for error messages. */
  folder: string
  kind: EntryKind
  /** The Markdown text without the front matter, for each language. */
  markdown: Record<Language, string>
  /** Image file name → bundled URL. */
  images: Record<string, string>
}

export const FOLDER_PATTERN = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*$/
export const IMAGE_PATTERN = /\.(webp|png)$/
export const MAX_IMAGE_BYTES = 300 * 1024

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/

/** Reads the front matter (`kind: new` or `kind: fixed`) and returns the Markdown after it. */
export function parseEntryFile(text: string): { kind: EntryKind; markdown: string } {
  const match = FRONT_MATTER.exec(text)
  if (!match) throw new Error('the file must start with a front matter block (--- kind: new ---)')
  const fields = new Map(
    match[1]
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => {
        const [key, ...rest] = line.split(':')
        return [key.trim(), rest.join(':').trim()] as const
      })
  )
  const kind = fields.get('kind')
  if (kind !== 'new' && kind !== 'fixed') throw new Error(`kind must be "new" or "fixed", not "${kind ?? ''}"`)
  const unknown = [...fields.keys()].filter((key) => key !== 'kind')
  if (unknown.length) throw new Error(`unknown front matter field: ${unknown.join(', ')}`)
  const markdown = text.slice(match[0].length).trim()
  if (!markdown) throw new Error('the text after the front matter is empty')
  return { kind, markdown }
}

/**
 * Makes the entries from the bundled files. Keys are paths that end with `<folder>/<file>` (as from
 * import.meta.glob; `\` also works, for Windows paths in the tests). Newest entry first. Throws on a bad folder name, a duplicate id, a missing language
 * or two languages with a different kind.
 */
export function buildEntries(texts: Record<string, string>, imageUrls: Record<string, string>): Entry[] {
  const folders = new Map<string, { files: Map<string, string>; images: Record<string, string> }>()
  const folderOf = (path: string) => {
    const [folder, file] = path.split(/[\\/]/).slice(-2)
    if (!folders.has(folder)) folders.set(folder, { files: new Map(), images: {} })
    return { entry: folders.get(folder)!, file }
  }
  for (const [path, text] of Object.entries(texts)) {
    const { entry, file } = folderOf(path)
    entry.files.set(file, text)
  }
  for (const [path, url] of Object.entries(imageUrls)) {
    const { entry, file } = folderOf(path)
    entry.images[file] = url
  }

  const ids = new Set<number>()
  const entries = [...folders].map(([folder, { files, images }]): Entry => {
    const fail = (message: string) => new Error(`whats-new/${folder}: ${message}`)
    const match = FOLDER_PATTERN.exec(folder)
    if (!match) throw fail('the folder name must be NNNN-name (4 digits, then lowercase words with dashes)')
    const id = Number(match[1])
    if (id === 0) throw fail('the id must be 1 or more')
    if (ids.has(id)) throw fail(`another folder has the id ${id}`)
    ids.add(id)

    const parsed = {} as Record<Language, { kind: EntryKind; markdown: string }>
    for (const language of ['en', 'fr'] as const) {
      const text = files.get(`${language}.md`)
      if (text === undefined) throw fail(`${language}.md is missing`)
      try {
        parsed[language] = parseEntryFile(text)
      } catch (error) {
        throw fail(`${language}.md: ${(error as Error).message}`)
      }
    }
    if (parsed.en.kind !== parsed.fr.kind) throw fail('en.md and fr.md must have the same kind')
    return { id, folder, kind: parsed.en.kind, markdown: { en: parsed.en.markdown, fr: parsed.fr.markdown }, images }
  })
  return entries.sort((a, b) => b.id - a.id)
}

/** The entries that the user did not see yet. */
export const unseen = (entries: Entry[], lastSeenId: number): Entry[] => entries.filter((entry) => entry.id > lastSeenId)

/** The highest id, or 0 when there is no entry. */
export const latestId = (entries: Entry[]): number => Math.max(0, ...entries.map((entry) => entry.id))

/**
 * The entry as HTML, before sanitizing. Our own text only: raw HTML is not permitted, links must use https,
 * and an image must be a file of the entry folder (its name becomes the bundled URL). Throws on a break.
 */
export function entryHtml(entry: Entry, language: Language): string {
  const fail = (message: string) => new Error(`whats-new/${entry.folder}/${language}.md: ${message}`)
  const marked = new Marked({
    async: false,
    walkTokens: (token: Token) => {
      if (token.type === 'html') throw fail(`raw HTML is not permitted: ${token.raw.trim()}`)
      if (token.type === 'link' && !token.href.startsWith('https://')) throw fail(`a link must start with https://: ${token.href}`)
      if (token.type === 'image') {
        const url = entry.images[token.href]
        if (!url) throw fail(`no image "${token.href}" in the folder`)
        token.href = url
      }
    }
  })
  return marked.parse(entry.markdown[language]) as string
}
