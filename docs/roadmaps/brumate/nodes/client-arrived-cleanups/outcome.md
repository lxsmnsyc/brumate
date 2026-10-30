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
- The #355 repro is a race in its check. `page.goBack()` sets `location.pathname` at once, but the old route's cleanups run when the new page's state record is read, after the fetch. Waiting for the pathname and asserting at once sees the old layer. The cleanup does run (probe: `remove 17.0.1.4`, layers 0 after 1.5 s). #355's e2e step must wait for the new page. "`leavePage` never runs" is true but irrelevant: a partial replace uses `removeScope`.

## Proposed learnings

- None.

## Verification

- `npx vitest run test/resume.test.ts -t "arrived by client"` in packages/brumate: 2 pass on main code.
- Chrome probe on the website with #355's overlay files and the exact steps of the #355 worker: 1 layer right after the pathname changes, 0 after 1.5 s; the cleanups of scopes 17.0.1.4 and -6 are logged by `removeScope`.

## Size

- Estimated S, actual S (investigation only).
