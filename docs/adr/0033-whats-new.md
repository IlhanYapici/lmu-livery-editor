# "What's new" after an update

**Status:** accepted (2026-11-04)

After an update, the app shows what changed since the version that the user had before. The About section (Game folder dialog) shows the full history.

## Source of the text

- **Our own entries, not the changelog.** release-please writes `CHANGELOG.md` from the commit messages: English only, with internal items ("less noise in the updater log"). The entries are short texts for users, in English and French, with optional screenshots.
- **One folder per entry** in `src/renderer/whats-new`: `NNNN-name/en.md`, `fr.md` and images. The number is the entry id. The name is only for the developers.
- **An id, not a version.** A pull request does not know its release version: release-please chooses it later and rewrites its own pull request branch (a commit added there is lost). The app keeps the highest id that the user saw (`whatsNewSeen` in `settings.json`) and shows the entries with a higher id, whatever release they came with. The history has no version headings.

## Entry format

```markdown
---
kind: new
---

## Title

Text in **Markdown**. ![What the image shows](screenshot.webp)
```

- Front matter: `kind: new` or `kind: fixed`, nothing else. Both languages have the same kind.
- The text starts with a `##` title.
- No raw HTML. Links start with `https://`. An image is a file of the entry folder, WebP or PNG, 300 KB or less: each update download contains all the images.
- `tests/integration/whatsNew.test.ts` checks these rules on the real folder; `npm run check` fails on a break.

## Rendering

- `import.meta.glob` bundles the texts and images at build time (`src/renderer/src/whatsNew/content.ts`). Nothing is read from the disk or the network at runtime.
- `marked` makes the HTML (`src/shared/whatsNew.ts`, with the rules above), and DOMPurify sanitizes it, as the marked documentation recommends. The text comes only from the repository, so this is a second protection. Without a DOM (Node), DOMPurify returns its input unchanged: `safeEntryHtml` then gives escaped text, never raw HTML.
- `marked` has no dependencies, DOMPurify one (types). `react-markdown` gives React elements with no `innerHTML`, but adds 11 packages to update (ADR-0031).

## When the dialog shows

- **New install** (no `settings.json` when the app started, read before any setting is saved): no dialog. The app saves the latest id at once.
- **Update from a version before "What's new"** (settings, but no `whatsNewSeen`): every entry, once.
- **Later updates:** the entries with an id higher than `whatsNewSeen`. OK or Escape saves the latest id.
- The renderer asks after the first answer of `locateGame`: both can save `settings.json` at start, and the saves must not overlap.

## Links

The window never leaves the app page: `will-navigate` blocks every navigation except a reload, and `setWindowOpenHandler` blocks every new window. An `https:` link opens in the system browser (`shell.openExternal`); other links do nothing (`src/main/links.ts`).

## Consequences

- A user-visible `feat` or `fix` adds an entry folder in the same pull request (CONTRIBUTING.md). Internal changes add none.
- The French text is reviewed like the other French texts.
- The end-to-end fixture writes `whatsNewSeen: 9999` by default, so other tests never see the dialog.
