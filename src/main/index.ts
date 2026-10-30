import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { IPC, type Catalogue, type GameLocation } from '../shared/api'
import { loadSettings, saveSettings } from './settings'
import { findLiveryTemplatesDir, locateGameDir, nodeHost } from './steam'
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

async function listTemplates(): Promise<Catalogue> {
  const { gameDir } = await loadSettings(settingsFile())
  const templatesDir = gameDir && (await findLiveryTemplatesDir(nodeHost, gameDir))
  return templatesDir ? scanTemplates(templatesDir) : []
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

ipcMain.handle(IPC.locateGame, () => locateGame())
ipcMain.handle(IPC.chooseGameDir, (event) => chooseGameDir(BrowserWindow.fromWebContents(event.sender)))
ipcMain.handle(IPC.listTemplates, () => listTemplates())

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
