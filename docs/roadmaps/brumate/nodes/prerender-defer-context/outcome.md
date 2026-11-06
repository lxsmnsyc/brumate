# Outcome: prerender-defer-context

## Built

- Cause: when the body of a `#defer` block arrives and the browser has written a signal, the core runs the updates of the new scopes again (`refresh` in packages/brumate/src/runtime/client/insert.ts), because the server may have rendered them before the write. The body's update read the context from the page state, which the prerender step stored with no request. It replaced the server's text ("You are signed in as Ada.") with "You are not signed in.". A page with no browser code has no update code, so it kept the server's text.
- Fix: `refresh` takes `onlyWritten`. For the record of a `#defer` body (root `d<boundary>`), only the updates that read a slot the browser wrote run. `writeSlot` adds to the set `written` (`module:kind:slot`, in state.ts), which `resetWrites` clears.
- Tests: `packages/brumate/test/resume.test.ts` (#defer, "renders the body for the request when the browser wrote another value of the page", fails without the fix) with fixtures `deferredWritten.brm`, `DeferredWrittenBody.brm`, `deferredUser.ts`; both fixtures are skipped in `test/differential/data.ts` (a #defer block renders only on the server). Tracker: new prerendered page `/team` (`src/routes/team.brm`, in `vite.config.ts` and the nav) and the e2e step "/team: browser code on a prerendered page keeps its #defer line for the user" (fails on the base, 13 of 14 passed, now 16 of 16). The /about step is unchanged.
- Changeset: .changeset/defer-body-prerendered.md (patch).

## Deviations

- None. Stacked on #474 (prerender-search-params) because both edit examples/tracker and the tracker suite.

## Stubs left

- None.

## Gotchas

- A first try limited every refresh to written slots. It broke 4 resume tests (children of a spread that the server did not render, a memo that loads in a `#try`), because `refresh` also fills in markup that only the browser renders. So the limit holds for `#defer` bodies only.
- Inside a `#defer` body, a child component's browser-only inserts that no written slot reaches are not refreshed.
- packages/brumate tests import src through aliases, so a src change shows in tests without a build, but the examples need `pnpm build` in packages/brumate.

## Proposed learnings

- None.

## Verification

- Tracker e2e: 16 passed, exit 0. The /team step fails on the base.
- Tests, each exit 0: packages/brumate 2803, language-server 7, tsc 2, ui 772 (1 expected fail), vscode 5; examples hackernews 5, kit-app 1, nitro 3, todos 4, tracker 17, ui-kit 2.
- Root `npx oxlint`, `npx oxfmt --check` on changed files, and `tsc --noEmit` in packages/brumate: exit 0.

## Size

- Client gzip -9 of dist/client/**/*.js, before and after: examples/todos 39293 B to 39349 B (+56 B); examples/ui 199049 B to 199100 B (+51 B).
- Estimated S, actual S.
