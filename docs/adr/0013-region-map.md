# Region map: game names, colour from pixels

**Status:** accepted (2026-10-30)

The region file (`customskin_region.tga`) tells the game which material goes where. The app uses the 5 regions with the names of the in-game livery showroom: Base (black), Carbon (red), Option 1 (green), Option 2 (blue), Stickers (white). The user selects the real materials in the game, not in the app.

In the templates, each region layer is a full layer of one flat colour, and its layer mask gives the shape. The layer number does not give the region: in the Ferrari 296 LMGT3 template, `Region 2` is blue and `Region 4` is green. Thus `buildRegionMap` reads the colour from the pixels, and it snaps each merged pixel to the nearest of the 5 colours. The region group is hidden in the templates, so the code draws all region layers whatever their saved visibility.
