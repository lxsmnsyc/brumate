# Outcome: loading-await-clone

## Built

- `emitLoadingBody` (codegen/markup.ts) in the browser now writes the start marker of the block through the `markup` callback of `emitBody`, which runs after the script and after the `await` split. The marker and the end marker are in the rest of the render, next to the markup, so the body function clones. `awaitLoadingOn.brm` now compiles to `$$b.template("<!--x0--><p ...></p><!--/b-->")` with `$$b.markBlock($$e[0], $$s2, 0, ":1")` in the callback of `$$b.wait`. The server path is unchanged (marker before the body).
- No runtime change: `wait` already inserts the rest between its range comments, so the DOM is the same as before, except that the `<!--t..:1--><!--/t-->` pair around unkept text goes, as in any clone (`<!--l..:w--><!--bN:0:1-->...<!--/b--><!--/w-->`).
- Test changes: `clone-bodies.test.ts` no longer lists `awaitLoadingOn.brm` as a page with `clientHTML` on (6 pages left, all templates that render from HTML). New pages `awaitLoadingNested.brm` (differential: an awaited `#loading (name)` body with a component and an `#if`) and `awaitLoadingNestedOn.brm` (a browser render of that body), and a resume test for the second.

## Proof

- base: 9c2b67f4. clientHTML pages in `clone-bodies.test.ts`: `awaitLoadingOn.brm`, `tplAmbiguousBox.brm`, `tplAmbiguousInner.brm`, `tplChildrenParam.brm`, `tplFunctionText.brm`, `tplMarkText.brm`, `tplSvgWrap.brm` (7). Todos JS before `load`: pending: bench lock.
- branch: the same list without `awaitLoadingOn.brm` (6). Todos JS before `load`: pending: bench lock. Todos has no `#loading` body and its flag was off on the base, so no change is expected.

## Deviations

- The Todos size check (acceptance 3) is not measured: the bench lock is held by another agent.
- What stays, and why: nothing of `holdPlace`, `placed`, `placedCount`, the `<!--f` parse in `parseHTML`, lazy indexing (`unindexed`, `indexInserts`), the `HAS_CLIENT_HTML` gate or the `clientHTML` flag could go.
  - 6 pages still turn the flag on: templates whose top element is `<a>`, `<script>`, `<style>` or `<title>` render from `$$b.raw($$html, scope)`, and their inserts hold places in the string (`plan.rawPlaces`). `RAW_TEMPLATES` in clone-bodies.test.ts names them.
  - The flag also covers any body that `cloneLines` still refuses (markup in a branch between flushes, two declarations of one name, a part it cannot read), which the compiler cannot rule out in user code. `return $$html;` stays a valid body result, so `insert`, `component`, `dynamic` and `nodes` keep their HTML path.
  - To remove them, ambiguous-top templates must clone (the idea in no-client-html: `raw` carries the template and the insert clones it with `findForeign`), and refused clones need an error or a fallback that is not HTML.
- The marker moves after the script for the browser only. A `#loading` header body with no `await` has the same output as before (the marker flush is the first flush).
- No changeset: no user-visible change.

## Stubs left

- `$$b.raw` for ambiguous top elements (see no-client-html).

## Gotchas

- `emitBody(body, true, markup)` runs `markup` after `awaitMarkup`, so anything written there lands inside the rest after an `await`. Write a start marker there, not before `emitBody`, or the body cannot clone.
- A resume test of a server-rendered `#loading` body sees the fallback first, and the body only after the stream. Drive a browser render (a toggle) to test the body.

## Proposed learnings

- Write the markers of a body with `emitBody`'s `markup` callback, not before the call | markers before the script split the HTML from the markup after an `await` | packages/brumate/src/codegen | no

## Verification

- `rtk proxy pnpm lint` (warnings only, none new), `pnpm format:check`, `pnpm typecheck` (after `pnpm build`): pass.
- brumate: clone-bodies, feature-flags, render, template, codegen, differential-1..4, resume (2164 tests): pass.
- `pnpm --filter @brumate/ui exec vitest run`: 846 passed, 2 expected fail.
- `node e2e/run.mjs --only ui,browser-async,tracker`: ui 61, browser-async 6, tracker 18 passed.
- Not run: `pnpm bench` (lock held by another agent).

## Size

- Estimated M, actual S: one codegen call site changed; the rest is tests.
- Risk estimated medium, measured low: the DOM output is the same and the suites pass. The server render is untouched.
