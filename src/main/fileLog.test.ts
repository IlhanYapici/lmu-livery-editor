import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFileLog } from './fileLog'

describe('createFileLog', () => {
  let folder: string
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'lmu-log-'))
  })
  afterEach(() => rm(folder, { recursive: true, force: true }))

  it('writes one line per message, with the time and the level; makes the folder', async () => {
    const file = join(folder, 'logs', 'updater.log')
    const log = createFileLog(file, { now: () => new Date('2026-11-01T18:00:00Z') })
    log.info('Checking for update')
    log.error(new Error('offline'))
    const lines = (await readFile(file, 'utf8')).split('\n')
    expect(lines[0]).toBe('2026-11-01T18:00:00.000Z INFO Checking for update')
    expect(lines[1]).toMatch(/^2026-11-01T18:00:00.000Z ERROR Error: offline/)
  })

  it('keeps only the newest half, from a full line, when the file is too large', async () => {
    const file = join(folder, 'updater.log')
    await writeFile(file, Array.from({ length: 100 }, (_, i) => `old line ${i}`).join('\n') + '\n')
    const log = createFileLog(file, { maxBytes: 500, now: () => new Date('2026-11-01T18:00:00Z') })
    log.warn('new')
    const content = await readFile(file, 'utf8')
    expect(content.length).toBeLessThanOrEqual(250 + 40)
    expect(content.split('\n')[0]).toMatch(/^old line \d+$/)
    expect(content).toContain('old line 99\n2026-11-01T18:00:00.000Z WARN new\n')
  })

  it('drops debug messages, unless debug is on', async () => {
    const file = join(folder, 'updater.log')
    const now = () => new Date('2026-11-01T18:00:00Z')
    createFileLog(file, { now }).debug('block list')
    createFileLog(file, { now, debug: true }).debug('kept')
    expect(await readFile(file, 'utf8')).toBe('2026-11-01T18:00:00.000Z DEBUG kept\n')
  })

  it('never throws when it cannot write', () => {
    const log = createFileLog(join(folder, 'missing\0name', 'updater.log'))
    expect(() => log.info('x')).not.toThrow()
  })
})
