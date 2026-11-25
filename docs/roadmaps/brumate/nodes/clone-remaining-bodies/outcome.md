# Outcome: clone-remaining-bodies

## Built

- All 20 bodies that gave `return $$html` now clone. `test/clone-bodies.test.ts` has no list any more and expects none (`found` equals `[]`).
  - `#try` in the browser: `emitTryNodes` (codegen/markup.ts) writes `$$b.nodes($$b.tryNodes(body, catch[, 1]))` between the HTML markers. Body and `#catch` are body functions that clone. `tryNodes` (runtime/client/waits.ts, exported from `client.ts`) runs the body, through `attempt` when the `#try` catches client code (`1`), and on a throw drops the work that the body queued in `afterInsert` and renders the `#catch` function.
  - Windowed `#for`: `emitWindowNodes` writes the spacers as static markup and `listNodes(scope, anchor, list.slice(0, shown), body, other)` between them. The `<template b-client>` of the window is part of the clone; `keep` (templates.ts) now writes `b-b` for an element with `b-client`, which `windowStart` needs.
  - `#offscreen`: `offscreenNodes` (templates.ts), markers `:1` or `:-1`.
  - A body script with `$id`: `cloneLines` (codegen/template.ts) lets `const x = $$b.makeId(...)` and `})();` (a portal) stand between the writes.
- Portals keep their source order in a clone (`cloneLines`, codegen/template.ts): the portal IIFE and its `addPortal` call are placed among the clone's writes by their position in the source (`order` of component and block writes), not before them all. A portal after a fill and before a later place cannot be ordered, so that body does not clone. Pages `portalOrder.brm`, `portalOrderOffscreen.brm` guard it in the differential test.
- `tryNodes` also destroys the scopes that the thrown body made (page `tryScopes.brm`, a describe in resume.test.ts). The old inline path did not.
- The audit's `try-rollback` is partly met: the body's `afterInsert` work no longer survives a catch. The title is not rolled back. No DIVERGENCES entry changed.
- Commits: one. The `#try` nodes form and the other cloners are independent of the template fragment return (below), which is not built.

## Proof

- base: 25d4c5f6, `pnpm --filter brumate exec vitest run test/clone-bodies.test.ts` passed with 20 listed bodies. `pnpm bench --only brumate --scenario todos`: JS before `load` 35.3 kB / 14.6 kB gzip.
- branch: same test passes with an empty list (and `cloneTry`, `cloneTemplate`, `clonedForeignTry` pages of resume.test.ts pass: a constant async memo fills a `#try` body, with a `#client` block, on server and in the browser). Same bench: 35.3 kB / 14.6 kB gzip, so within 0.3 kB (load average 17, noisy).

## Deviations

- Acceptance 1 is half met: no body gives HTML, but `#template` functions still return `$$b.raw($$html, scope)` (markup.ts `emitTemplate`). Not built, see Gotchas for the attempt and why it was dropped. This is what `no-client-html` still needs, together with `children` closures.
- Edits outside the brief's lists: `test/feature-flags.test.ts` (a `#try` no longer turns `clientHTML` on), 5 snapshots under `test/__snapshots__/render/` (blocks, fields, offscreen, portal, retry).
- No changeset: no user-visible change.

## Stubs left

- `$$b.raw` for `#template` functions, and HTML in `children` closures: for `no-client-html`.

## Gotchas

- Template fragment return, tried and reverted: `emitTemplate` cloned (`cloneLines(this, hoist, fn, template.body)`) and returned `$$b.rawNodes($$f, scope)`, a client class `TemplateNodes` that `insert` turns into `holdPlace(nodes)`. That needs `clientHTML` on (features regex `rawNodes\(`) and `$$b.sharedTemplate` for the constants of `withTemplates` (client.ts), which lands code in another part than the current one. Result: 8 tests of resume.test.ts failed, all in-place template updates: `tplInPlaceHost` keyed list ends with 15 scopes, not 11 (the scopes of a cloned template's output are not found or destroyed when the insert replaces them: `renderedTemplate`/`inRange`/`destroyNodes` in runtime/client/inserts.ts read `b-b` attributes, which `keep` only writes on top-level or `b-on` elements), plus `gapTemplate`, `tryTemplateProp`, `tryTemplateNested`. The next attempt should start in `inserts.ts` (`keptNodes`, `destroyNodes`).
- `clonedMarkup` is global: a clone must be inserted right after it is made. The nodes forms keep that order.
- A new `HTML` fallback in a body now fails `clone-bodies.test.ts` outright.
- Running the whole brumate suite while other workers run (load 17) times out dozens of tests; each file passes alone.

## Proposed learnings

- A block with markers around it renders through a `$$b.nodes(...)` helper, so the markup around it clones | six block kinds do it now | packages/brumate/src/codegen | no

## Verification

- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`: pass. `pnpm build`: pass.
- brumate: `clone-bodies`, `resume` (669), `render`, `template`, `differential-1..4`, `feature-flags`: pass (resume once under load showed 77 failures, passed alone). Full run excluding `test/trace-browser`: only differential windowed, feature-flags failures before fixes; fixed and rerun green. The `test/trace-browser` failures of the first full run did not reproduce: 25 of 25 pass on the branch and on the base, so they came from load or a missing build.
- `pnpm --filter @brumate/ui exec vitest run`: 14 failures in the full run under load, all pass when the 10 files run alone (109 tests).
- Not run: `node e2e/run.mjs`.

## Size

- Estimated M, actual M (the template half would be L).
- Risk estimated medium, measured medium: the error path of `#try` changed (queued work dropped on a throw), and the windowed list and offscreen markers changed form; e2e not run.
