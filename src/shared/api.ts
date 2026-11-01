// Contract between the preload script and the renderer.

import type { Language } from './i18n'

export type GameLocation =
  | { status: 'found'; gameDir: string; templatesDir: string; source: 'settings' | 'auto' | 'manual' }
  | { status: 'not-found' }
  | { status: 'invalid'; gameDir: string }
  | { status: 'cancelled' }

export type TemplateVariant = {
  /** The PSD file name. */
  id: string
  label: string
  path: string
  sizeBytes: number
}

export type Car = { id: string; name: string; variants: TemplateVariant[] }

export type Category = {
  /** Class code from the file names: HYPER, LMP2, LMP3, GT3, GTE, or OTHER. */
  id: string
  /** Class name, as on the game selection tabs: Hypercar, LMP2, LMP3, LMGT3, LMGTE. */
  name: string
  /** Class badge text, as in the game showroom: HY, P2, P3, GT3, GTE. */
  shortName: string
  cars: Car[]
}

export type Catalogue = Category[]

export type OpenProjectResult =
  | { status: 'opened'; handle: string; fileName: string; text: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

export type SaveProjectResult =
  | { status: 'saved'; handle: string; fileName: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

export type ExportResult =
  | { status: 'exported'; folder: string; backup: string | null }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

export interface LmuApi {
  /** The saved UI language, else the language of the system locale. */
  getLanguage(): Promise<Language>
  /** Saves the UI language; the main process uses it for its dialogs. */
  setLanguage(language: Language): Promise<void>
  locateGame(): Promise<GameLocation>
  chooseGameDir(): Promise<GameLocation>
  /** Templates of the saved game folder. Empty if no game folder is known. */
  listTemplates(): Promise<Catalogue>
  /** Opens a project file through a dialog. The handle stands for the file (ADR-0005). */
  openProject(): Promise<OpenProjectResult>
  /** Saves to the file of `handle`, or asks for a file ("Save as") when the handle is null. */
  saveProject(text: string, handle: string | null, suggestedName: string): Promise<SaveProjectResult>
  /** Called when the user closes the window with unsaved changes and selects "Save". Returns an unsubscribe function. */
  onSaveBeforeClose(callback: () => void): () => void
  /** Closes the window (after a save that the close dialog asked for). */
  closeWindow(): void
  /** Writes the two TGA files into the game (UserData\Liveries), after a backup of the old ones. */
  exportToGame(skin: ArrayBuffer, region: ArrayBuffer): Promise<ExportResult>
  /** Writes the two TGA files into a folder that the user selects. */
  exportToFolder(skin: ArrayBuffer, region: ArrayBuffer): Promise<ExportResult>
  /**
   * Called when an update is downloaded and ready to install, also when it was ready before the call.
   * Returns an unsubscribe function.
   */
  onUpdateReady(callback: (version: string) => void): () => void
  /** Closes the window (with the unsaved-changes question), then installs the update and starts the app again. */
  installUpdate(): void
}

export const IPC = {
  getLanguage: 'i18n:get',
  setLanguage: 'i18n:set',
  locateGame: 'game:locate',
  chooseGameDir: 'game:choose',
  listTemplates: 'templates:list',
  openProject: 'project:open',
  saveProject: 'project:save',
  saveBeforeClose: 'app:save-before-close',
  closeWindow: 'app:close',
  exportToGame: 'export:game',
  exportToFolder: 'export:folder',
  updateReady: 'update:ready',
  getReadyUpdate: 'update:get-ready',
  installUpdate: 'update:install'
} as const

/** Custom protocol for template files: `lmu-template://template/<file name>`. */
export const TEMPLATE_PROTOCOL = 'lmu-template'

export const templateUrl = (fileName: string) => `${TEMPLATE_PROTOCOL}://template/${encodeURIComponent(fileName)}`
