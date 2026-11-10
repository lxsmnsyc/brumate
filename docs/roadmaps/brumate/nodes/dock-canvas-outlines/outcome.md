# Outcome: dock-canvas-outlines

## Built

- `packages/brumate/src/runtime/devtools-flash.ts`: `installFlash(state, root, host)` draws the update outlines on one `<canvas class="flashes">` (fixed, viewport size, `pointer-events: none`) in the shadow root. It returns `{ boxes, canvas }`.
- The box list holds the element, its viewport rect, heat (`cool`, `warm`, `hot`) and start time. One `requestAnimationFrame` loop drops boxes older than `FLASH_MS`, fades the rest and stops when the list is empty.
- The canvas is sized by `devicePixelRatio` and repaints on resize and scroll, measuring each connected box element again, so fixed and sticky elements and inner scroll containers stay right. A box whose element left the page keeps its last rect. A scroll with no box does nothing. The MutationObserver, the heat counts, `MAX_FLASHES` per frame and the `brumate:devtools:flash` setting are unchanged. No `div.flash` is added and no `setTimeout` removes boxes.
- `devtools.ts` imports `installFlash`; the old function, its constants and the `.flash` CSS are gone.
- `packages/brumate/test/devtools-flash.test.ts`: scroll and fixed element, canvas and pointer events, box list and heat, own markup ignored, frame cap, fade and loop stop, off switch, pixel ratio and resize.

## Proof

Not a fix node.

## Deviations

- `packages/brumate/test/devtools.test.ts` (outside the owned paths): the test "outlines the elements that change" read `div.flash`. It now checks the canvas, that no `.flash` exists and the stored choice.
- `devtools.ts` edit is limited to the import and the removal of the `installFlash` part and `.flash` CSS.

## Stubs left

- None.

## Gotchas

- The test DOM has no 2d canvas context; tests mock `HTMLCanvasElement.prototype.getContext`.
- Boxes hold their element until they fade out (under a second), so nothing is retained.

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate exec vitest run test/devtools-flash.test.ts test/devtools`: pass (47 tests).
- `pnpm --filter brumate typecheck`: pass. `npx oxlint`: no warning in my files. Root `npx oxfmt --check`: pass.

## Size

- Estimated M, actual M.
