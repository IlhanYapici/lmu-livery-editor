# Project files: format, validation and unsaved changes

**Status:** accepted (2026-10-30). Amended by [ADR-0025](0025-image-assets.md): format version 2 (embedded images) and a 100 MB file limit.

A project is a `.lmulivery` file: UTF-8 JSON with `format: "lmu-livery"`, a format `version` (1), `savedAt`, the template (`id` = file name, `sizeBytes`) and the livery document. `src/shared/project.ts` has the zod schemas. They are the single source of the document types and of the validation, so the two cannot become different.

A project file comes from outside the app, so the app never trusts it:

- The main process refuses files above 20 MB before it reads them.
- The schema checks every field: types, layer kinds, region IDs, `#rrggbb` colours, number ranges (JSON `1e999` becomes Infinity and fails), font names, unique layer IDs, polygons with 3 points or more, at most 2,000 layers. Unknown fields are dropped.
- A newer format version gives a clear message; an error gives its location (`document.layers[3].region: …`).
- `zod` runs with `jitless: true`: its `new Function` test is blocked by the renderer CSP.

The renderer never sends a path ([ADR-0005](0005-renderer-security-model.md)). `openProject` and `saveProject` return an opaque handle, and the main process keeps the path (`ProjectHandles`). The main process writes a temporary file next to the target and renames it, so a crash never leaves half a file. The default folder is `Documents\LMU Liveries`.

**Unsaved changes.** The document store keeps the saved document; there are unsaved changes when the current document is not that object, so Undo back to the saved state clears them. The app asks "Save / Don't save / Cancel" before it leaves the editor, opens another project or changes the game folder. To close the window, the renderer blocks `beforeunload`, and the main process shows the question on `will-prevent-unload`; "Save" sends `app:save-before-close` to the renderer, which saves and then asks the main process to close the window.

If `template.sizeBytes` differs from the installed template, the editor warns that a game update changed the template.

## Considered options

- **A hand-written validator.** Rejected by the user: zod keeps the types and the validation in one place.
- **Paths in the renderer.** Rejected: see ADR-0005.
