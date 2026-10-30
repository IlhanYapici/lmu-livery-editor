# No game content in the app or in the repository

**Status:** accepted (2026-10-29)

The PSD templates, the car names inside them and the logos are licensed game content. The app does not ship them. It reads them from the game install of the user at run time ([ADR-0006](0006-game-detection-order.md)). `.gitignore` excludes `*.psd` and `*.tga`, so a template or an export cannot go into git by mistake.

## Consequences

- Tests use synthetic layers or file names only. Real PSD files stay on the developer PC, outside the repository (for example in a scratchpad folder).
- The UI copies the style of the game, but not its logos or its licensed fonts ([ADR-0016](0016-ui-radix-css-modules-game-style.md)).
