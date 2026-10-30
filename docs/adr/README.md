# Architecture decision records

Each file records **one** decision: the context, the decision and the reason. Do not rewrite an accepted ADR. When a decision changes, write a new ADR and set the status of the old one to "superseded by ADR-NNNN". The words in these files follow [GLOSSARY.md](../../GLOSSARY.md).

To add an ADR: take the next free number, copy the shape of an existing file, and add a line to the index below.

## Index by domain

### Product scope
What the app does and does not do.
- [0001](0001-2d-editor-without-3d-view.md) 2D editor without a 3D view
- [0002](0002-no-game-content-in-app-or-repo.md) No game content in the app or in the repository
- [0003](0003-windows-only.md) Windows only

### Desktop platform
How the app runs, and how the renderer talks to the main process.
- [0004](0004-electron-desktop-app.md) Electron desktop app
- [0005](0005-renderer-security-model.md) Renderer security model

### Game detection
How the app finds the game install.
- [0006](0006-game-detection-order.md) Game detection order

### Template catalogue
How the app lists the templates.
- [0007](0007-template-catalogue-from-file-names.md) Template catalogue from file names

### PSD reading and compositing
How the app reads templates and merges layers like Photoshop.
- [0008](0008-read-psd-raw-one-layer-at-a-time.md) Read PSD files raw, and decode one layer at a time
- [0009](0009-own-compositor.md) Our own layer compositor
- [0010](0010-guide-layers-by-position.md) Find guide layers by position first, by name second
- [0011](0011-brightness-curve-fitted-on-real-data.md) Brightness curve fitted on real data
- [0012](0012-template-audit-as-reference-test.md) The template audit is the reference test

### Region map and export
What goes into the files that the game reads.
- [0013](0013-region-map.md) Region map: game names, colour from pixels
- [0014](0014-levels-per-template.md) Keep the Levels adjustment of each template

### Build, test and deploy
- [0015](0015-windows-build-and-lan-deployment.md) Windows test build from Linux, deployed over SSH

### User interface
- [0016](0016-ui-radix-css-modules-game-style.md) UI: Radix Primitives, CSS Modules, game style (proposed)

## Quick start for developers

```sh
npm install                 # if Electron fails with "Electron uninstall": node node_modules/electron/install.js
npm test                    # unit tests (vitest)
npm run typecheck
npm run dev                 # app with hot reload (on Linux: select the game folder by hand)
npm run dist:win            # Windows build in dist/win-unpacked
LMU_WIN_HOST=user@host npm run deploy:win
npm run audit:build         # template audit, see ADR-0012
```
