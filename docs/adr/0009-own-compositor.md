# Our own layer compositor

**Status:** accepted (2026-10-30)

`src/shared/psd/composite.ts` merges the template layers. The app cannot use the composite image that Photoshop saves in the PSD file: the template author saved it with the mask guide and the wireframe visible. The app must also merge the user layers between the template layers. `ag-psd` decodes layers, but it does not merge them.

The compositor supports only the features that the 60 templates use. It counts every other feature in `unsupported`, and does not hide it:

- Pixel layers, opacity, fill opacity, layer masks, clipping masks.
- Isolated groups, and pass-through groups (also with a group mask or an opacity: the `Clamp` group).
- Blend modes: the separable W3C modes, linear burn, exclusion, lighter color, darker color.
- The colour overlay effect (`solidFill`). Many templates define the base colour with this effect.
- Adjustments: Levels, Hue/Saturation (master only, HSL model), Brightness ([ADR-0011](0011-brightness-curve-fitted-on-real-data.md)).

Not supported: the `stroke` and `patternOverlay` effects. They change at most 0.41 % of the pixels of one template.

## Consequences

`ag-psd` lists layers bottom to top. A clipped layer belongs to the nearest non-clipped layer below it. An adjustment inside a pass-through group changes all the layers below it, also the layers outside the group.
