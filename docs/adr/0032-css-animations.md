# UI animations in CSS, with no animation library

**Status:** accepted (2026-11-02)

The UI gets short, quiet animations: popups and dialogs open with a fade and a small scale, and close the same way.

- **CSS only.** Radix sets `data-state` (`open`, `closed`, `delayed-open`…) on its popups, and keeps a closed popup mounted until its CSS `@keyframes` animation ends (Radix "Animation" guide). So a closing animation needs no JavaScript. A CSS `transition` does not delay the unmount: use `@keyframes`.
- **No animation library.** Motion (Framer Motion) gives springs and layout animations, but each Radix popup then needs `forceMount` and `AnimatePresence` for the closing animation. AutoAnimate (list changes) and React Spring do more than the UI needs. Each one is a new dependency to update (ADR-0031). Add one only for an animation that CSS cannot do, for example layer rows that move to their new position.
- **Tokens** in `tokens.css`: `--motion-fast` (120 ms, closing, menus, tooltips), `--motion-normal` (180 ms, dialogs) and `--ease-out`. With `prefers-reduced-motion: reduce`, both durations are 1 ms: no visible motion, but `animationend` still comes, so Radix still unmounts.
- **Shared keyframes** in `global.css`: `fade-in`, `fade-out`, `pop-in`, `pop-out`, `slide-in`. They animate the `scale` and `translate` properties, not `transform`, so they do not replace the `translate(-50%, -50%)` that centres a dialog. A CSS module refers to them as `global(pop-in)`: a plain name gets the module hash and matches no keyframes.
- **Menus and tooltips** scale from the side of their trigger: `transform-origin: var(--radix-select-content-transform-origin)` (or `--radix-tooltip-…`).

## Consequences

- A new popup gets the same motion with three CSS rules (open, closed, transform origin).
- Playwright waits for a closing animation before an element is hidden; the durations are short, so the tests stay fast.
