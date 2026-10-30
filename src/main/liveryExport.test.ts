import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { encodeTga24 } from '../shared/tga'
import { BACKUPS_TO_KEEP, checkGameTga, REGION_FILE, SKIN_FILE, writeLiveryFiles } from './liveryExport'

const tga = (value: number) => encodeTga24(new Uint8ClampedArray(2 * 2 * 4).fill(value), 2, 2)

describe('checkGameTga', () => {
  it('accepts a 24-bit TGA of the exact length, and refuses other bytes', () => {
    expect(checkGameTga(tga(255), 'skin')).toBeNull()
    expect(checkGameTga(new Uint8Array(10), 'skin')).toMatch(/^skin:/)
    expect(checkGameTga(new Uint8Array([...tga(1), 0]), 'skin')).toMatch(/length/)
    const thirtyTwo = tga(1).slice(); thirtyTwo[16] = 32
    expect(checkGameTga(thirtyTwo, 'region')).toMatch(/^region:/)
  })
})

describe('writeLiveryFiles', () => {
  let dir: string
  beforeEach(async () => (dir = await mkdtemp(join(tmpdir(), 'lmu-export-'))))
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  it('creates the folder and writes both files', async () => {
    const folder = join(dir, 'UserData', 'Liveries')
    expect(await writeLiveryFiles(folder, tga(1), tga(2), { backup: true })).toBeNull()
    expect(await readFile(join(folder, SKIN_FILE))).toEqual(Buffer.from(tga(1)))
    expect(await readFile(join(folder, REGION_FILE))).toEqual(Buffer.from(tga(2)))
  })

  it('moves the old files to a time-stamped backup, and keeps only the newest backups', async () => {
    const folder = join(dir, 'Liveries')
    await mkdir(folder)
    for (let i = 0; i < BACKUPS_TO_KEEP + 2; i++) {
      await writeFile(join(folder, SKIN_FILE), `old skin ${i}`)
      await writeFile(join(folder, REGION_FILE), `old region ${i}`)
      const backup = await writeLiveryFiles(folder, tga(i), tga(i), { backup: true, now: new Date(Date.UTC(2026, 9, 30, 15, 0, i)) })
      expect(backup).toBe(join(folder, 'Backups', `2026-10-30T15-00-0${i}`))
      expect(await readFile(join(backup!, SKIN_FILE), 'utf8')).toBe(`old skin ${i}`)
    }
    const backups = (await readdir(join(folder, 'Backups'))).sort()
    expect(backups.length).toBe(BACKUPS_TO_KEEP)
    expect(backups[0]).toBe('2026-10-30T15-00-02')
  })

  it('does not back up when asked not to (export to another folder)', async () => {
    await writeFile(join(dir, SKIN_FILE), 'old')
    expect(await writeLiveryFiles(dir, tga(1), tga(2), { backup: false })).toBeNull()
    expect((await readdir(dir)).sort()).toEqual([REGION_FILE, SKIN_FILE].sort())
  })
})
