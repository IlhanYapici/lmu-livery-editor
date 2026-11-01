import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  IPC,
  TEMPLATE_PROTOCOL,
  type Catalogue,
  type ExportResult,
  type GameLocation,
  type OpenProjectResult,
  type SaveProjectResult
} from '../shared/api'
import { checkGameTga, liveryFilesExist, writeLiveryFiles } from './liveryExport'
import { createI18n, isLanguage, languageForLocale, type Language } from '../shared/i18n'
import { PROJECT_EXTENSION } from '../shared/project'
import { displayName, ensureFolder, ProjectHandles, readProjectFile, writeAtomic } from './projectFiles'
import { loadSettings, saveSettings } from './settings'
import { findLiveryTemplatesDir, locateGameDir, nodeHost } from './steam'
import { resolveTemplateUrl } from './templateProtocol'
import { scanTemplates } from './templates'

const settingsFile = () => join(app.getPath('userData'), 'settings.json')

/** Translations for the dialogs and messages of the main process (ADR-0024). */
const i18n = createI18n('en')
const t = i18n.t

async function getLanguage(): Promise<Language> {
  const { language } = await loadSettings(settingsFile())
  return isLanguage(language) ? language : languageForLocale(app.getLocale())
}

async function setLanguage(language: unknown): Promise<void> {
  if (!isLanguage(language)) return
  await saveSettings(settingsFile(), { ...(await loadSettings(settingsFile())), language })
  await i18n.changeLanguage(language)
}

async function locateGame(): Promise<GameLocation> {
  const settings = await loadSettings(settingsFile())
  if (settings.gameDir) {
    const templatesDir = await findLiveryTemplatesDir(nodeHost, settings.gameDir)
    if (templatesDir) return { status: 'found', gameDir: settings.gameDir, templatesDir, source: 'settings' }
  }

  // Auto-detection reads the Windows registry. On other systems the user selects the folder.
  const gameDir = process.platform === 'win32' ? await locateGameDir(nodeHost) : null
  if (!gameDir) return { status: 'not-found' }

  await saveSettings(settingsFile(), { ...settings, gameDir })
  const templatesDir = (await findLiveryTemplatesDir(nodeHost, gameDir))!
  return { status: 'found', gameDir, templatesDir, source: 'auto' }
}

async function chooseGameDir(window: BrowserWindow | null): Promise<GameLocation> {
  const options: Electron.OpenDialogOptions = {
    title: t('dialogs.chooseGameFolder'),
    properties: ['openDirectory']
  }
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return { status: 'cancelled' }

  const gameDir = result.filePaths[0]
  const templatesDir = await findLiveryTemplatesDir(nodeHost, gameDir)
  if (!templatesDir) return { status: 'invalid', gameDir }

  const settings = await loadSettings(settingsFile())
  await saveSettings(settingsFile(), { ...settings, gameDir })
  return { status: 'found', gameDir, templatesDir, source: 'manual' }
}

/** The last catalogue sent to the renderer. The template protocol serves only its files. */
let catalogue: Catalogue = []

async function listTemplates(): Promise<Catalogue> {
  const { gameDir } = await loadSettings(settingsFile())
  const templatesDir = gameDir && (await findLiveryTemplatesDir(nodeHost, gameDir))
  catalogue = templatesDir ? await scanTemplates(templatesDir) : []
  return catalogue
}

async function serveTemplate(request: Request): Promise<Response> {
  const path = resolveTemplateUrl(request.url, catalogue)
  if (!path) return new Response('Not a catalogue template', { status: 404 })
  const file = await net.fetch(pathToFileURL(path).toString())
  // The renderer worker runs on another origin (file:// or the dev server), so allow CORS reads.
  return new Response(file.body, {
    status: file.status,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String((await stat(path)).size),
      'Access-Control-Allow-Origin': '*'
    }
  })
}

const projects = new ProjectHandles()
const projectFilters = () => [{ name: t('dialogs.projectFilter'), extensions: [PROJECT_EXTENSION] }]
const projectFolder = () => ensureFolder(join(app.getPath('documents'), 'LMU Liveries'))

async function openProject(window: BrowserWindow | null): Promise<OpenProjectResult> {
  const options: Electron.OpenDialogOptions = {
    title: t('dialogs.openProject'),
    defaultPath: await projectFolder(),
    filters: projectFilters(),
    properties: ['openFile']
  }
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return { status: 'cancelled' }
  const path = result.filePaths[0]
  try {
    const read = await readProjectFile(path)
    if (!read.ok)
      return { status: 'error', message: t('errors.fileTooLarge', { size: read.tooLarge.sizeMB, limit: read.tooLarge.limitMB }) }
    return { status: 'opened', handle: projects.register(path), fileName: displayName(path), text: read.text }
  } catch (error) {
    return { status: 'error', message: t('errors.cannotRead', { error: (error as Error).message }) }
  }
}

async function saveProject(
  window: BrowserWindow | null,
  text: string,
  handle: string | null,
  suggestedName: string
): Promise<SaveProjectResult> {
  let path = handle ? projects.path(handle) : null
  if (!path) {
    const safeName = suggestedName.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Livery'
    const options: Electron.SaveDialogOptions = {
      title: t('dialogs.saveProject'),
      defaultPath: join(await projectFolder(), `${safeName}.${PROJECT_EXTENSION}`),
      filters: projectFilters()
    }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { status: 'cancelled' }
    path = result.filePath.endsWith(`.${PROJECT_EXTENSION}`) ? result.filePath : `${result.filePath}.${PROJECT_EXTENSION}`
  }
  try {
    await writeAtomic(path, text)
    return { status: 'saved', handle: projects.register(path), fileName: displayName(path) }
  } catch (error) {
    return { status: 'error', message: t('errors.cannotWrite', { error: (error as Error).message }) }
  }
}

