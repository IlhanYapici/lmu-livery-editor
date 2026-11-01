import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// electron-updater defines `autoUpdater` with a getter. Node finds the named exports of a CommonJS module by
// a text scan that does not see it, so `(await import('electron-updater')).autoUpdater` is undefined in the
// installed app (v0.1.0 and v0.1.1 never updated). The main bundle must load it with require().
test('the main bundle loads electron-updater with require(), not import()', async () => {
  const bundle = await readFile(resolve(__dirname, '../../out/main/index.js'), 'utf8')
  expect(bundle).not.toMatch(/import\(\s*["']electron-updater["']\s*\)/)
  expect(bundle).toMatch(/require\(\s*["']electron-updater["']\s*\)/)
})
