import { execFile } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { parseVdf, type VdfObject } from './vdf'

// Game detection for Windows. LMU ships only for Windows; on other systems the user selects the folder.

export const LMU_APP_ID = '2399420'
export const DEFAULT_INSTALL_DIR = 'Le Mans Ultimate'

const UNINSTALL_KEYS = [
  `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App ${LMU_APP_ID}`,
  `HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App ${LMU_APP_ID}`
]
const DEFAULT_STEAM_ROOTS = ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam']

/** Access to the file system and the registry. Tests replace it with an in-memory fake. */
export interface Host {
  join(...parts: string[]): string
  /** Throws if the file does not exist. */
  readFile(path: string): Promise<string>
  /** Throws if the folder does not exist. */
  readdir(path: string): Promise<string[]>
  readRegistryValue(key: string, name: string): Promise<string | null>
}

async function readRegistryValue(key: string, name: string): Promise<string | null> {
  try {
    const { stdout } = await promisify(execFile)('reg', ['query', key, '/v', name])
    const match = stdout.match(new RegExp(`^\\s*${name}\\s+REG_\\w+\\s+(.+)$`, 'm'))
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}

export const nodeHost: Host = {
  join,
  readFile: (path) => readFile(path, 'utf8'),
  readdir: (path) => readdir(path),
  readRegistryValue
}

export type SteamLibrary = { path: string; appIds: string[] }

/** Libraries listed in a libraryfolders.vdf file (new and old formats). */
export function librariesFromVdf(text: string): SteamLibrary[] {
  const root = parseVdf(text)
  const folders = Object.entries(root).find(([key]) => key.toLowerCase() === 'libraryfolders')?.[1]
  if (!folders || typeof folders === 'string') return []

  const libraries: SteamLibrary[] = []
  for (const [key, entry] of Object.entries(folders)) {
    // New format: "0" { "path" "..." "apps" { ... } }. Old format: "1" "D:\\SteamLibrary".
    if (typeof entry === 'string') {
      if (/^\d+$/.test(key)) libraries.push({ path: entry, appIds: [] })
    } else if (typeof entry.path === 'string') {
      const apps = entry.apps
      libraries.push({ path: entry.path, appIds: apps && typeof apps !== 'string' ? Object.keys(apps as VdfObject) : [] })
    }
  }
  return libraries
}

/** Finds a child entry by name, ignoring case. */
async function findChild(host: Host, dir: string, name: string): Promise<string | null> {
  try {
    const match = (await host.readdir(dir)).find((e) => e.toLowerCase() === name.toLowerCase())
    return match ? host.join(dir, match) : null
  } catch {
    return null
  }
}

/** Returns the LiveryTemplates folder of a game install, or null if the folder is not a game install. */
export async function findLiveryTemplatesDir(host: Host, gameDir: string): Promise<string | null> {
  const support = await findChild(host, gameDir, 'support')
  return support ? findChild(host, support, 'LiveryTemplates') : null
}

async function installDirFromManifest(host: Host, library: string): Promise<string> {
  try {
    const manifest = parseVdf(await host.readFile(host.join(library, 'steamapps', `appmanifest_${LMU_APP_ID}.acf`)))
    const state = manifest.AppState
    if (state && typeof state !== 'string' && typeof state.installdir === 'string') return state.installdir
  } catch {
    // No manifest in this library.
  }
  return DEFAULT_INSTALL_DIR
}

/** Steam libraries to search, the ones that list LMU first. */
async function steamLibraries(host: Host): Promise<string[]> {
  const roots = [
    await host.readRegistryValue('HKCU\\Software\\Valve\\Steam', 'SteamPath'),
    await host.readRegistryValue('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
    ...DEFAULT_STEAM_ROOTS
  ].filter((p): p is string => !!p)

  const withApp: string[] = []
  const others: string[] = []
  for (const root of roots) {
    others.push(root)
    try {
      for (const lib of librariesFromVdf(await host.readFile(host.join(root, 'steamapps', 'libraryfolders.vdf')))) {
        ;(lib.appIds.includes(LMU_APP_ID) ? withApp : others).push(lib.path)
      }
    } catch {
      // No Steam install at this root.
    }
  }

  // Normalise slashes (the registry gives "c:/program files (x86)/steam") and remove duplicates.
  const seen = new Set<string>()
  const libraries: string[] = []
  for (const path of [...withApp, ...others].map((p) => host.join(p))) {
    if (seen.has(path.toLowerCase())) continue
    seen.add(path.toLowerCase())
    libraries.push(path)
  }
  return libraries
}

export async function locateGameDir(host: Host): Promise<string | null> {
  for (const key of UNINSTALL_KEYS) {
    const location = await host.readRegistryValue(key, 'InstallLocation')
    if (location && (await findLiveryTemplatesDir(host, location))) return host.join(location)
  }

  for (const library of await steamLibraries(host)) {
    const gameDir = host.join(library, 'steamapps', 'common', await installDirFromManifest(host, library))
    if (await findLiveryTemplatesDir(host, gameDir)) return gameDir
  }
  return null
}
