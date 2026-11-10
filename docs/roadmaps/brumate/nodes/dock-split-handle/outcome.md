# Outcome: dock-split-handle

## Built

- `packages/brumate/src/runtime/devtools-panel/split.ts` exports `createSplit(root)`, which returns the `split(options)` of the dock context with the signature in `contracts/dock-workspace-api.md`. It returns `{ box, first, second }`; the box holds `first`, a handle and `second`.
- The handle has `role="separator"`, `aria-orientation`, `aria-valuenow/min/max`, `tabindex=0` and a label. A 1px accent line and a small grab bar show on hover, while dragging and on focus (2px); at rest they are invisible. The fades are 0.15s opacity changes, so they reverse mid-way, and are off under `prefers-reduced-motion`.
- Drag uses pointer capture on the handle, so the drag ends on release outside the dock. Arrow Left/Right move 16px, Shift 64px; Home and End go to the limits. Double-click resets to `start`.
- On a dock at the right the panes stack (class `stack`, as in the prototype) under a horizontal handle: row-resize, a 1px line and a 28x4 grab, `aria-orientation="horizontal"`, ArrowUp/ArrowDown, minimums on height. The shell redraws on a side change, so the split is made again in the new orientation. The rules are in `split.ts`.
- Each side's minimum holds in JS (clamp) and in CSS (`min-width`, `max-width: calc(100% - min)`).
- The size is stored as `brumate:devtools:split:<key>:<side>` in localStorage on release and on key press, and read on the next draw. The dock's own height and width stay in the shell's prefs. A stored size is clamped to the minimums.
- `packages/brumate/test/devtools-dock-split.test.ts`: 15 tests (structure, drag, capture, minimums by pointer and keys, Shift, Home/End, restore per key and side, clamp, reset, storage off, and the right dock: orientation, drag, keys, stored size).

## Deviations

- Two files outside the owned paths. `packages/brumate/src/runtime/devtools-panel.ts`: `split: splitPlain` became `split: createSplit(root)`, plus its import. `packages/brumate/src/runtime/devtools-panel/workspace.ts`: `splitPlain` is deleted, since nothing uses it.
- The side goes in the storage key instead of the dock's size. A stored size is clamped when the dock is smaller.

## Gotchas

- The box has no width when `split()` returns, so the first clamp to the maximum happens on the first drag or key press, and in a ResizeObserver where it exists. The CSS holds the maximum before that.
- A redraw makes a new split; the stored size carries the width across.

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate exec vitest run test/devtools-dock-split.test.ts test/devtools`: pass (104 tests). One earlier run had an unhandled error that did not repeat in three reruns.
- `pnpm lint`: pass (warnings elsewhere only). `pnpm format:check`: pass. `pnpm --filter brumate typecheck`: pass after `pnpm --filter brumate build`.
- `pnpm --filter brumate exec vitest run`: 3114 passed; `differential-4` failed once under load and passed twice alone.

## Size

- Estimated S, actual S.
