/// <reference types="vite/client" />
import type { LmuApi } from '../../shared/api'

declare global {
  interface Window {
    lmu: LmuApi
  }
}
