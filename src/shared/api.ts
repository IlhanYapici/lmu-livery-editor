// Contract between the preload script and the renderer.

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

export type Category = { id: string; name: string; cars: Car[] }

export type Catalogue = Category[]

export interface LmuApi {
  locateGame(): Promise<GameLocation>
  chooseGameDir(): Promise<GameLocation>
  /** Templates of the saved game folder. Empty if no game folder is known. */
  listTemplates(): Promise<Catalogue>
}

export const IPC = {
  locateGame: 'game:locate',
  chooseGameDir: 'game:choose',
  listTemplates: 'templates:list'
} as const
