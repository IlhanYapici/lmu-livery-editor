import { _electron as electron, test as base, type ElectronApplication, type Page } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { writeTemplates } from '../fixtures/templates'

// Starts the built app with synthetic templates in a temporary game folder and its own user-data folder
// (LMU_USER_DATA_DIR), so the tests never touch the real game or settings. Dialogs are stubbed in the
// main process: the real IPC and file code runs, only the user's answer is fixed.

export type Folders = { root: string; game: string; userData: string; liveries: string }

type Options = { gameKnown: boolean; language: 'en' | 'fr' }

export type AppHandle = {
  electronApp: ElectronApplication
  page: Page
  folders: Folders
  /** The next open dialogs answer with these paths (one per call). */
  answerOpenDialogs: (...paths: string[]) => Promise<void>
  answerSaveDialogs: (...paths: string[]) => Promise<void>
  /** The next message boxes (sync and async) answer with these button indexes. */
  answerMessageBoxes: (...responses: number[]) => Promise<void>
  /** Starts the app again with the same folders (to test saved settings). */
  restart: () => Promise<void>
}

const repo = resolve(__dirname, '../..')

async function launch(folders: Folders) {
  const electronApp = await electron.launch({
    args: [repo],
    env: { ...process.env, LMU_USER_DATA_DIR: folders.userData, ELECTRON_ENABLE_LOGGING: '1' }
  })
  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  // The same size on every PC (a tiling window manager may give another one at start).
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 1400, height: 900 }))
  return { electronApp, page }
}

async function stub(electronApp: ElectronApplication, kind: 'open' | 'save' | 'box', answers: unknown[]) {
  await electronApp.evaluate(
    ({ dialog }, { kind, answers }) => {
      const queue = [...answers]
      const next = () => queue.shift()
      if (kind === 'open')
        dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [next() as string] })) as typeof dialog.showOpenDialog
      if (kind === 'save')
        dialog.showSaveDialog = (async () => ({ canceled: false, filePath: next() as string })) as typeof dialog.showSaveDialog
      if (kind === 'box') {
        dialog.showMessageBoxSync = (() => next() as number) as typeof dialog.showMessageBoxSync
        dialog.showMessageBox = (async () => ({ response: next() as number, checkboxChecked: false })) as typeof dialog.showMessageBox
      }
    },
    { kind, answers }
  )
}

export const test = base.extend<{ options: Options; app: AppHandle }>({
  options: [{ gameKnown: true, language: 'en' }, { option: true }],

  app: async ({ options }, provide) => {
    const root = await mkdtemp(join(tmpdir(), 'lmu-e2e-'))
    const game = join(root, 'Le Mans Ultimate')
    const folders: Folders = { root, game, userData: join(root, 'user-data'), liveries: join(game, 'UserData', 'Liveries') }
    await writeTemplates(join(game, 'support', 'LiveryTemplates'))
    await mkdir(join(game, 'UserData'), { recursive: true })
    await mkdir(folders.userData, { recursive: true })
    const settings = { language: options.language, ...(options.gameKnown ? { gameDir: game } : {}) }
    await writeFile(join(folders.userData, 'settings.json'), JSON.stringify(settings))

    let current = await launch(folders)
    const handle: AppHandle = {
      get electronApp() {
        return current.electronApp
      },
      get page() {
        return current.page
      },
      folders,
      answerOpenDialogs: (...paths) => stub(current.electronApp, 'open', paths),
      answerSaveDialogs: (...paths) => stub(current.electronApp, 'save', paths),
      answerMessageBoxes: (...responses) => stub(current.electronApp, 'box', responses),
      restart: async () => {
        await stub(current.electronApp, 'box', [1, 1, 1])
        await current.electronApp.close()
        current = await launch(folders)
      }
    }
    await provide(handle)
    // A test can leave unsaved changes: answer "Don't save" so the close question does not block the teardown.
    await handle.answerMessageBoxes(1, 1, 1).catch(() => undefined)
    await current.electronApp.close().catch(() => undefined)
    await rm(root, { recursive: true, force: true })
  }
})

export { expect } from '@playwright/test'

/** Selects the Ferrari 296 LMGT3 2025 template and waits until the editor has drawn it. */
export async function openFerrari(page: Page) {
  await page.getByRole('radio', { name: 'LMGT3' }).click()
  await page.getByRole('radio', { name: /Ferrari 296 LMGT3/ }).click()
  await page.getByRole('radio', { name: /^2025/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await base.expect(page.getByText(/Loaded in .* preview exact/)).toBeVisible()
}

/** The names in the "Your layers" list, top to bottom. */
export const layerNames = (page: Page) => page.getByRole('list', { name: 'Your layers' }).locator('li [title]').allTextContents()

/** Drags on the canvas between two points given as fractions of the canvas box. */
export async function dragOnCanvas(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.getByRole('region', { name: 'Canvas' }).boundingBox())!
  const point = ([fx, fy]: [number, number]) => [box.x + box.width * fx, box.y + box.height * fy] as const
  await page.mouse.move(...point(from))
  await page.mouse.down()
  await page.mouse.move(...point(to), { steps: 5 })
  await page.mouse.up()
}
