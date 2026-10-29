import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { IPC, type GameLocation } from '../shared/api'
import { loadSettings, saveSettings } from './settings'
import { findLiveryTemplatesDir, locateGameDir, readSteamPathFromRegistry } from './steam'

const settingsFile = () => join(app.getPath('userData'), 'settings.json')

async function locateGame(): Promise<GameLocation> {
  const settings = await loadSettings(settingsFile())
  if (settings.gameDir) {
    const templatesDir = await findLiveryTemplatesDir(settings.gameDir)
    if (templatesDir) return { status: 'found', gameDir: settings.gameDir, templatesDir, source: 'settings' }
  }

  const gameDir = await locateGameDir({
    platform: process.platform,
    home: homedir(),
    readRegistry: readSteamPathFromRegistry
  })
  if (!gameDir) return { status: 'not-found' }

  await saveSettings(settingsFile(), { ...settings, gameDir })
  const templatesDir = (await findLiveryTemplatesDir(gameDir))!
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
  const templatesDir = await findLiveryTemplatesDir(gameDir)
  if (!templatesDir) return { status: 'invalid', gameDir }

  const settings = await loadSettings(settingsFile())
  await saveSettings(settingsFile(), { ...settings, gameDir })
  return { status: 'found', gameDir, templatesDir, source: 'manual' }
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

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
