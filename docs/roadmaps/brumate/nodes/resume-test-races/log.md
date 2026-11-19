# Log: resume-test-races

- Base 873c81f4. The failing tests of the outline were fixed earlier. Work is the skew reload with server-named bundles.
- Test: `failingHandlers(server, missingBundle)` in `packages/brumate/test/resume.test.ts`. With `missingBundle`, the server renders with `bundles` that name a chunk file that does not exist, and the loader starts with the real `load` of `src/runtime/bundles.ts` (no stub).
- Proof on base: `pnpm exec vitest run test/resume.test.ts -t "bundle that the server names|bundle that is gone"` with bundles.ts from HEAD. Both new tests time out at 5 s. The click logs `TypeError: handler is not a function` (handlers.ts:241), `location.reload` is never called, and the error of the import never reaches `onError`.
- First fix attempt (reject from `allSettled` results) was not enough: a failed bundle is dropped from `pending` when its rejection settles, and `load` runs later, so `waiting` was empty and `load` returned undefined. Fix keeps the failures in a `failed` map (cleared when a load of that URL lands).
- Branch: both tests pass.
- Load noise: a full `pnpm test` run showed three timeouts (two in project.test.ts, one in resume.test.ts "stops updates that keep writing what they read", 5.4 to 12.6 s) while other agents ran suites. They pass alone. A first run of the three files had 2 failures under load (names not kept); the rerun passed 676 of 676.
- Not stubbed navigation: a navigation goes through the same `load`; no extra test.
