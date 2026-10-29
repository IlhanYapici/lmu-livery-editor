// Contract between the preload script and the renderer.

export type GameLocation =
  | { status: 'found'; gameDir: string; templatesDir: string; source: 'settings' | 'auto' | 'manual' }
  | { status: 'not-found' }
  | { status: 'invalid'; gameDir: string }
  | { status: 'cancelled' }

export interface LmuApi {
  locateGame(): Promise<GameLocation>
  chooseGameDir(): Promise<GameLocation>
}

export const IPC = {
  locateGame: 'game:locate',
  chooseGameDir: 'game:choose'
} as const
