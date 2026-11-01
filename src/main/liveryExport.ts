import { access, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { readTgaHeader, tgaSize } from '../shared/tga'
import { writeAtomic } from './projectFiles'

// Writes the two game files (ADR-0022). The game reads one custom livery: UserData\Liveries\customskin.tga
// and customskin_region.tga, for the car that is open in the showroom.

export const SKIN_FILE = 'customskin.tga'
export const REGION_FILE = 'customskin_region.tga'
export const BACKUPS_TO_KEEP = 5

/** Checks bytes from the renderer before they go to disk: a 24-bit uncompressed TGA of the exact size. */
export function checkGameTga(bytes: Uint8Array, name: string): string | null {
  try {
    const { width, height, bitsPerPixel } = readTgaHeader(bytes)
    if (bitsPerPixel !== 24) return `${name}: expected 24 bits per pixel`
    if (width < 1 || height < 1 || width > 8192 || height > 8192) return `${name}: bad size ${width} × ${height}`
    if (bytes.length !== tgaSize(width, height)) return `${name}: wrong file length`
    return null
  } catch (error) {
    return `${name}: ${(error as Error).message}`
  }
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  )

/** "2026-10-30T15-04-05" (file-name safe, sorts by time). */
export const backupStamp = (now: Date) => now.toISOString().slice(0, 19).replace(/:/g, '-')

/**
 * Writes the two files into `folder`. With `backup`, existing files first move to Backups\<time>, and only
 * the newest BACKUPS_TO_KEEP backups stay. Returns the backup folder, or null if there was nothing to keep.
 */
export async function writeLiveryFiles(
  folder: string,
  skin: Uint8Array,
  region: Uint8Array,
  options: { backup: boolean; now?: Date }
): Promise<string | null> {
  await mkdir(folder, { recursive: true })
  let backupFolder: string | null = null
  if (options.backup) {
    const existing = []
    for (const name of [SKIN_FILE, REGION_FILE]) if (await exists(join(folder, name))) existing.push(name)
    if (existing.length) {
      const backups = join(folder, 'Backups')
      backupFolder = join(backups, backupStamp(options.now ?? new Date()))
      await mkdir(backupFolder, { recursive: true })
      for (const name of existing) await rename(join(folder, name), join(backupFolder, name))
      const all = (await readdir(backups)).sort()
      for (const old of all.slice(0, Math.max(0, all.length - BACKUPS_TO_KEEP)))
        await rm(join(backups, old), { recursive: true, force: true })
    }
  }
  await writeAtomic(join(folder, SKIN_FILE), skin)
  await writeAtomic(join(folder, REGION_FILE), region)
  return backupFolder
}

export async function liveryFilesExist(folder: string): Promise<boolean> {
  return (await exists(join(folder, SKIN_FILE))) || (await exists(join(folder, REGION_FILE)))
}
