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
    let active = true
    const listener = (_event: Electron.IpcRendererEvent, version: string) => callback(version)
    ipcRenderer.on(IPC.updateReady, listener)
    // A small download can end before the window subscribes: ask for a version that is already ready.
    void ipcRenderer.invoke(IPC.getReadyUpdate).then((version: string | null) => active && version && callback(version))
    return () => {
      active = false
      ipcRenderer.removeListener(IPC.updateReady, listener)
    }
  },
  installUpdate: () => ipcRenderer.send(IPC.installUpdate),
  getWhatsNewSeen: (latest) => ipcRenderer.invoke(IPC.getWhatsNewSeen, latest),
  setWhatsNewSeen: (id) => ipcRenderer.invoke(IPC.setWhatsNewSeen, id)
}

contextBridge.exposeInMainWorld('lmu', api)
