# Log: browser-await-spike

- 2026-11-01: read GOAL, the brief, browser-async and the outcome of streamed-memo-reads. No outcome.md yet.
- The render module compiles `const user = await $memo(load(id))` to `const user = (load(id));`, so `user.name` reads a promise. A browser render of `#loading` drops the block and renders the body only (markup.ts, client mode).
- Every render is sync and returns `string | DocumentFragment`. About 15 call sites in the runtime insert the result (branches, lists, children, templates, errors, components).
- Option 3 prototype: `wait()` and `loading()` in `src/runtime/client/waits.ts`, and a test (`test/_spike/await.test.ts`) that compiles the fixtures in `prototype/` and splits the render of User.brm by hand at the await, as the compiler would. 4 tests pass: `#loading` fallback then body, no `#loading` (the place fills later), a branch that closes while it waits, `#for` rows. The memo loads once.
- Found while prototyping: `createScope` returns an ID, not the scope. The scope must leave `rendered` until its rest runs, or the insert around it runs its memos with no slots. The continuation must set the settled value in the slot, not the promise, or `startLoading` runs the updates with the promise.
- Bench (lock taken and released): todos JS before `load` 14,829 B gzip with `wait` and `loading` exported, 14,824 B without, on 6adea8fb.
- Sizes with esbuild + gzip -9 over a base entry of 10,254 B: option 3 +301 B, option 1 helpers +225 B, option 2 on 4 of 15 insert sites +53 B. Async calls cost 0.05 ms per 1,000 (node).
- Saved the prototypes as `prototype/option3.patch` and `prototype/options-1-2.patch`, then removed them from `packages/`. Wrote outcome.md.
- Review round 1 (PR #411): a closed `#if` kept the markup of a waiting child after the load. `<!--w-->` does not match `MARKER`, so `rangeEnd` stopped at the first `<!--/w-->`. Renamed the starts to `l<id>w` and `l0b`, and the tests now check closed blocks at 300 ms, past the 150 ms load.
- A browser-rendered `#try` has no `t` entry, so `fail` cannot reach it. Not fixed in the prototype. Owner: browser-try.
- Root boundary prototype: `hold` in `branch`, `loading` with an empty fallback for new rows, flag `__BRUMATE_HAS_ROOT_WAIT__`. A held row needs an item marker, or the list renders it again (load ran twice). 13 spike tests pass in both modes. The resume, order and batch suites pass with the flag on (426).
- Bench (lock taken and released): todos flag off raw 35,467/35,468 B, gzip 14,819/14,820 B. Forced on raw 36,000/36,001 B, gzip 15,010/15,014 B.
- esbuild does not fold the feature constant across modules, so the flag was measured with the bench only.
- Topological awaits: the server's `waitAll` run is topological inside a run already (`read` throws `NotReady` and computes again). Wrote the design for starts across statements.
- Recorded the maintainer's decision: no `$result` macro, is-pending-many is a separate backlog node.
- Review round 2: wording only. The flag is per build (`buildFeatures`), the swap order changes with the flag on, the topological start rule now counts writes and local function calls, moved loads hold their errors where they start, all 15 insert sites are listed, and the node list splits out browser-root-boundary.
