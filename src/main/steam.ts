import { execFile } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { parseVdf, type VdfObject } from './vdf'

export const GAME_FOLDER_NAME = 'Le Mans Ultimate'

/** Library paths listed in a libraryfolders.vdf file (new and old formats). */
export function libraryPathsFromVdf(text: string): string[] {
  const root = parseVdf(text)
  const folders = Object.entries(root).find(([key]) => key.toLowerCase() === 'libraryfolders')?.[1]
  if (!folders || typeof folders === 'string') return []

  const paths: string[] = []
  for (const entry of Object.values(folders)) {
    // New format: "0" { "path" "..." }. Old format: "1" "D:\\SteamLibrary".
    if (typeof entry === 'string') paths.push(entry)
    else if (typeof (entry as VdfObject).path === 'string') paths.push((entry as VdfObject).path as string)
  }
  return paths
}

export function steamRootCandidates(platform: NodeJS.Platform, home: string, registryPath: string | null): string[] {
  if (platform === 'win32') {
    return [registryPath, 'C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam'].filter(
      (p): p is string => !!p
    )
  }
  if (platform === 'darwin') return [join(home, 'Library/Application Support/Steam')]
  return [
    join(home, '.local/share/Steam'),
    join(home, '.steam/steam'),
    join(home, '.steam/root'),
    join(home, '.var/app/com.valvesoftware.Steam/.local/share/Steam'),
    join(home, 'snap/steam/common/.local/share/Steam')
  ]
}

/** Finds a child entry by name, ignoring case (Linux file systems are case-sensitive). */
async function findChild(dir: string, name: string): Promise<string | null> {
  try {
    const entries = await readdir(dir)
    const match = entries.find((e) => e.toLowerCase() === name.toLowerCase())
    return match ? join(dir, match) : null
  } catch {
    return null
  }
}

/** Returns the LiveryTemplates folder of a game install, or null if the folder is not a game install. */
export async function findLiveryTemplatesDir(gameDir: string): Promise<string | null> {
  const support = await findChild(gameDir, 'support')
  return support ? findChild(support, 'LiveryTemplates') : null
}

export async function readSteamPathFromRegistry(): Promise<string | null> {
  try {
    const { stdout } = await promisify(execFile)('reg', [
      'query',
      'HKCU\\Software\\Valve\\Steam',
      '/v',
      'SteamPath'
    ])
    const match = stdout.match(/SteamPath\s+REG_\w+\s+(.+)/)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}

export type LocateOptions = {
  platform: NodeJS.Platform
  home: string
  readRegistry?: () => Promise<string | null>
}

export async function locateGameDir({ platform, home, readRegistry }: LocateOptions): Promise<string | null> {
  const registryPath = platform === 'win32' && readRegistry ? await readRegistry() : null
  const libraries = new Set<string>()

  for (const root of steamRootCandidates(platform, home, registryPath)) {
    libraries.add(root)
    try {
      const vdf = await readFile(join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8')
      for (const lib of libraryPathsFromVdf(vdf)) libraries.add(lib)
    } catch {
      // No Steam install at this root.
    }
  }

  for (const lib of libraries) {
    const gameDir = join(lib, 'steamapps', 'common', GAME_FOLDER_NAME)
    if (await findLiveryTemplatesDir(gameDir)) return gameDir
  }
  return null
}
