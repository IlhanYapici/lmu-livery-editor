import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Language } from '../shared/i18n'

export type Settings = {
  gameDir?: string
  /** The UI language; when missing, the app uses the system locale. */
  language?: Language
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
