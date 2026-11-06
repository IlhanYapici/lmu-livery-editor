# Gradient fills, and project format version 3

**Status:** accepted (2026-11-06)

Fill, rectangle and polygon layers can have a linear or a radial gradient in place of their solid colour.

## Model

- `gradient: null | { type: 'linear' | 'radial', angle, stops }` on these 3 layer kinds (`src/shared/project.ts`). `null` is a solid colour. The layer `color` stays: it is the solid colour, and the colour of a new gradient.
- 2 to 8 stops. Each stop has `offset` (0..1), `color` (hex) and `alpha` (0..1). The stops are not kept sorted: a stop keeps its index while the user drags it past another one. The paint sorts them.
- **The gradient uses the box of the layer**, before its transform: the rectangle, the bounding box of the polygon points, the full texture for a fill. When the user moves, scales or rotates the layer, the gradient moves with it.
- **Linear:** `angle` in degrees, 0 = left to right, 90 = top to bottom. The line goes through the centre of the box and is long enough that the end stops touch the corners (the CSS `linear-gradient` rule).
- **Radial:** from the centre of the box to its corners. `angle` has no effect. Handles on the canvas for the centre and the radius are possible later.
- Text and image layers have no gradient. Text has a different box (font metrics).

## One paint function

`paintProps` (`src/renderer/src/editor/paint.ts`) gives the Konva fill properties of a layer. The editor canvas and the export (`rasterize.ts`) both use it, so the preview and the TGA files cannot be different. It always gives every gradient key, with `undefined` for the unused ones, so that react-konva clears a gradient when the layer goes back to solid.

## Region map

No change from [ADR-0023](0023-region-map-user-layers.md): a layer is one region over its whole shape, at full opacity, also where its gradient is transparent.

## Banding

Chromium dithers canvas gradients. A 4096 px gradient from `#202020` to black has its 33 values with an alternating pattern at each step (16, 17, 16, 17…), not hard steps. Measured in Electron 45 on 2026-11-06.

## Project format version 3

zod drops unknown fields. An app before this change would open a file with gradients, drop them with no warning, and save the file without them. With version 3, that app refuses the file ("needs a newer version"). Version 2 files open with `gradient: null` on the fill, rectangle and polygon layers.

## Consequences

- Files saved with this version do not open in v0.4.0 and older, also when they have no gradient.
- A later field that older apps can safely ignore does not need a new version. A field whose loss changes the livery does.
