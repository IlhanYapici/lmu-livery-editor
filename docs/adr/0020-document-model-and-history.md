# Livery document model and undo history

**Status:** accepted (2026-10-30)

The user's work is one `LiveryDocument` (`src/renderer/src/editor/document.ts`): the template file name, the insertion point, the template visibility overrides, and the user layers (fill, rectangle, polygon, text), bottom to top. All coordinates are template pixels. A shape keeps its scale in its transform; the code does not bake the scale into its size or points. All new layers start in the Base region.

The insertion point and the template visibility are part of the document, not of the template state: a project file saves them, and Undo restores them.

`documentStore.ts` (zustand) keeps the document and an undo history of whole-document snapshots (100 steps). Each action is one step. A gesture is one step too: `beginGesture()` keeps the start document, the changes during the gesture make no steps, and `endGesture()` saves one step. Drags, Transformer changes, the colour picker and the opacity slider use gestures. Number fields commit on Enter or when they lose focus, so that typing makes one step.

## Considered options

- **A command (patch) history.** Rejected for now: the documents are small (a few hundred layers at most), so snapshots are simple and safe. Change it only if memory measurements ask for it.
- **A history library (zundo).** Rejected: the gesture rule is the important part, and it is a few lines.