/** Bytes from the renderer: an ArrayBuffer or a typed array, else null. */
function toBytes(value: unknown): Uint8Array | null {
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return null
}

function checkFiles(skin: unknown, region: unknown): { skin: Uint8Array; region: Uint8Array } | { error: string } {
  const s = toBytes(skin)
  const r = toBytes(region)
  if (!s || !r) return { error: t('errors.badRequest') }
  const problem = checkGameTga(s, 'customskin.tga') ?? checkGameTga(r, 'customskin_region.tga')
  if (!problem) return { skin: s, region: r }
  const [file, ...detail] = problem.split(': ')
  return { error: t('errors.badTga', { file, error: detail.join(': ') }) }
}

async function exportToGame(skin: unknown, region: unknown): Promise<ExportResult> {
  const files = checkFiles(skin, region)
  if ('error' in files) return { status: 'error', message: files.error }
  const { gameDir } = await loadSettings(settingsFile())
  if (!gameDir) return { status: 'error', message: t('errors.gameFolderUnknown') }
  const folder = join(gameDir, 'UserData', 'Liveries')
  try {
    const backup = await writeLiveryFiles(folder, files.skin, files.region, { backup: true })
    return { status: 'exported', folder, backup }
  } catch (error) {
    return { status: 'error', message: t('errors.cannotWrite', { error: (error as Error).message }) }
  }
}

async function exportToFolder(window: BrowserWindow | null, skin: unknown, region: unknown): Promise<ExportResult> {
  const files = checkFiles(skin, region)
  if ('error' in files) return { status: 'error', message: files.error }
  const options: Electron.OpenDialogOptions = {
    title: t('dialogs.exportFolder'),
    defaultPath: await projectFolder(),
    properties: ['openDirectory', 'createDirectory']
  }
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return { status: 'cancelled' }
  const folder = result.filePaths[0]
  if (await liveryFilesExist(folder)) {
    const box: Electron.MessageBoxOptions = {
      type: 'question',
      message: t('dialogs.replaceTitle'),
      detail: t('dialogs.replaceText'),
      buttons: [t('dialogs.replace'), t('app.cancel')],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    }
    const answer = window ? await dialog.showMessageBox(window, box) : await dialog.showMessageBox(box)
    if (answer.response !== 0) return { status: 'cancelled' }
  }
  try {
    await writeLiveryFiles(folder, files.skin, files.region, { backup: false })
    return { status: 'exported', folder, backup: null }
  } catch (error) {
    return { status: 'error', message: t('errors.cannotWrite', { error: (error as Error).message }) }
  }
}

/** The renderer blocks the close when there are unsaved changes; this asks the user what to do. */
function confirmClose(window: BrowserWindow, event: Electron.Event): void {
  const choice = dialog.showMessageBoxSync(window, {
    type: 'warning',
    title: t('dialogs.unsavedCloseTitle'),
    message: t('dialogs.unsavedCloseMessage'),
    detail: t('dialogs.unsavedCloseDetail'),
    buttons: [t('app.save'), t('app.dontSave'), t('app.cancel')],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  })
  if (choice === 1) event.preventDefault() // Ignore the renderer block: close without saving.
  else if (choice === 0) window.webContents.send(IPC.saveBeforeClose)
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#101114',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.webContents.on('will-prevent-unload', (event) => confirmClose(window, event))

  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else window.loadFile(join(__dirname, '../renderer/index.html'))
}

protocol.registerSchemesAsPrivileged([
  { scheme: TEMPLATE_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
])

ipcMain.handle(IPC.getLanguage, () => getLanguage())
ipcMain.handle(IPC.setLanguage, (_event, language: unknown) => setLanguage(language))
ipcMain.handle(IPC.locateGame, () => locateGame())
ipcMain.handle(IPC.chooseGameDir, (event) => chooseGameDir(BrowserWindow.fromWebContents(event.sender)))
ipcMain.handle(IPC.listTemplates, () => listTemplates())
ipcMain.handle(IPC.openProject, (event) => openProject(BrowserWindow.fromWebContents(event.sender)))
ipcMain.handle(IPC.saveProject, (event, text: unknown, handle: unknown, suggestedName: unknown) =>
  typeof text === 'string' && (handle === null || typeof handle === 'string') && typeof suggestedName === 'string'
    ? saveProject(BrowserWindow.fromWebContents(event.sender), text, handle, suggestedName)
    : { status: 'error', message: t('errors.badRequest') }
)
ipcMain.handle(IPC.exportToGame, (_event, skin: unknown, region: unknown) => exportToGame(skin, region))
ipcMain.handle(IPC.exportToFolder, (event, skin: unknown, region: unknown) =>
  exportToFolder(BrowserWindow.fromWebContents(event.sender), skin, region)
)
ipcMain.on(IPC.closeWindow, (event) => BrowserWindow.fromWebContents(event.sender)?.close())

app.whenReady().then(async () => {
  await i18n.changeLanguage(await getLanguage())
  protocol.handle(TEMPLATE_PROTOCOL, serveTemplate)
  createWindow()
})
app.on('window-all-closed', () => app.quit())
