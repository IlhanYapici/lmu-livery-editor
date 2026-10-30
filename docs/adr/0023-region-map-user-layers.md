# Region map: how user layers change the template regions

**Status:** accepted (2026-10-30)

The exported region map starts from the template region map ([ADR-0013](0013-region-map.md)). Then the visible user layers draw their region on top, in layer order, with these rules:

- **Base layers do not change the region map.** A full Base fill must not erase the carbon parts of the template. (Decision of the user; the other option was "every layer overrides".)
- Layers in Carbon, Option 1, Option 2 or Stickers draw their region where they cover at least half a pixel, at full opacity whatever their layer opacity: the region tells where the layer is, not how it looks.
- Each pixel snaps to the nearest of the 5 region colours, so the file never has mixed colours at shape edges.

The region view of the editor uses the same rules (`EditorCanvas`, `rasterizeRegions`).

## Consequences

To make a template carbon part paintable, the user needs a layer in a non-Base region there; a "paint over carbon" option for Base layers would need a new ADR.
