import { describe, expect, it, vi } from 'vitest'
import { CHECK_INTERVAL_MS, startUpdates, type Updater } from './updater'

function fakeUpdater(check: () => Promise<unknown> = () => Promise.resolve(null)) {
  const listeners: Record<string, (value: never) => void> = {}
  const updater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn(check),
    on: (event: string, listener: (value: never) => void) => (listeners[event] = listener)
  }
  const emit = (event: string, value: unknown) => listeners[event](value as never)
  return { updater: updater as Updater & typeof updater, emit }
}

describe('startUpdates', () => {
  it('downloads in the background, installs at quit, checks at start and every 6 hours', () => {
    const { updater } = fakeUpdater()
    let timer: (() => void) | undefined
    const setInterval = vi.fn((callback: () => void) => (timer = callback))
    startUpdates(updater, { onReady: () => {}, setInterval })
    expect([updater.autoDownload, updater.autoInstallOnAppQuit]).toEqual([true, true])
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), CHECK_INTERVAL_MS)
    timer!()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('tells about each downloaded version once', () => {
    const { updater, emit } = fakeUpdater()
    const onReady = vi.fn()
    startUpdates(updater, { onReady, setInterval: () => {} })
    emit('update-downloaded', { version: '0.1.1' })
    emit('update-downloaded', { version: '0.1.1' })
    emit('update-downloaded', { version: '0.1.2' })
    expect(onReady.mock.calls).toEqual([['0.1.1'], ['0.1.2']])
  })

  it('only logs errors and failed checks', async () => {
    const { updater, emit } = fakeUpdater(() => Promise.reject(new Error('offline')))
    const log = vi.fn()
    startUpdates(updater, { onReady: () => {}, log, setInterval: () => {} })
    emit('error', new Error('no release'))
    await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(2))
    expect(log.mock.calls.flat()).toEqual(['Update error: no release', 'Update check failed: offline'])
  })
})
