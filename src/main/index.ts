import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IPC, TEMPLATE_PROTOCOL, type Catalogue, type GameLocation } from '../shared/api'
import { loadSettings, saveSettings } from './settings'
import { findLiveryTemplatesDir, locateGameDir, nodeHost } from './steam'
import { resolveTemplateUrl } from './templateProtocol'
import { scanTemplates } from './templates'

const settingsFile = () => join(app.getPath('userData'), 'settings.json')

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
    title: 'Select the Le Mans Ultimate install folder',
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

  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else window.loadFile(join(__dirname, '../renderer/index.html'))
}

protocol.registerSchemesAsPrivileged([
  { scheme: TEMPLATE_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
])

ipcMain.handle(IPC.locateGame, () => locateGame())
ipcMain.handle(IPC.chooseGameDir, (event) => chooseGameDir(BrowserWindow.fromWebContents(event.sender)))
ipcMain.handle(IPC.listTemplates, () => listTemplates())

app.whenReady().then(() => {
  protocol.handle(TEMPLATE_PROTOCOL, serveTemplate)
  createWindow()
})
app.on('window-all-closed', () => app.quit())
