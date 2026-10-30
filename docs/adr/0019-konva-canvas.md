# Konva for the editor canvas

**Status:** accepted (2026-10-30)

The editor canvas uses Konva through `react-konva` (`src/renderer/src/editor/EditorCanvas.tsx`). Konva gives shapes, text, hit detection and a `Transformer` (move, scale, rotate) on a 2D canvas, and `node.toCanvas()` draws the user layers at template size for the exact preview and for the export.

The scene uses one Konva layer (one HTML canvas) for each part: paint (template segments and user layers), region map, mask guide, wireframe, and tools (drafts and the Transformer). Thus CSS can treat each part alone: the paint gets the template table filter, the wireframe gets `mix-blend-mode: screen`.

All user shapes live in **template pixels** (0..4096) inside a group that carries the camera (zoom and pan). The Transformer writes the result back to the document only at the end of a gesture.

## Considered options

- **Fabric.js.** Similar features, but its object model owns the state; with React and an undo history, Konva's "the document is the state" model is simpler.
- **Plain Canvas 2D or WebGL.** Rejected: hit detection, handles and text layout would all be our own code.

## Consequences

- Canvas text needs its font loaded first. The canvas loads the bundled fonts (`FONTS` in `document.ts`) and redraws when they are ready.
- Template images do not listen to the mouse, so a click on an empty area reaches the stage itself; this clears the selection.
- Pan stays on the middle button and Space + drag, so the left button is free for the tools.
