import { win32 } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findLiveryTemplatesDir, librariesFromVdf, locateGameDir, type Host } from './steam'

// Values taken from a real Windows install (Steam on C:, LMU in a second library on E:).
const HKCU_STEAM = 'HKCU\\Software\\Valve\\Steam'
const HKLM_STEAM = 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam'
const UNINSTALL = 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 2399420'

const LIBRARY_FOLDERS = `"libraryfolders"
{
	"0"
	{
		"path"		"C:\\\\Program Files (x86)\\\\Steam"
		"apps"
		{
			"228980"		"263949710"
		}
	}
	"1"
	{
		"path"		"E:\\\\SteamLibrary"
		"apps"
		{
			"359550"		"80748882443"
			"2399420"		"53572169078"
		}
	}
}`

const manifest = (installdir: string) => `"AppState"
{
	"appid"		"2399420"
	"name"		"Le Mans Ultimate"
	"installdir"		"${installdir}"
}`

type FakeWindows = {
  files?: Record<string, string>
  dirs?: string[]
  registry?: Record<string, string>
}

/** In-memory Windows: paths and registry keys are case-insensitive. */
function fakeHost({ files = {}, dirs = [], registry = {} }: FakeWindows): Host {
  const key = (p: string) => win32.normalize(p).toLowerCase()
  const fileMap = new Map(Object.entries(files).map(([p, c]) => [key(p), c]))
  const allPaths = [...Object.keys(files), ...dirs].map((p) => win32.normalize(p))
  const registryMap = new Map(Object.entries(registry).map(([k, v]) => [k.toLowerCase(), v]))

  return {
    join: (...parts) => win32.join(...parts),
    async readFile(path) {
      const content = fileMap.get(key(path))
      if (content === undefined) throw new Error(`ENOENT: ${path}`)
      return content
    },
    async readdir(path) {
      const prefix = key(path) + '\\'
      const children = new Set<string>()
      for (const p of allPaths) {
        if (p.toLowerCase().startsWith(prefix)) children.add(p.slice(prefix.length).split('\\')[0])
      }
      if (children.size === 0) throw new Error(`ENOENT: ${path}`)
      return [...children]
    },
    async readRegistryValue(k, name) {
      return registryMap.get(`${k}\\${name}`.toLowerCase()) ?? null
    }
  }
}

const GAME_DIR = 'E:\\SteamLibrary\\steamapps\\common\\Le Mans Ultimate'
const TEMPLATES = `${GAME_DIR}\\Support\\LiveryTemplates`

describe('librariesFromVdf', () => {
  it('reads paths and app IDs (new format)', () => {
    expect(librariesFromVdf(LIBRARY_FOLDERS)).toEqual([
      { path: 'C:\\Program Files (x86)\\Steam', appIds: ['228980'] },
      { path: 'E:\\SteamLibrary', appIds: ['359550', '2399420'] }
    ])
  })

  it('reads the old format and skips metadata keys', () => {
    const text = `"LibraryFolders" { "TimeNextStatsReport" "1" "ContentStatsID" "-1" "1" "D:\\\\SteamLibrary" }`
    expect(librariesFromVdf(text)).toEqual([{ path: 'D:\\SteamLibrary', appIds: [] }])
  })

  it('returns nothing for an unrelated file', () => {
    expect(librariesFromVdf('"other" { }')).toEqual([])
  })
})

describe('locateGameDir', () => {
  const steamOnC: FakeWindows = {
    registry: {
      [`${HKCU_STEAM}\\SteamPath`]: 'c:/program files (x86)/steam',
      [`${HKLM_STEAM}\\InstallPath`]: 'C:\\Program Files (x86)\\Steam'
    },
    files: {
      'C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf': LIBRARY_FOLDERS,
      'E:\\SteamLibrary\\steamapps\\appmanifest_2399420.acf': manifest('Le Mans Ultimate')
    },
    dirs: [TEMPLATES]
  }

  it('uses the uninstall key first', async () => {
    const host = fakeHost({ registry: { [`${UNINSTALL}\\InstallLocation`]: GAME_DIR }, dirs: [TEMPLATES] })
    expect(await locateGameDir(host)).toBe(GAME_DIR)
  })

  it('ignores an uninstall key that points to a folder without templates', async () => {
    const host = fakeHost({
      ...steamOnC,
      registry: { ...steamOnC.registry, [`${UNINSTALL}\\InstallLocation`]: 'D:\\Old\\Le Mans Ultimate' }
    })
    expect(await locateGameDir(host)).toBe(GAME_DIR)
  })

  it('finds the game in the library that lists the app (real PC layout)', async () => {
    expect(await locateGameDir(fakeHost(steamOnC))).toBe(GAME_DIR)
  })

  it('uses installdir from the app manifest', async () => {
    const custom = 'E:\\SteamLibrary\\steamapps\\common\\LMU Custom'
    const host = fakeHost({
      ...steamOnC,
      files: { ...steamOnC.files, 'E:\\SteamLibrary\\steamapps\\appmanifest_2399420.acf': manifest('LMU Custom') },
      dirs: [`${custom}\\Support\\LiveryTemplates`]
    })
    expect(await locateGameDir(host)).toBe(custom)
  })

  it('uses the Program Files default when the registry has no Steam path', async () => {
    const gameDir = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Le Mans Ultimate'
    const host = fakeHost({ dirs: [`${gameDir}\\Support\\LiveryTemplates`] })
    expect(await locateGameDir(host)).toBe(gameDir)
  })

  it('returns null when the game is not installed', async () => {
    const host = fakeHost({ ...steamOnC, dirs: [`${GAME_DIR}\\Support`] })
    expect(await locateGameDir(host)).toBeNull()
  })
})

describe('findLiveryTemplatesDir', () => {
  it('ignores the letter case of "support"', async () => {
    const host = fakeHost({ dirs: [TEMPLATES] })
    expect(await findLiveryTemplatesDir(host, GAME_DIR)).toBe(TEMPLATES)
  })
})
