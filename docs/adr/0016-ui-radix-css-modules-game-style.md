# UI: Radix Primitives, CSS Modules, game style

**Status:** proposed (2026-10-30). Phase 3b implements it.

The UI copies the style of the game menus, so that players feel at home. A headless component library gives this freedom: Radix Primitives (dialog, select, tabs, slider, toggle, tooltip, context menu) for behaviour and accessibility, and CSS Modules with CSS custom properties (design tokens) for the look. Radix has no colour picker: use `react-colorful`.

Tokens taken from game screenshots: brand red `#FF1E44`; backgrounds `#0D0D0D`, `#26262C` (panel), `#1A1B22` (field), `#343538` (selected row); navy gradient `#112843` → `#1E3956`. Class colours: Hypercar `#e21e19`, LMP2 `#005096`, LMP3 `#411c52`, LMGT3 `#009639`, LMGTE `#f08c00`.

Fonts: the game font is probably licensed. Use a condensed OFL font for titles (Bebas Neue or Oswald) and Roboto (Apache 2.0) for body text, bundled with `@fontsource` because the app must work offline.

## Considered options

- Base UI (headless, by the MUI team; some Radix authors work on it). Kept as an alternative: Radix is more widely used, but it gets fewer updates.
- A styled library (MUI, Mantine). Rejected: hard to make look like the game.
