import { expect, test } from './fixtures'

test.describe('game folder', () => {
  test.use({ options: { gameKnown: false, language: 'en' } })

  test('asks for the game folder, then lists the templates by category, car and variant', async ({ app }) => {
    const { page } = app
    await expect(page.getByText('Le Mans Ultimate not found')).toBeVisible()
    await app.answerOpenDialogs(app.folders.game)
    await page.getByRole('button', { name: 'Select folder' }).click()

    await expect(page.getByRole('radio', { name: 'Hypercar' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'LMGT3' })).toBeVisible()
    await page.getByRole('radio', { name: 'LMGT3' }).click()
    await expect(page.getByRole('radiogroup', { name: 'Car' }).getByRole('radio')).toHaveText([/Aston Martin Vantage/, /Ferrari 296 LMGT3/])
    await page.getByRole('radio', { name: 'Hypercar' }).click()
    await expect(page.getByRole('radiogroup', { name: 'Car' }).getByRole('radio')).toHaveText([/Aston Martin Valkyrie/, /Lamborghini SC63/])
  })
})

test.describe('about', () => {
  test.use({ options: { gameKnown: true, language: 'en' } })

  test('shows the app version in the window title and in the game folder dialog', async ({ app }) => {
    const { version } = (await import('../../package.json', { with: { type: 'json' } })).default
    const title = await app.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())
    expect(title).toBe(`LMU Livery Editor ${version}`)

    await app.page.getByRole('button', { name: 'Game folder' }).click()
    const about = app.page.getByRole('region', { name: 'About' })
    await expect(about).toContainText(`version ${version}`)
    await expect(about).toContainText('not made or approved by Motorsport Games')
  })
})
