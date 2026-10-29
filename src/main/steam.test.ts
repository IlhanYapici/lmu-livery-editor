import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findLiveryTemplatesDir, libraryPathsFromVdf, locateGameDir } from './steam'

describe('libraryPathsFromVdf', () => {
  it('reads the new format', () => {
    const text = `"libraryfolders" { "0" { "path" "/home/u/.local/share/Steam" } "1" { "path" "/mnt/games/SteamLibrary" } }`
    expect(libraryPathsFromVdf(text)).toEqual(['/home/u/.local/share/Steam', '/mnt/games/SteamLibrary'])
  })

  it('reads the old format', () => {
    const text = `"LibraryFolders" { "TimeNextStatsReport" "1" "1" "D:\\\\SteamLibrary" }`
    // Old files mix metadata with paths; the caller ignores paths without a game folder.
    expect(libraryPathsFromVdf(text)).toContain('D:\\SteamLibrary')
  })

  it('returns nothing for an unrelated file', () => {
    expect(libraryPathsFromVdf('"other" { }')).toEqual([])
  })
})

describe('locateGameDir', () => {
  let home: string

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'lmu-steam-'))
  })
  afterEach(async () => {
    await rm(home, { recursive: true, force: true })
  })

  async function makeGame(library: string, supportName = 'support') {
    const gameDir = join(library, 'steamapps/common/Le Mans Ultimate')
    await mkdir(join(gameDir, supportName, 'LiveryTemplates'), { recursive: true })
    return gameDir
  }

  it('finds the game in a secondary library listed in libraryfolders.vdf', async () => {
    const root = join(home, '.local/share/Steam')
    const library = join(home, 'games/SteamLibrary')
    await mkdir(join(root, 'steamapps'), { recursive: true })
    await writeFile(
      join(root, 'steamapps/libraryfolders.vdf'),
      `"libraryfolders" { "0" { "path" "${root}" } "1" { "path" "${library}" } }`
    )
    const gameDir = await makeGame(library)

    expect(await locateGameDir({ platform: 'linux', home })).toBe(gameDir)
  })

  it('finds the game in the Flatpak Steam root', async () => {
    const gameDir = await makeGame(join(home, '.var/app/com.valvesoftware.Steam/.local/share/Steam'))
    expect(await locateGameDir({ platform: 'linux', home })).toBe(gameDir)
  })

  it('accepts "Support" with a capital letter', async () => {
    const gameDir = await makeGame(join(home, '.steam/steam'), 'Support')
    expect(await findLiveryTemplatesDir(gameDir)).toBe(join(gameDir, 'Support/LiveryTemplates'))
  })

  it('returns null when the game is not installed', async () => {
    await mkdir(join(home, '.local/share/Steam/steamapps/common/Le Mans Ultimate'), { recursive: true })
    expect(await locateGameDir({ platform: 'linux', home })).toBeNull()
  })
})
