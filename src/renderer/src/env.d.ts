/// <reference types="vite/client" />
import type { LmuApi } from '../../shared/api'

declare global {
  /** The app version from package.json (electron.vite.config.mts). */
  const __APP_VERSION__: string
  interface Window {
    lmu: LmuApi
  }
}
