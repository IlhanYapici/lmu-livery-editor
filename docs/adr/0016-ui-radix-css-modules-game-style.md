# UI: Radix Primitives, CSS Modules, game style

**Status:** accepted (2026-10-30)

The UI copies the style of the game menus, so that players feel at home. A headless component library gives this freedom: Radix Primitives (dialog, select, tabs, slider, toggle, tooltip, context menu) for behaviour and accessibility, and CSS Modules with CSS custom properties (design tokens) for the look. Radix has no colour picker: use `react-colorful`.

Tokens are in `src/renderer/src/styles/tokens.css`. They come from game screenshots: brand red `#FF1E44`; backgrounds `#0D0D0D`, `#26262C` (panel), `#1A1B22` (field), `#343538` (selected row); navy gradient `#112843` → `#1E3956`. Class colours (from the user): Hypercar `#e21e19`, LMP2 `#005096`, LMP3 `#411c52`, LMGT3 `#009639`, LMGTE `#f08c00`.

Class names follow the game, which uses two forms: the **class name** on the category tabs and titles (Hypercar, LMP2, LMP3, LMGT3, LMGTE), and the **class badge** next to a car name (HY, P2, P3, GT3, GTE, on the class colour).

Fonts: the game font is probably licensed. Titles, tabs and buttons use Bebas Neue; body text uses Roboto. Both use the OFL-1.1 licence. `@fontsource` bundles them, because the app must work offline. Bebas Neue has capitals only: do not use it for text that must keep its letter case (file names, paths).

## Considered options

- Base UI (headless, by the MUI team; some Radix authors work on it). Kept as an alternative: Radix is more widely used, but it gets fewer updates.
- A styled library (MUI, Mantine). Rejected: hard to make look like the game.

## Consequences

- Two Radix parts on one element (for example `Tooltip.Trigger asChild` around a `ToggleGroup.Item`) both write `data-state`, and the last one wins: the tool buttons got `data-state="closed"` instead of `"on"`. Style such elements with their ARIA state (`[aria-checked='true']`, `[aria-pressed='true']`, `[aria-selected='true']`), not with `data-state`.
