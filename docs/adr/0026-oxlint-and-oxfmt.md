# Lint and format with oxlint and oxfmt

**Status:** accepted (2026-11-01)

The project lints with **oxlint** and formats with **oxfmt** (both from the Oxc project, Rust, MIT), instead of ESLint and Prettier (decision of the user). They are much faster, and oxlint has the rules we need natively: TypeScript, React (`react/rules-of-hooks`, `react/exhaustive-deps`, and React Compiler rules such as `react/set-state-in-effect` and `react/refs`), and `import`.

- `.oxlintrc.json`: the native plugins `typescript`, `react`, `import`; the `correctness` category as errors. `eslint-plugin-i18next` runs through oxlint's ESLint-compatible **JS plugins** (`jsPlugins`): `i18next/no-literal-string` checks JSX text and the user-visible attributes (`aria-label`, `title`, `label`, `placeholder`, `alt`, `text`) in `src/renderer/src/**/*.tsx`; strings without letters (symbols, numbers) are allowed. Tests may use `any`.
- `.oxfmtrc.json`: the existing style: no semicolons, single quotes, 2 spaces, width 140, no trailing commas.
- Commands: `npm run lint`, `npm run format`, `npm run format:check`.
- Disable a rule only for one line, with the reason after `--`, for example `// oxlint-disable-next-line react/exhaustive-deps -- fit only on the first layout`.

## Consequences

- **Maturity.** oxfmt is before version 1.0 (0.75), and oxlint's JS plugin support is marked alpha in its documentation. Both are pinned to exact versions (`--save-exact`); update them on purpose, and run `npm run lint` and `npm run format:check` after an update. If the JS plugin support breaks, replace the i18next rule with a test; do not switch it off silently.
- The first lint run found real issues, fixed in the same change: refs written during render, state copied from props with effects (now React's "previous value" pattern), a draft reset by an effect (now derived from the tool), and missing effect dependencies. Two effects stay, with a reason: the editor stores start a Worker, and the canvas fits only on the first layout.

## Pre-commit hook (added 2026-11-01)

`.githooks/pre-commit` runs `format:check`, `lint` and `typecheck`, and blocks the commit at the first failure (the tests stay in `npm run check` and CI). It needs no dependency: the `prepare` script (run by `npm install`) sets `git config core.hooksPath .githooks`. Git for Windows runs it with its own shell.

- It checks the working tree, not only the staged content: a correct commit can be blocked by a later unstaged change in the same file. oxfmt and oxlint are fast enough that we accept this (lint-staged would remove it, with two more dependencies).
- Emergency bypass: `git commit --no-verify`; CI still runs every check.
- The probes of the hook found that `src/` files outside `main`, `preload`, `shared` and `renderer` were in no tsconfig, so the type check did not see them. `tsconfig.node.json` now includes all of `src/` except `src/renderer/` (the web project).
