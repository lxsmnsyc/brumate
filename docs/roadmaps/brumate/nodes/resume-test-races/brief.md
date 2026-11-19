---
id: resume-test-races
title: Resume tests that race, and a test of a skew reload
status: done
priority: must
type: fix
story:
early: false
outline: false
milestone: 0.8.1
target: main
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/resume.test.ts test/bundle-urls.test.ts test/skew.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent: 140000
owns: []
shared:
  - packages/brumate/src/runtime/bundles.ts
  - packages/brumate/src/runtime/client/code.ts
  - packages/brumate/src/runtime/client/references.ts
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/bundle-urls.test.ts
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: release-0.8
    kind: hard
    why: it branches from `main` after the 0.8.0 promotion
---

> 2026-11-19 (refine): the three flaky tests of the outline were fixed before this node was planned. What is left is the skew reload test, which by code reading fails on main.

# Resume tests that race, and a test of a skew reload

## Goal

After a deploy, a page built against the old build must load again (once per build) when the code of a handler is gone. With the server-named bundles of bundle-urls-from-server (#425), a missing bundle does not reach that path. Add the test that the brief of bundle-urls-from-server asked for ("a skew reload"), and fix the load so it passes.

## Context

The three flaky tests of the outline, checked on origin/main (d64fb2eb):

- "reads a memo created in the browser as pending until its first load lands": fixed by 1edc1f70 (2026-11-03, branch hotfix/flaky-resume-reads), which gates the first fetch until the test calls `land()`.
- "shows a pending memo of a promise prop as empty text in a textarea": same commit, "held body waits for update code of settled memos", with a guard test "… when its code loads late". No CI failure of either test since (Test workflow failures from 2026-11-04 to 2026-11-19 checked).
- "a dynamic tag that spreads the rest props > gives the element of a component in as…": failed in CI on 2026-11-06 (feat/context-stores), fixed by 92b56447 (2026-11-07, rest-ref-test-wait), which waits for the first read.
- Seen instead: "renders a #try body again with reset" timed out (5 s) in CI on main on 2026-11-06 and 2026-11-07, and not since. Not in scope; note it in the outcome if it shows in your runs.

The skew path, by code reading:

- `resolve` (`runtime/client/references.ts`) reloads when `loadModule(id)` throws and the server answers another build (`serverBuild`, `loadOnce`).
- With bundles, `options.load` is `load` of `runtime/bundles.ts`. A bundle whose `import()` fails is dropped from `pending` (`promise.catch(() => pending.delete(url))`), and `load` returns `Promise.allSettled(waiting).then(() => loaded.get(id)!)`, which resolves to `undefined`.
- `loadModule` (`runtime/client/code.ts`) reads `undefined` as "a component without client code" and caches `{ id, props: {}, g: {} }`. `resolve` returns `module[name]`, `undefined`, with no throw, so no reload: the click does nothing.
- The existing skew tests (`failingHandlers` in resume.test.ts, about line 230; skew.test.ts) stub `load` to reject, so they never run `bundles.ts`.

Fix direction: `load(id)` rejects when a bundle that the records named failed and `id` is still not loaded (rethrow that failure), so `resolve` reaches the skew path. Keep "a component with no client code" (no record names a bundle for it) resolving to `undefined`.

## Acceptance

- [ ] Prove it first on main: a test that shows a page whose state record names a bundle URL that fails to import (`b-load`, with the real `brumate/bundles` `load`), a server that answers another build, and a click on a handler. It expects `location.reload` once and a `brumate:skew` event `code`; it fails on main. A second click after the same build is seen again does not reload (`loadOnce`).
- [ ] The fix: the test passes; the same build with a missing bundle reports the load error to `onError` instead, as "reports the error of code that fails to load when the build is the same" does.
- [ ] bundle-urls.test.ts and the skew tests still pass.
- [ ] A patch changeset for brumate.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`; `pnpm --filter brumate test` passes.

## Sizing

S: one function in bundles.ts and one or two tests.

## Notes for the worker

- Time-box any flake check: run the three old tests and the base a few times each (5 at most); do not loop the suite.
- A navigation to a page whose bundle is gone goes through the same `load`; cover it in the test if it is one more step.
