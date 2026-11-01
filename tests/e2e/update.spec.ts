import { expect, test } from './fixtures'

test.use({ options: { gameKnown: true, language: 'en' } })

// The real check needs an installed app and a GitHub release (manual test, ADR-0030). Here the main
// process sends the "update ready" message as electron-updater would.
test('shows the update banner; "Later" hides it', async ({ app }) => {
  const banner = app.page.getByRole('status').filter({ hasText: 'is ready to install' })
  await expect(app.page.getByRole('button', { name: 'Continue' })).toBeVisible()
  await expect(banner).toBeHidden()

  await app.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('update:ready', '9.9.9'))
  await expect(banner).toContainText('Version 9.9.9 is ready to install.')
  await expect(banner.getByRole('button', { name: 'Restart now' })).toBeVisible()

  await banner.getByRole('button', { name: 'Later' }).click()
  await expect(banner).toBeHidden()
})

test('shows the banner when the update was ready before the window subscribed', async ({ app }) => {
  await expect(app.page.getByRole('button', { name: 'Continue' })).toBeVisible()
  // As if the download had ended before the window loaded: the main process answers with a ready version.
  await app.electronApp.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('update:get-ready')
    ipcMain.handle('update:get-ready', () => '9.9.9')
  })
  await app.page.reload()
  await expect(app.page.getByRole('status').filter({ hasText: 'is ready to install' })).toContainText('Version 9.9.9')
})
