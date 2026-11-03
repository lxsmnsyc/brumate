# Outcome: browser-async-e2e

## Built

- `examples/browser-async`: a page that renders with nothing pending. Each block opens in the browser. `src/gates.ts` makes promises that stay pending until the test settles or rejects them through `window.gates`, so no step depends on timing.
- `e2e/suites/browser-async/index.mjs`: a flow of 6 steps, registered as `browser-async` in `e2e/run.mjs` and described in `e2e/README.md` (both outside the owned paths).
  - The page loads with nothing open.
  - `#if` branch: the fallback stays while only the memo has settled, then the memo and the promise in text show.
  - `#for` rows: a fallback each, settled out of order.
  - Root boundary: a block outside every `#loading` keeps the old content until its memo settles.
  - `#loading (memo)`: the fallback shows again, and the same nodes and the typed input value come back.
  - `#try`: a rejected wait shows the `#catch` and not the body.
- No runtime bug found.

## Checks

- `pnpm build`, `pnpm lint` (no warnings in the new files), `pnpm format:check`, `pnpm typecheck`: pass.
- `node e2e/run.mjs --only browser-async --no-build`: 3 runs in a row, 6 of 6 each. One more run after the review fixes: 6 of 6.
- Full `node e2e/run.mjs`: website 72, todos 9, tracker 14, nitro 2, kit 5, ui 55, browser-async 6. All passed. The known website tooltip failure did not show.
- Review (fresh pr-review agent): two should-fix items, an unused `made` in gates.ts and a missing wait for `doc-1` before its settle. Both fixed, suite rerun green.

## Follow-ups

- The `#loading (memo)` step accepts the body hidden or absent while the memo loads. Pin one when the hiding behavior is documented.
- Cases not covered: a component inside the branch or row, and a promise in an attribute.
