# Test strategy: synthetic templates, integration tests, end-to-end tests

**Status:** accepted (2026-11-01).

Real templates are game content and cannot be in the repository ([ADR-0002](0002-no-game-content-in-app-or-repo.md)). So the tests generate their own templates:

- **Synthetic templates** (`tests/fixtures/templates.ts`) are written with `ag-psd` `writePsd` **at test time** (no binary files in git). They are 64 × 64 px with fixed geometry, and they copy the cases that the audit of the 60 game templates found ([ADR-0010](0010-guide-layers-by-position.md)): the Ferrari 296 layout (names as expected, Levels 10–225, base colour from a colour overlay, region layers shaped by masks, a hidden LM plate set), the Aston Martin Vantage layout (wireframe named "Background", found from its position), the Lamborghini SC63 layout (Levels and Hue/Saturation in a masked pass-through "Clamp" group, "Maks" typo) and the Valkyrie layout (no mask guide, "Regions", "UVW").
- **Unit tests** live next to the code (`src/**/*.test.ts`). **Integration tests** (`tests/integration/`) run the whole chain on the synthetic templates: read → guides → segments → exact merge → region map → TGA, plus the template folder scan and the template protocol. They check exact pixels (for example, a decal stays above the user layers through the Levels).
- **Coverage**: `npm run test:coverage` (v8; HTML report in `coverage/`). No minimum yet. The core logic is covered (compositor, roles, segments, region map, TGA, project files, catalogue, detection, export); UI, worker and Electron entry code are for the end-to-end tests.
- **End-to-end tests** (`tests/e2e/`, `npm run e2e`): Playwright starts the real built app (`_electron.launch`). The fixture (`tests/e2e/fixtures.ts`) writes the synthetic templates into a temporary game folder, gives the app its own user-data folder through the test-only variable `LMU_USER_DATA_DIR`, sets the window to 1400 × 900, and stubs the main-process dialogs (`electronApp.evaluate`): the real IPC and file code runs, only the user's answer is fixed. Scenarios: game folder selection and catalogue, drawing and undo with a field that commits on Enter, image import and the enlargement warning, save / reopen / unsaved-changes question, close with unsaved changes, export to the game with TGA checks and a backup, and the language switch kept after a restart. About 18 s for the 7 tests.
- **The real-template audit** ([ADR-0012](0012-template-audit-as-reference-test.md)) stays a manual check on a PC with the game, after game updates.

## Consequences

- `ag-psd` writes Levels only with `channels: [...]`; an `rgb` key is silently dropped.
- Offscreen Electron windows never get the system focus, so focus-based behaviour (fields that commit on blur) cannot be tested that way; the Playwright tests use a real window. On Linux, the windows open on the desktop unless Xvfb is used; CI runs on Windows.
- The fixture answers "Don't save" before it closes the app: a real close question is a modal dialog that blocks the main process (it made the first runs hit the teardown timeout).
- Radix single toggle groups have the role `radiogroup` (items: `radio`); select them by role and accessible name.
- The first runs found two app problems, fixed with the tests: in a narrow window the side panel left almost no canvas (the window now has a minimum size of 1200 × 760), and the view did not fit again when the window got its final size after the first layout (it now fits on resize until the user zooms or pans; the Fit button resets this).
- A new case found in real templates should become a new synthetic variant and an integration test.
