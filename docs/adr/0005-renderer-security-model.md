# Renderer security model

**Status:** accepted (2026-10-29)

The renderer has no access to Node.js: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and a Content Security Policy in `index.html`. The preload script exposes a small API as `window.lmu`. Its contract is `src/shared/api.ts` (`LmuApi` and the `IPC` channel names).

**The renderer never sends a file path to the main process.** For example, `listTemplates()` has no argument: the main process uses the game folder from the settings file. Thus a bug or injected content in the renderer cannot make the app read or write other folders.

## Consequences

When you add an IPC call, add it to `LmuApi`, the preload script and `ipcMain.handle` together. If the call needs a file, give an ID (for example, a template file name), and let the main process resolve the path.
