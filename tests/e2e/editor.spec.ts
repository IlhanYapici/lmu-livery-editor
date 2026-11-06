import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decodeTga } from '../../src/shared/tga'
import { AREA } from '../fixtures/templates'
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

test('paints a linear gradient and exports it', async ({ app }) => {
  const { page, folders } = app
  await openFerrari(page)
  await page.getByRole('button', { name: 'Add fill' }).click()
  const panel = page.getByLabel('Layer properties')
  await panel.getByRole('radio', { name: 'Linear' }).click()

  // Top to bottom, red to green, both opaque. Not blue: the base paint of the synthetic template is blue.
  const angle = panel.getByRole('spinbutton', { name: 'Angle °' })
  await angle.fill('90')
  await angle.press('Enter')
  const colour = panel.getByRole('textbox', { name: 'Colour' })
  for (const [stop, hex] of [
    ['Stop 1, 0 %', 'ff0000'],
    ['Stop 2, 100 %', '00ff00']
  ]) {
    await panel.getByRole('button', { name: stop }).click()
    await colour.fill(hex)
    await colour.press('Enter')
    await panel.getByRole('slider', { name: /^Alpha/ }).focus()
    await page.keyboard.press('End')
  }
  await expect(panel.getByText('Alpha 100 %')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Stop 1, 0 %' })).toHaveCSS('background-color', 'rgb(255, 0, 0)')

  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('alertdialog', { name: 'Export to the game' }).getByRole('button', { name: 'Export' }).click()
  await expect(page.getByRole('alertdialog', { name: 'Livery exported' })).toBeVisible()

  // A column that no template layer paints over. The template Levels change the values, not their order.
  const { width, rgba } = decodeTga(new Uint8Array(await readFile(join(folders.liveries, 'customskin.tga'))))
  const pixel = (x: number, y: number) => Array.from(rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 3))
  const x = AREA.offCar.x + 1
  const [top, bottom] = [pixel(x, 0), pixel(x, width - 1)]
  expect(top[0]).toBeGreaterThan(Math.max(top[1], top[2]) + 100)
  expect(bottom[1]).toBeGreaterThan(Math.max(bottom[0], bottom[2]) + 100)
})
