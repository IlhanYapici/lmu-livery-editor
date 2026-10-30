# Find guide layers by position first, by name second

**Status:** accepted (2026-10-30)

`src/shared/psd/roles.ts` finds the guide layers. The audit of the 60 templates showed one stable order (bottom to top): content layers, Levels, mask guide (optional), region group, wireframe. The names are not stable:

- Wireframe: `Wireframe`, `UVW`, `Wire`, `WIRE`, `WireEVO`, `Body_UV`, but also `Background` and `Layer 0`.
- Mask guide: `Mask(Disable for export)`, `Maks(Disable for export)` (typo), `Color Fill 1` (Ferrari 488 GTE). 3 templates have no mask guide.
- Region group: `Region`, `Regions`, `region`.
- Base layer: `Base`, `base`, `Base Colour`, `Color Fill 1`, `Background`, the group `Car`, …

Thus the rules use the name when it is clear, and else the position: the wireframe is the top pixel layer above the region group; the mask guide is the only pixel layer between the last adjustment and the region group; the base layer is the bottom content layer. A guess from position adds a warning to the result.

## Consequences

Do not add a rule for one car name. Run the audit ([ADR-0012](0012-template-audit-as-reference-test.md)) after each rule change.
