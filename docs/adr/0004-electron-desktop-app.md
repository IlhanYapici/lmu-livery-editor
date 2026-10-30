# Electron desktop app

**Status:** accepted (2026-10-29)

The app is an Electron app (electron-vite, React, TypeScript). A desktop app can find the game install, read the templates there, and write the TGA files directly into `UserData/Liveries`. The work is heavy canvas work on 4096 × 4096 images and on PSD files of up to 455 MB. Electron gives the same Chromium on all systems.

## Considered options

- **Web app with the File System Access API.** Rejected: it works only in Chromium browsers, and it cannot find the game by itself.
- **Tauri 2.** Rejected: it uses WebKitGTK on Linux, which is slow with large canvases, and the team develops on Linux. The smaller bundle (~10 MB against ~300 MB) does not compensate.
