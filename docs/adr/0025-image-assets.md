# Image layers and embedded image assets (project format version 2)

**Status:** accepted (2026-11-01). Amends [ADR-0021](0021-project-files.md).

Users import PNG, JPEG, WebP and SVG images (logos, sponsors) as **image layers**. A project must open on another PC, so the images are **embedded** in the `.lmulivery` file:

- `document.assets` maps an **asset ID** to `{ type, data (base64), width, height }`. The ID is the hex SHA-256 of the image bytes, so the same logo used many times is stored once. An image layer refers to an asset ID and has a display size in template pixels; it has no colour (`color` moved from the common layer fields to the shape kinds).
- Assets never change after import, so the undo history shares them; it does not copy them.
- Saving drops assets that no layer uses.
- **Format version 2.** `parseProject` migrates version 1 files (it adds an empty `assets` table); a newer version gives the "newer version" message.
- **Limits.** Project file 100 MB (was 20 MB); image 25 MB and 8192 × 8192 px.
- **Validation in two steps.** `parseProject` (synchronous) checks the structure: the image type list, base64 characters, sizes, asset ID format, and that every image layer refers to an asset that exists. `verifyAssets` (asynchronous, WebCrypto) checks that each asset's bytes match its ID and its size limit. For a bad record key, zod puts our message in a nested issue; `parseProject` shows that message.
- **SVG.** The app draws images through an `<img>` element. In this mode Chromium runs no script and loads no external resource, which protects against hostile SVG files.
- **Region map.** The shape of an image (its pixels with 50 % alpha or more) takes the colour of its region; the rule of [ADR-0023](0023-region-map-user-layers.md) stays (Base layers keep the template regions). New image layers start in the **Stickers** region (decision of the user), other new layers in Base.

## Considered options

- **A ZIP container** (`project.json` + image files): about 25 % smaller, but a new library and a more complex format. Rejected for now; the format version allows it later.
- **Links to image files on disk**: small projects, but they break when files move, and paths would go through the renderer ([ADR-0005](0005-renderer-security-model.md)). Rejected.

## Consequences

Base64 makes the image data about 33 % larger in the file. The user is responsible for the rights to the images they import; the app ships no logos.
