import { readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, test } from './fixtures'

// "What's new" (ADR-0033). The real entries of src/renderer/whats-new are in the build.
const latest = Math.max(...readdirSync(resolve(__dirname, '../../src/renderer/whats-new')).map((name) => Number(name.slice(0, 4))))
const savedSeen = async (userData: string) => JSON.parse(await readFile(join(userData, 'settings.json'), 'utf8')).whatsNewSeen

test.describe('new install', () => {
  test.use({ options: { gameKnown: false, language: 'en', whatsNewSeen: 'new-install' } })

  test('shows no "What\'s new" and saves the latest id', async ({ app }) => {
    await expect(app.page.getByText('Le Mans Ultimate not found')).toBeVisible()
    await expect.poll(() => savedSeen(app.folders.userData)).toBe(latest)
    await expect(app.page.getByRole('dialog', { name: "What's new" })).toBeHidden()
  })
})

test.describe('update from a version before "What\'s new"', () => {
  test.use({ options: { gameKnown: true, language: 'en', whatsNewSeen: null } })

  test('shows every entry once, as sanitized HTML', async ({ app }) => {
    const dialog = app.page.getByRole('dialog', { name: "What's new" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('article')).toHaveCount(latest)
    await expect(dialog.getByRole('heading', { level: 2, name: 'Animations' })).toBeVisible()
    // Real DOMPurify output (Chromium has a DOM), not the escaped-text fallback.
    await expect(dialog).not.toContainText('##')
    await expect(dialog.locator('strong').first()).toBeVisible()

    await dialog.getByRole('button', { name: 'OK' }).click()
    await expect(dialog).toBeHidden()
    await expect.poll(() => savedSeen(app.folders.userData)).toBe(latest)
    await app.restart()
    await expect(app.page.getByRole('button', { name: 'Continue' })).toBeVisible()
    await expect(app.page.getByRole('dialog', { name: "What's new" })).toBeHidden()
  })
})

test.describe('update with one new entry', () => {
  test.use({ options: { gameKnown: true, language: 'fr', whatsNewSeen: latest - 1 } })

  test('shows only the unseen entry, in French', async ({ app }) => {
    const dialog = app.page.getByRole('dialog', { name: 'Nouveautés' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('article')).toHaveCount(1)
    await expect(dialog.getByRole('article').getByRole('heading', { level: 2, name: 'Nouveautés' })).toBeVisible()
    await dialog.getByRole('button', { name: 'OK' }).press('Escape')
    await expect(dialog).toBeHidden()
    await expect.poll(() => savedSeen(app.folders.userData)).toBe(latest)
  })
})

test.describe('history', () => {
  test.use({ options: { gameKnown: true, language: 'en' } })

  test('the About section shows every entry', async ({ app }) => {
    const { page } = app
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: "What's new" })).toBeHidden()
    await page.getByRole('button', { name: 'Game folder' }).click()
    await page.getByRole('button', { name: "What's new" }).click()
    await expect(page.getByRole('dialog', { name: 'Game folder' })).toBeHidden()
    const dialog = page.getByRole('dialog', { name: "What's new" })
    await expect(dialog.getByRole('article')).toHaveCount(latest)
  })
})
