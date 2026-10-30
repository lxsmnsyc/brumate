# Outcome: transition-sibling-text

## Built

- Root cause: not in @brumate/ui and not in the block markers. The report was a `<p>` that holds a `Transition`, which renders a `<div>` by default. The browser's parser closes the `<p>` at the `<div>`, so the start and end markers of the block end in different parents. Plain text beside a Transition (in a `<div>`, a `<section>` or the root) works: probes for it pass.
- `rangeEnd` in `packages/brumate/src/runtime/client/blocks.ts` now names this cause in its "Missing end marker" error.
- Test: `packages/brumate/test/range-end.test.ts` (rangeEnd past nested ranges; the message for markers split by a `<p>`).
- Changeset: `.changeset/block-marker-error-hint.md` (patch).

## Deviations

- The acceptance "a test with text beside an unmounting Transition fails on main" cannot hold: text beside a Transition works, and happy-dom does not close a `<p>` around a `<div>`, so no ui test reproduces the throw. The test covers the new message instead.
- "The Transition demo can drop its `<span>`": the demo is on PR #362 (not on main), and the span is wrong to drop if the text sits in a `<p>`. The demo can use `<Transition as="span">` or keep the text out of a `<p>`.
- The runtime change is the error text only.

## Stubs left

- None.

## Gotchas

- Any block (`#if`, `#for`, Transition) inside `<p>` with a block-level element in it breaks in a real browser. A compile-time check for block elements in `<p>` would catch it earlier; no node owns it.

## Proposed learnings

- Do not put a Transition (default `<div>`) inside a `<p>`; use `as="span"` | the parser splits the markers | packages/ui, website | no

## Verification

- `pnpm --filter brumate exec vitest run test/range-end.test.ts`: pass.
- Probes in packages/ui/test/transition.test.ts: pass (not kept).

## Size

- Estimated S, actual S.
