# Log: browser-await-spike

- 2026-11-01: read GOAL, the brief, browser-async and the outcome of streamed-memo-reads. No outcome.md yet.
- The render module compiles `const user = await $memo(load(id))` to `const user = (load(id));`, so `user.name` reads a promise. A browser render of `#loading` drops the block and renders the body only (markup.ts, client mode).
- Every render is sync and returns `string | DocumentFragment`. About 15 call sites in the runtime insert the result (branches, lists, children, templates, errors, components).
- Option 3 prototype: `wait()` and `loading()` in `src/runtime/client/waits.ts`, and a test (`test/_spike/await.test.ts`) that compiles the fixtures in `prototype/` and splits the render of User.brm by hand at the await, as the compiler would. 4 tests pass: `#loading` fallback then body, no `#loading` (the place fills later), a branch that closes while it waits, `#for` rows. The memo loads once.
- Found while prototyping: `createScope` returns an ID, not the scope. The scope must leave `rendered` until its rest runs, or the insert around it runs its memos with no slots. The continuation must set the settled value in the slot, not the promise, or `startLoading` runs the updates with the promise.
- Bench (lock taken and released): todos JS before `load` 14,829 B gzip with `wait` and `loading` exported, 14,824 B without, on 6adea8fb.
- Sizes with esbuild + gzip -9 over a base entry of 10,254 B: option 3 +301 B, option 1 helpers +225 B, option 2 on 4 of 15 insert sites +53 B. Async calls cost 0.05 ms per 1,000 (node).
- Saved the prototypes as `prototype/option3.patch` and `prototype/options-1-2.patch`, then removed them from `packages/`. Wrote outcome.md.
