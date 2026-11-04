import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildEntries, entryHtml, FOLDER_PATTERN, IMAGE_PATTERN, MAX_IMAGE_BYTES } from '../../src/shared/whatsNew'

// The real "What's new" folder (ADR-0033): the rules of the entries, plus the files and image sizes.
const root = resolve(__dirname, '../../src/renderer/whats-new')
const folders = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())
const texts: Record<string, string> = {}
const images: Record<string, string> = {}
for (const folder of folders)
  for (const file of readdirSync(join(root, folder.name))) {
    const path = join(root, folder.name, file)
    if (file.endsWith('.md')) texts[path] = readFileSync(path, 'utf8')
    else if (IMAGE_PATTERN.test(file)) images[path] = file
  }

describe('src/renderer/whats-new', () => {
  it('has only entry folders, each with en.md, fr.md and WebP or PNG images of 300 KB or less', () => {
    expect(readdirSync(root).filter((name) => !folders.some((d) => d.name === name))).toEqual([])
    for (const folder of folders) {
      expect(folder.name).toMatch(FOLDER_PATTERN)
      for (const file of readdirSync(join(root, folder.name))) {
        expect(`${folder.name}/${file}`).toMatch(/\/(en\.md|fr\.md|[a-z0-9-]+\.(webp|png))$/)
        if (IMAGE_PATTERN.test(file))
          expect(statSync(join(root, folder.name, file)).size, `${folder.name}/${file}`).toBeLessThanOrEqual(MAX_IMAGE_BYTES)
      }
    }
  })

  it('renders every entry in both languages, each starting with a ## title', () => {
    const entries = buildEntries(texts, images)
    expect(entries.length).toBe(folders.length)
    for (const entry of entries) for (const language of ['en', 'fr'] as const) expect(entryHtml(entry, language)).toMatch(/^<h2>/)
  })
})
