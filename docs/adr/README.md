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
- [0017](0017-template-loading-protocol-and-worker.md) Template loading through a custom protocol and a Web Worker

### Region map and export

What goes into the files that the game reads.

- [0013](0013-region-map.md) Region map: game names, colour from pixels
- [0014](0014-levels-per-template.md) Keep the Levels adjustment of each template
- [0021](0021-project-files.md) Project files: format, validation and unsaved changes
- [0025](0025-image-assets.md) Image layers and embedded image assets (project format version 2)
- [0022](0022-tga-export.md) TGA export: format, folder and backups
- [0023](0023-region-map-user-layers.md) Region map: how user layers change the template regions

### Build, test and deploy

- [0015](0015-windows-build-and-lan-deployment.md) Windows test build from Linux, deployed over SSH
- [0026](0026-oxlint-and-oxfmt.md) Lint and format with oxlint and oxfmt
- [0027](0027-test-strategy.md) Test strategy: synthetic templates, integration tests, end-to-end tests
- [0028](0028-ci.md) Continuous integration on GitHub Actions, Windows only
- [0029](0029-branch-workflow.md) Branch workflow: GitHub Flow with a protected master
- [0030](0030-distribution-and-updates.md) Distribution and updates: NSIS installer, GitHub releases, release-please, electron-updater
- [0031](0031-exact-dependency-versions.md) Exact dependency versions, a minimum release age and Dependabot
- [0032](0032-css-animations.md) UI animations in CSS, with no animation library
- [0033](0033-whats-new.md) "What's new" after an update
- [0034](0034-gradient-fills.md) Gradient fills, and project format version 3

### User interface

- [0016](0016-ui-radix-css-modules-game-style.md) UI: Radix Primitives, CSS Modules, game style
- [0018](0018-preview-with-template-segments.md) Editor preview: template segments around a movable insertion point
- [0019](0019-konva-canvas.md) Konva for the editor canvas
- [0020](0020-document-model-and-history.md) Livery document model and undo history
- [0024](0024-i18n.md) Localisation with i18next: English and French

## Quick start for developers

Use Node 26 (`.node-version`; fnm and mise read it): npm 11.10+ is necessary for the 3-day minimum release age (ADR-0031).

```sh
npm install                 # also installs the pre-commit hook (.githooks); if Electron fails with "Electron uninstall": node node_modules/electron/install.js
npm test                    # unit and integration tests (vitest; synthetic templates, ADR-0027)
npm run test:coverage       # coverage report in coverage/
npm run e2e                 # build + Playwright end-to-end tests of the real app (ADR-0027)
npm run typecheck
npm run lint                # oxlint (see ADR-0026)
npm run format              # oxfmt; npm run format:check in CI
npm run check               # format check + lint + typecheck + tests; stops at the first failure
npm run dev                 # app with hot reload (on Linux: select the game folder by hand)
npm run dist:win            # Windows test build in dist/win-unpacked (no installer)
npm run dist:installer      # Windows installer in dist/ (on Windows only; CI does it, ADR-0030)
LMU_WIN_HOST=user@host npm run deploy:win
npm run audit:build         # template audit, see ADR-0012
```
