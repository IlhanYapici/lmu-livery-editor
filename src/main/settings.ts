import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Language } from '../shared/i18n'

export type Settings = {
  gameDir?: string
  /** The UI language; when missing, the app uses the system locale. */
  language?: Language
  /** The highest "What's new" entry id that the user saw (ADR-0033). */
  whatsNewSeen?: number
}

/**
 * The highest "What's new" id that the user saw. A new install (no settings file when the app started)
 * saw everything: it gets `latest`. A user of a version before "What's new" has settings but no value:
 * 0, so the dialog shows every entry once.
 */
export function resolveWhatsNewSeen(saved: unknown, firstRun: boolean, latest: number): number {
  if (typeof saved === 'number' && Number.isInteger(saved) && saved >= 0) return saved
  return firstRun ? latest : 0
}

export async function loadSettings(file: string): Promise<Settings> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Settings
  } catch {
    return {}
  }
}

export async function saveSettings(file: string, settings: Settings): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(settings, null, 2))
}

export const settingsExist = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false
  )
