import { expect, test } from './fixtures'

test('switches to French and keeps the choice after a restart', async ({ app }) => {
  await expect(app.page.getByRole('button', { name: 'Continue' })).toBeVisible()
  await app.page.getByRole('radio', { name: 'FR' }).click()
  await expect(app.page.getByRole('button', { name: 'Poursuivre' })).toBeVisible()
  await expect(app.page.locator('html')).toHaveAttribute('lang', 'fr')

  await app.restart()
  await expect(app.page.getByRole('button', { name: 'Poursuivre' })).toBeVisible()
})
