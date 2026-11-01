import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_PROJECT_BYTES } from '../shared/project'
import { ProjectHandles, readProjectFile, writeAtomic } from './projectFiles'

describe('ProjectHandles', () => {
  it('gives an opaque handle per path, the same for the same path', () => {
    const handles = new ProjectHandles()
    const a = handles.register('C:\\Users\\u\\Documents\\LMU Liveries\\a.lmulivery')
    const b = handles.register('C:\\Users\\u\\Documents\\LMU Liveries\\b.lmulivery')
    expect(a).not.toContain('a.lmulivery')
    expect(handles.register('C:\\Users\\u\\Documents\\LMU Liveries\\a.lmulivery')).toBe(a)
    expect(handles.path(b)).toBe('C:\\Users\\u\\Documents\\LMU Liveries\\b.lmulivery')
    expect(handles.path('made-up')).toBeNull()
  })
})

describe('project file IO', () => {
  let dir: string
  beforeEach(async () => (dir = await mkdtemp(join(tmpdir(), 'lmu-project-'))))
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  it('replaces the file and leaves no temporary file', async () => {
    const file = join(dir, 'livery.lmulivery')
    await writeFile(file, 'old')
    await writeAtomic(file, 'new')
    expect(await readFile(file, 'utf8')).toBe('new')
    expect(await readdir(dir)).toEqual(['livery.lmulivery'])
  })

  it('keeps the old target and removes the temporary file when the rename fails', async () => {
    // Renaming a file onto a folder that is not empty fails on every system.
    const target = join(dir, 'occupied')
    await mkdir(target)
    await writeFile(join(target, 'inside.txt'), 'old')
    await expect(writeAtomic(target, 'new')).rejects.toThrow()
    expect((await readdir(dir)).sort()).toEqual(['occupied'])
    expect(await readFile(join(target, 'inside.txt'), 'utf8')).toBe('old')
  })

  it('refuses files above the size limit before reading them', async () => {
    const big = join(dir, 'big.lmulivery')
    await writeFile(big, Buffer.alloc(MAX_PROJECT_BYTES + 1))
    const result = await readProjectFile(big)
    const limitMB = MAX_PROJECT_BYTES / 1048576
    expect(result).toEqual({ ok: false, tooLarge: { sizeMB: limitMB, limitMB } })
    const small = join(dir, 'small.lmulivery')
    await writeFile(small, '{}')
    expect(await readProjectFile(small)).toEqual({ ok: true, text: '{}' })
  })
})
