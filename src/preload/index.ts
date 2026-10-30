import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type LmuApi } from '../shared/api'

const api: LmuApi = {
  locateGame: () => ipcRenderer.invoke(IPC.locateGame),
  chooseGameDir: () => ipcRenderer.invoke(IPC.chooseGameDir),
  listTemplates: () => ipcRenderer.invoke(IPC.listTemplates)
}

contextBridge.exposeInMainWorld('lmu', api)
