# Test strategy: synthetic templates, integration tests, end-to-end tests

**Status:** accepted (2026-11-01). The end-to-end part is planned (Phase "tests and CI", part 3).

Real templates are game content and cannot be in the repository ([ADR-0002](0002-no-game-content-in-app-or-repo.md)). So the tests generate their own templates:

- **Synthetic templates** (`tests/fixtures/templates.ts`) are written with `ag-psd` `writePsd` **at test time** (no binary files in git). They are 64 × 64 px with fixed geometry, and they copy the cases that the audit of the 60 game templates found ([ADR-0010](0010-guide-layers-by-position.md)): the Ferrari 296 layout (names as expected, Levels 10–225, base colour from a colour overlay, region layers shaped by masks, a hidden LM plate set), the Aston Martin Vantage layout (wireframe named "Background", found from its position), the Lamborghini SC63 layout (Levels and Hue/Saturation in a masked pass-through "Clamp" group, "Maks" typo) and the Valkyrie layout (no mask guide, "Regions", "UVW").
- **Unit tests** live next to the code (`src/**/*.test.ts`). **Integration tests** (`tests/integration/`) run the whole chain on the synthetic templates: read → guides → segments → exact merge → region map → TGA, plus the template folder scan and the template protocol. They check exact pixels (for example, a decal stays above the user layers through the Levels).
- **Coverage**: `npm run test:coverage` (v8; HTML report in `coverage/`). No minimum yet. The core logic is covered (compositor, roles, segments, region map, TGA, project files, catalogue, detection, export); UI, worker and Electron entry code are for the end-to-end tests.
- **End-to-end tests** (planned): Playwright starts the real built app, with the synthetic templates in a temporary game folder, a separate user-data folder, and stubbed dialogs (`electronApp.evaluate` in the main process).
- **The real-template audit** ([ADR-0012](0012-template-audit-as-reference-test.md)) stays a manual check on a PC with the game, after game updates.

## Consequences

- `ag-psd` writes Levels only with `channels: [...]`; an `rgb` key is silently dropped.
- Offscreen Electron windows never get the system focus, so focus-based behaviour (fields that commit on blur) cannot be tested that way; the Playwright tests use a real window.
- A new case found in real templates should become a new synthetic variant and an integration test.
