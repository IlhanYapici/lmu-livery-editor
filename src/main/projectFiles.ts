import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { MAX_PROJECT_BYTES } from '../shared/project'

// Project files for the main process. The renderer never sends a path (ADR-0005): it gets an opaque
// handle for each file that the user opened or saved through a dialog, and the main process keeps the path.

export class ProjectHandles {
  private paths = new Map<string, string>()

  register(path: string): string {
    for (const [handle, known] of this.paths) if (known === path) return handle
    const handle = randomUUID()
    this.paths.set(handle, path)
    return handle
  }

  path(handle: string): string | null {
    return this.paths.get(handle) ?? null
  }
}

/** Writes a temporary file next to the target, then renames it: a crash never leaves half a file. */
export async function writeAtomic(path: string, data: string | Uint8Array): Promise<void> {
  const temporary = `${path}.${process.pid}.tmp`
  try {
    await writeFile(temporary, data)
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

export type ReadResult = { ok: true; text: string } | { ok: false; error: string }

/** Reads a project file, after a size check: the file comes from outside the app. */
export async function readProjectFile(path: string): Promise<ReadResult> {
  const { size } = await stat(path)
  if (size > MAX_PROJECT_BYTES) {
    return { ok: false, error: `The file is too large (${Math.round(size / 1048576)} MB; the limit is ${MAX_PROJECT_BYTES / 1048576} MB).` }
  }
  return { ok: true, text: await readFile(path, 'utf8') }
}

export async function ensureFolder(path: string): Promise<string> {
  await mkdir(path, { recursive: true })
  return path
}

export const displayName = (path: string) => basename(path)
