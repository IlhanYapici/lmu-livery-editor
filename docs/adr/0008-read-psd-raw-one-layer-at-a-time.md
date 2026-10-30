# Read PSD files raw, and decode one layer at a time

**Status:** accepted (2026-10-30)

The app reads a template with `ag-psd` and `useRawData: true`. This reads the layer structure but does not decode the pixels. The code decodes a layer only when it needs it (`getLayerImageData`), and it does not keep the result.

Measurement with `ag-psd` 34.1.0: when it decodes all layers, the Toyota GR010 template (434 MB) needs 3.1 GB of RAM, and the Glickenhaus SCG 007 template needs 2.8 GB. One layer of 4096 × 4096 pixels is 64 MB.

## Consequences

- In Node.js and in a Web Worker, `ag-psd` cannot make image buffers by itself. Call `initializeCanvas` with a function that returns `{ width, height, data: new Uint8ClampedArray(w * h * 4) }`. Without it, the decode of each layer fails silently, and the layers have no pixels.
- The decoded data is RGBA, also for layer masks. Read the mask value from the R channel.
