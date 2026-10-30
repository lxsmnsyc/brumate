# Outcome: client-arrived-cleanups

## Built

- Regression test `a page that arrived by client navigation` in `packages/brumate/test/resume.test.ts` with the fixture `packages/brumate/test/render/arrivedCleanups.brm`. It covers `$effect` and `$client` cleanups of a page that arrived by a client link.
- No core change: the bug did not reproduce.

## Deviations

- The brief expects a test that fails on main. The test passes on main, in happy-dom and in Chrome on the built website (see log.md). I did not invent a fix.
- The e2e acceptance item is skipped: #355 is not on main, and there is no bug to prove fixed.

## Stubs left

- None.

## Gotchas

- On a partial route replace the markup of the old route goes before its cleanups run (they run when the next state record drops its scopes). A full replace runs `leavePage` first. A cleanup must not depend on `isConnected` either way (#355 already handles it).
- The claim in #355's outcome ("`leavePage` never runs on a client-arrived page") is likely a misreading: on the Back path the route drop runs the cleanup, not `leavePage`.

## Proposed learnings

- None.

## Verification

- `npx vitest run test/resume.test.ts -t "arrived by client"` in packages/brumate: 2 pass on main code.
- Chrome probe on the website with and without #355's overlay files: cleanup runs on Back; with #355, 0 layers after Back.

## Size

- Estimated S, actual S (investigation only).
