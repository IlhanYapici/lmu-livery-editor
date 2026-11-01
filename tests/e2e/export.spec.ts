import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readTgaHeader, tgaSize } from '../../src/shared/tga'
import { SIZE } from '../fixtures/templates'
import { dragOnCanvas, expect, openFerrari, test } from './fixtures'

test('exports the two TGA files into the game, with a backup of the previous ones', async ({ app }) => {
  const { page, folders } = app
  await openFerrari(page)
  await page.keyboard.press('r')
  await dragOnCanvas(page, [0.45, 0.35], [0.7, 0.55])

  for (let round = 1; round <= 2; round++) {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await page.getByRole('alertdialog', { name: 'Export to the game' }).getByRole('button', { name: 'Export' }).click()
    const report = page.getByRole('alertdialog', { name: 'Livery exported' })
    await expect(report).toBeVisible()
    await report.getByRole('button', { name: 'OK' }).click()
  }

  for (const name of ['customskin.tga', 'customskin_region.tga']) {
    const bytes = new Uint8Array(await readFile(join(folders.liveries, name)))
    expect(bytes.length).toBe(tgaSize(SIZE, SIZE))
    expect(readTgaHeader(bytes)).toEqual({ width: SIZE, height: SIZE, bitsPerPixel: 24, topOrigin: false })
  }
  // The second export moved the first files to one backup folder.
  const backups = await readdir(join(folders.liveries, 'Backups'))
  expect(backups).toHaveLength(1)
  expect((await readdir(join(folders.liveries, 'Backups', backups[0]))).sort()).toEqual(['customskin.tga', 'customskin_region.tga'])
})
