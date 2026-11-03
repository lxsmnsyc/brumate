# Outcome: no-html-string-fallback

## Built

- Every block body that the browser renders clones a template, for every block kind (`#try`, `#catch`, `#switch`, `#portal`, `#client` and so on; only `#if`, `#for` and `#loading` did before). `packages/brumate/src/codegen/client.ts` (`emitRender`).
- A template with a `<template>` element or other comments clones too. `clonedTemplate` flags it `indexed`, and the output is `$$b.template(html, n, foreign, 1)`. `clone` then calls `markCloned()`, so the insert of each clone indexes its markers and starts its `<template>` elements; `parseTemplate` no longer starts the ones in the template itself. `packages/brumate/src/codegen/template.ts`, `src/runtime/client/templates.ts`.
- A nested block with no fill call (such as `#client`) keeps its markers through `markBlock` instead of forcing HTML.
- `portalTo` accepts a fragment. `src/runtime/client/inserts.ts`.
- Client code of the 1.0k-page test corpus: 223 `return $$html` and 43 `$$b.raw` bodies before, 0 `r`/`n` bodies with `$$b.raw`, 19 `r`/`n` bodies with `return $$html` after.
- Tests: `test/clone-bodies.test.ts` (compile-time list of the bodies that still give HTML; a body that clones must leave it, a new one must not join), `test/template.test.ts`, a describe in `test/resume.test.ts` with pages `test/render/cloneTry.brm` and `cloneTemplate.brm` (constant async memo fills a `#try` body, with a `#client` block, on server and in the browser). 5 render snapshots updated.

## Deviations

- First acceptance criterion: partly met: 19 bodies, listed in test/clone-bodies.test.ts. Still on HTML: `#try` that renders in place between markers (try/catch with a rewind of `$$html`), `#for` with a window, `#offscreen`, waits in a body script (19 bodies, listed in `clone-bodies.test.ts`), plus `#template` functions (they return `$$b.raw`) and `children` closures. Cloning these needs a nodes form of `#try` (a `tryNodes` helper) and a fragment return for template calls; each is more than S. Proposed as follow-up nodes.
- New file `packages/brumate/test/clone-bodies.test.ts` (outside the shared paths, test only).
- Runtime change in `inserts.ts` and `templates.ts` (under the shared `runtime/client/**`).
- No changeset: no user can see the change.

- The held-write fixes (#419, #421) do not reach the in-place `#try` pages yet: their bodies still render HTML.
- Review fix: a body inside `<svg>` or `<math>` gets its namespace from the elements around it (`foreignContext` in `template.ts`, for every block kind and for children), not only from its first element. Tests: `clonedForeignTry.brm` in `resume.test.ts`.
- The mis-indented `createScope` line in `clientElse.txt` is left (cosmetic, from the plain block that the clone drops).

## Stubs left

- The list `HTML_BODIES` in `clone-bodies.test.ts` (19 bodies).

## Gotchas

- `clonedMarkup` is global and consumed by the next `insertHTML`; `clone` of an `indexed` template sets it, so a clone must be inserted right after it is made.
- Differential test: no entry of `DIVERGENCES` changed, count unchanged (no "no longer differs" failure).
- Timing flakes on a loaded machine: differential-4 `ResolveGoneChild`, feature-flags-off dynamic tags and 3 resume tests failed once in the full run and passed alone.

## Proposed learnings

- A new fallback to an HTML string in a body of the browser must be added to `HTML_BODIES` on purpose | the test lists them | packages/brumate/test | yes

## Verification

- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`: pass. `pnpm build`: pass.
- `pnpm test`: 2716 of 2726 passed in the full run; the 10 failures were 5 render snapshots (updated, now pass) and 5 timing tests that pass alone.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 13.6 kB gzip (`next`: 13.5 kB), within 0.3 kB.
- Not run: `node e2e/run.mjs`.

## Size

- Estimated S, actual M: the long tail of causes was found by counting, and the portal and flag changes needed runtime edits.

- Note: the list now has 20 entries; the review-fix page `clonedForeignTry.brm` holds an in-place `#try`, so its outer body is on the list too (the `#try` body inside it clones).
