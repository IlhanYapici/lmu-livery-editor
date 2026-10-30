# Keep the Levels adjustment of each template

**Status:** accepted (2026-10-30)

Every template has a Levels adjustment above the content layers (sometimes named `Albedo`). It limits the output range of the skin texture, probably for the shader of the game. The range is different for each car: 10–225 (Ferrari 296 LMGT3), 10–210, 0–220, 15–210 (Ferrari 488 GTE), 0–240 (Corvette C8.R). In Ligier JS P325 it is hidden.

The export keeps the Levels layer at its place in the layer stack, with its saved visibility. The app does not use one fixed range for all cars.

## Consequences

User layers go below the Levels layer, so the Levels also change the user colours. A colour picker that shows the colour "as in the game" must apply the Levels of the template.
