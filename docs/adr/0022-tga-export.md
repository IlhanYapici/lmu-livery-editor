# TGA export: format, folder and backups

**Status:** accepted (2026-10-30)

The export writes `customskin.tga` (the skin) and `customskin_region.tga` (the region map). The format copies the files that work in the game on the test PC (read in `UserData\Liveries` on 2026-10-30): TGA 1.0, image type 2 (uncompressed true colour), 4096 × 4096, **24 bits** (BGR, no alpha), rows from bottom to top (descriptor 0), no footer. The README of the project advised 32 bits; we found no source that gives a meaning for the alpha channel, so we write what works. `src/shared/tga.ts` writes it; a unit test compares the header with the bytes of the working file.

- **Skin:** always the exact compositor ([ADR-0009](0009-own-compositor.md)) with the user layers at the insertion point; the guides are not in it. The template Levels applies, so the values stay in its range (10–225 for the Ferrari 296 LMGT3). Transparent pixels are merged over black.
- **Region map:** see [ADR-0023](0023-region-map-user-layers.md).

The worker makes the files; the main process checks each buffer (`checkGameTga`: 24 bits, exact length) before it writes it.

**Folder.** The game has **one** custom livery slot for all cars: `<game>\UserData\Liveries` (the game shows it on the car that is open in the showroom; RELOAD reads it again). Uploaded team liveries are separate (`UserData\CustomLiveryCache\*.mas`, chosen by `CUSTOMLIVERY.paintBlobID` in `Settings.JSON`). "Export" writes to the game slot after a confirmation; the main process first moves the old files to `UserData\Liveries\Backups\<UTC time>\` and keeps the newest 5 backups. "Export to folder" writes the two files into a folder that the user selects (no backup; it asks before it replaces files).

## Consequences

- Each file is 50,331,666 bytes. The export takes about 4 s for the Ferrari 296 LMGT3 on the development PC; large templates take longer (exact compositor).
- Effects that the compositor does not support are missing in the export too, for example the checkerboard of "Display Panel Position", which comes out black. The user can hide such a group in the Template tab.
