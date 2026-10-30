# Editor preview: template segments around a movable insertion point

**Status:** accepted (2026-10-30)

The user layers go into the template stack at an **insertion point**: a number of template content layers below them. The user moves it in the Template panel, but never above the first Levels adjustment of the template ([ADR-0014](0014-levels-per-template.md)). The default position is above the base layer and the last top-level layer whose name contains "carbon", so that number plates and stickers stay above the user paint.

The worker splits the template at the insertion point (`src/shared/psd/templateRender.ts`):

- **below**: the exact merge of the layers under the insertion point;
- **above**: the merge of the content layers over it, without the top-level adjustments;
- **table**: the top-level adjustments over it that change each channel alone (Levels, Brightness), as one 256-entry table.

The canvas draws below → user layers → above, and applies the table with an SVG `feComponentTransfer type="table"` filter (`color-interpolation-filters="sRGB"`) on the paint canvas. Chromium runs it on the GPU, and the result is the same as the compositor. Guides are separate canvases: the wireframe uses CSS `mix-blend-mode: screen`.

`fastIsExact` is false when the layers above the insertion point have a Hue/Saturation adjustment, an adjustment with a mask or an opacity, a non-normal blend mode, or a content layer above an adjustment. Then an exact merge in the worker replaces the fast preview after the edits stop (Phase 3c-2). On the Ferrari 296 LMGT3 templates, the fast preview is exact.

## Considered options

- **Exact merge after each edit only.** Rejected: a few seconds per change at 4096 × 4096.
- **Fixed insertion point.** Rejected by the user: the right place depends on the template and on the livery.

## Consequences

Moving the insertion point or changing the visibility of a template layer draws the segments again (about 1.5 s for the Ferrari 296 LMGT3 on the development PC). The old bitmaps stay on screen until the new ones arrive.
