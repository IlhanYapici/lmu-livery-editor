import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type LmuApi } from '../shared/api'

const api: LmuApi = {
  getLanguage: () => ipcRenderer.invoke(IPC.getLanguage),
  setLanguage: (language) => ipcRenderer.invoke(IPC.setLanguage, language),
  locateGame: () => ipcRenderer.invoke(IPC.locateGame),
  chooseGameDir: () => ipcRenderer.invoke(IPC.chooseGameDir),
  listTemplates: () => ipcRenderer.invoke(IPC.listTemplates),
  openProject: () => ipcRenderer.invoke(IPC.openProject),
  saveProject: (text, handle, suggestedName) => ipcRenderer.invoke(IPC.saveProject, text, handle, suggestedName),
  onSaveBeforeClose: (callback) => {
    const listener = () => callback()
    ipcRenderer.on(IPC.saveBeforeClose, listener)
    return () => ipcRenderer.removeListener(IPC.saveBeforeClose, listener)
  },
  closeWindow: () => ipcRenderer.send(IPC.closeWindow),
  exportToGame: (skin, region) => ipcRenderer.invoke(IPC.exportToGame, skin, region),
  exportToFolder: (skin, region) => ipcRenderer.invoke(IPC.exportToFolder, skin, region),
  onUpdateReady: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, version: string) => callback(version)
    ipcRenderer.on(IPC.updateReady, listener)
    return () => ipcRenderer.removeListener(IPC.updateReady, listener)
  },
  installUpdate: () => ipcRenderer.send(IPC.installUpdate)
}

contextBridge.exposeInMainWorld('lmu', api)
