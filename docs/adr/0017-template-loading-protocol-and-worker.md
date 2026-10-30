# Template loading through a custom protocol and a Web Worker

**Status:** accepted (2026-10-30)

The editor reads a template in a Web Worker of the renderer (`src/renderer/src/editor/template.worker.ts`). The worker gets the file with `fetch('lmu-template://template/<file name>')`. The main process serves this protocol (`src/main/templateProtocol.ts`): it accepts only a file name of the catalogue that it last sent to the renderer, so the renderer still never sends a path ([ADR-0005](0005-renderer-security-model.md)). The worker reads the PSD raw ([ADR-0008](0008-read-psd-raw-one-layer-at-a-time.md)), keeps it in memory, and sends the canvas bitmaps to the page as `ImageBitmap` objects (transferred, not copied).

## Considered options

- **Send the file through IPC.** Rejected: a copy of up to 455 MB into the renderer.
- **Read and merge in a Node process of the main side** (`utilityProcess`). Rejected: the bitmaps must then go to the renderer too (5 × 64 MB per template).

## Consequences

- The protocol is registered as privileged (`standard`, `secure`, `supportFetchAPI`, `corsEnabled`, `stream`) before the app is ready. The response has `Access-Control-Allow-Origin: *`, because the worker runs on another origin (`file://` or the dev server), and a `Content-Length` from `stat`, for the progress bar.
- The CSP of `index.html` allows `connect-src lmu-template:` and `worker-src 'self' blob:`. It also allows `font-src data:`, because Vite puts small font files into the CSS as `data:` URLs.
- The worker keeps the PSD buffer while the template is open, so that it can draw the template again when the user changes the visibility or the insertion point. The worker writes the file directly into one buffer when the size is known, so that the file does not exist twice in memory.
