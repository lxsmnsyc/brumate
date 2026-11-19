# Log: head-nonce-keep

- 2026-11-19 Base `batch/brumate-main`. Added `packages/brumate/test/head-nonce.test.ts` (happy-dom, a live head with `nonce=""` as browsers show it, the next page with `nonce="n2"`).
- Base proof: `cd packages/brumate && npx vitest run test/head-nonce.test.ts` gave 2 failed, 1 passed. The nonce style, link and script were replaced, and the script was added again.
- Fix in `runtime/navigate.ts`: `headHTML` strips the `nonce` attribute from the start tag, as on release/0.9. `updateHead` uses it for both keys.
- Branch: same command gave 3 passed. `head-rerun.test.ts` still passes.
- Checks: build ok; lint ok (warnings only); typecheck ok; `packages/brumate` tests 3264 passed.
- `pnpm format:check` fails on 13 docs files (debates ledger, roadmap briefs, one outcome.md). None is in this change.
- `node e2e/run.mjs --only website`: first run failed `/ui: the overlays open, save, close and give focus back` (Escape left the tooltip), unrelated to the head. Rerun: 75 passed, 0 failed, so a flake.
