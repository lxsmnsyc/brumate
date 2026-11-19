# Outcome: head-nonce-keep

## Built

- `headHTML` in `packages/brumate/src/runtime/navigate.ts` strips the `nonce` attribute from a head element's HTML. `updateHead` compares by it, so an element that differs only in the nonce is kept.
- `packages/brumate/test/head-nonce.test.ts`: three tests. `.changeset/head-nonce-keep.md`: patch for `brumate`.

## Proof

- base: `batch/brumate-main`, `npx vitest run test/head-nonce.test.ts` in `packages/brumate`: 2 failed, 1 passed. The nonce elements were replaced and the script was added again.
- branch: same command: 3 passed.

## Deviations

- None. The code matches `headHTML` on release/0.9 without its `HAS_SCRIPTS` flag, so the merge is trivial.

## Stubs left

- None.

## Gotchas

- Browsers show a loaded element's nonce as `nonce=""`, so the test sets it that way. happy-dom does not hide it.
- The regex only touches the start tag, so a text node or a `nonce="` inside the content stays.

## Proposed learnings

- None.

## Verification

- build, lint, typecheck pass. `pnpm format:check` fails on 13 docs files that this change does not touch.
- `packages/brumate` `npx vitest run`: 3264 passed.
- `node e2e/run.mjs --only website`: 75 passed, 0 failed on the rerun (the first run had one unrelated tooltip flake).

## Size

- Estimated S, actual S.

Landed on batch/brumate-main as f5f1ccfd.

Cut into main on 2026-11-19 (078262b1).
