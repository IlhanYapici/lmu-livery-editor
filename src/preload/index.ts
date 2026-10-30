import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type LmuApi } from '../shared/api'

const api: LmuApi = {
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
  closeWindow: () => ipcRenderer.send(IPC.closeWindow)
}

contextBridge.exposeInMainWorld('lmu', api)
