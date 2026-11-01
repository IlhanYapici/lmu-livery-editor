import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import packageJson from './package.json' with { type: 'json' }

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: resolve(import.meta.dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: resolve(import.meta.dirname, 'src/renderer/index.html')
      }
    },
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(packageJson.version) }
  }
})
