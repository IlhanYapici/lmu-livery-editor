import { dragOnCanvas, expect, layerNames, openFerrari, test } from './fixtures'

test('draws shapes, edits a field, undoes and redoes', async ({ app }) => {
  const { page } = app
  await openFerrari(page)

  await page.keyboard.press('r')
  await dragOnCanvas(page, [0.45, 0.35], [0.7, 0.55])
  await page.keyboard.press('t')
  await dragOnCanvas(page, [0.6, 0.6], [0.6, 0.6])
  await expect.poll(() => layerNames(page)).toEqual(['Text 1', 'Rectangle 1'])

  // A real window has the focus, so a number field commits on Enter.
  await page.getByRole('list', { name: 'Your layers' }).getByText('Rectangle 1').click()
  const width = page.getByLabel('Layer properties').getByRole('spinbutton', { name: 'Width' })
  await width.fill('1234')
  await width.press('Enter')
  await expect(width).toHaveValue('1234')

  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Control+z')
  await expect(width).not.toHaveValue('1234')
  await page.keyboard.press('Control+y')
  await expect(width).toHaveValue('1234')
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  await expect.poll(() => layerNames(page)).toEqual(['Rectangle 1'])
})

test('imports an image and warns when it is enlarged too much', async ({ app }) => {
  const { page } = app
  await openFerrari(page)
  // A 2 × 1 px PNG, generated here: no third-party logo.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwH4QZYAwAOOcF+2PwQIIAAAAASUVORK5CYII=', 'base64')
  await page.locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png })
  await expect.poll(() => layerNames(page)).toEqual(['logo'])
  await expect(page.getByLabel('Layer properties').getByText('Source image: 2 × 1 px')).toBeVisible()
  // Natural size 2 px: shown at 2 px, no warning. 10 px is 5 times larger.
  await expect(page.getByRole('img', { name: /enlarged/ })).toHaveCount(0)
  const width = page.getByLabel('Layer properties').getByRole('spinbutton', { name: 'Width' })
  await width.fill('10')
  await width.press('Enter')
  await expect(page.getByRole('img', { name: /enlarged 5 times/ })).toHaveCount(2)
})
