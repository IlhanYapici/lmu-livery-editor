// Automatic updates from the GitHub releases (electron-updater, ADR-0030). The installed app checks at
// start and every 6 hours, and downloads in the background. When an update is ready, the window shows a
// banner: "Restart now" installs it at once, else it installs when the user quits the app.

/** The part of electron-updater's AppUpdater that this module uses (a fake in the tests). */
export type Updater = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  on(event: 'update-downloaded', listener: (info: { version: string }) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
}

export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

type Options = {
  /** Called once per downloaded version. */
  onReady: (version: string) => void
  log?: (message: string) => void
  setInterval?: (callback: () => void, ms: number) => unknown
}

/**
 * Starts the checks. Errors (no network, no release yet) go to the log only: an update is not
 * necessary to use the app.
 */
export function startUpdates(updater: Updater, { onReady, log = console.warn, setInterval = globalThis.setInterval }: Options): void {
  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true
  let ready: string | null = null
  updater.on('update-downloaded', ({ version }) => {
    if (version === ready) return
    ready = version
    onReady(version)
  })
  updater.on('error', (error) => log(`Update error: ${error.message}`))
  const check = () => void updater.checkForUpdates().catch((error: Error) => log(`Update check failed: ${error.message}`))
  check()
  setInterval(check, CHECK_INTERVAL_MS)
}
