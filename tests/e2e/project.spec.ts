import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseProject } from '../../src/shared/project'
import { dragOnCanvas, expect, layerNames, openFerrari, test } from './fixtures'

test('saves, reopens, and asks about unsaved changes', async ({ app }) => {
  const { page, folders } = app
  const file = join(folders.root, 'My livery.lmulivery')
  await openFerrari(page)
  await page.keyboard.press('r')
  await dragOnCanvas(page, [0.45, 0.35], [0.7, 0.55])
  await expect(page.locator('header')).toContainText('Untitled livery •')

  await app.answerSaveDialogs(file)
  await page.keyboard.press('Control+s')
  await expect(page.locator('header')).toContainText('My livery.lmulivery')
  await expect(page.locator('header')).not.toContainText('•')
  const saved = parseProject(await readFile(file, 'utf8'))
  expect(saved.ok && saved.project.document.layers.map((l) => l.name)).toEqual(['Rectangle 1'])

  // Back without changes: no question.
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()

  await app.answerOpenDialogs(file)
  await page.getByRole('button', { name: 'Open project' }).click()
  await expect(page.getByText(/Loaded in/)).toBeVisible()
  await expect.poll(() => layerNames(page)).toEqual(['Rectangle 1'])

  // A change, then Back: the app asks; Cancel keeps the editor.
  await page.getByRole('list', { name: 'Your layers' }).getByText('Rectangle 1').click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Back' }).click()
  const question = page.getByRole('alertdialog', { name: 'Unsaved changes' })
  await expect(question).toBeVisible()
  await question.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('header')).toContainText('My livery.lmulivery •')
})

test('closing the window with unsaved changes asks the main process; "Don\'t save" closes', async ({ app }) => {
  const { page, electronApp } = app
  await openFerrari(page)
  await page.keyboard.press('r')
  await dragOnCanvas(page, [0.45, 0.35], [0.7, 0.55])
  await app.answerMessageBoxes(1) // "Don't save"
  const closed = electronApp.waitForEvent('close')
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  await closed
})

test('a save to the known file shows a spinner on the Save button until the file is written', async ({ app }) => {
  const { page, folders } = app
  await openFerrari(page)
  await page.keyboard.press('r')
  await dragOnCanvas(page, [0.45, 0.35], [0.7, 0.55])
  await app.answerSaveDialogs(join(folders.root, 'Slow.lmulivery'))
  await page.keyboard.press('Control+s')
  await expect(page.locator('header')).toContainText('Slow.lmulivery')

  // The next save waits until the test releases it.
  await app.electronApp.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('project:save')
    ipcMain.handle(
      'project:save',
      (_event, _text, handle: string) =>
        new Promise((resolve) => {
          ;(globalThis as { releaseSave?: () => void }).releaseSave = () => resolve({ status: 'saved', handle, fileName: 'Slow.lmulivery' })
        })
    )
  })
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await save.click()
  await expect(save).toHaveAttribute('aria-busy', 'true')
  await expect(save).toBeDisabled()
  await app.electronApp.evaluate(() => (globalThis as { releaseSave?: () => void }).releaseSave?.())
  await expect(save).not.toHaveAttribute('aria-busy')
  await expect(save).toBeEnabled()
})
