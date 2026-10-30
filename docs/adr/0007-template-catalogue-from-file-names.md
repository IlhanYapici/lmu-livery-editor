# Template catalogue from file names

**Status:** accepted (2026-10-30)

The templates are in one flat folder: 60 files on the October 2026 install. The app builds the tree category → car → variant from the file names only (`src/main/templates.ts`), so it does not open a PSD file before the user selects it.

The names are not regular (`FordMustang_EVO_LMGT3`, `McLaren720EVO_2025 _ELMS`, `Oreca07_ELMS_2025`). Thus the parser finds variant tokens **by value, at any position**: a 4-digit year, `ELMS`, and `EVO` as a separate token. All other tokens make the car name. An alias table joins renamed cars (`ToyotaTR010` 2026 → the `ToyotaGR010` car). A file that does not parse goes to "Other". The app never drops a file.

## Consequences

When a game update adds a car, the car appears with its raw name. To show a better name, add it to `CAR_NAMES`. The test `templates.test.ts` contains all 60 real names: add the new name there too.
