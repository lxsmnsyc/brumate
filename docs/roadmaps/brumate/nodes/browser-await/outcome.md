# Outcome: browser-await

## Built

- `const x = await $memo(...)` in the instance script of a component that the browser renders waits for the memo. The code before it runs once, the rest of the render runs when the memo settles, and its markup fills the place of the component (fill in place). Handlers and updates work after the wait, and the memo loads once.
- Compiler (`packages/brumate/src/codegen/markup.ts`, `render.ts`): the render module splits at each awaited declaration of the instance script into `return $$b.wait($$s1, [slots so far, load], slot, ([names]) => { ...rest });`. `Emitter.splitAtAwait` writes the call, `Emitter.openRest` opens the arrow in the same function, so the clone of the markup still works, and `generateRender` closes one `});` for each wait (`Emitter.waits`). The option `waits` turns it on for the render module only. Other declarators of the same statement are written one by one.
- Runtime (`packages/brumate/src/runtime/client/waits.ts`): `wait(id, slots, slot, rest)`, exported from `brumate/client`, and the boundary helpers `bound(body)` and `give(boundary)`, internal to the client runtime.
  - The scope holds the slots of the code before the `await` while it waits, so a prop that a parent writes reaches the memo. A newer load of the memo, which such a prop starts, is waited for too, through `waiters`. The rest takes the slots back by name.
  - The scope leaves `rendered` while it waits, so the insert around it runs no memos on it.
  - The rest writes the settled value into the slot (its own `setSlots`), and the slot goes into `renderedLoads`. `memo` (`updates.ts`) now keeps a value that is not a thenable for a key in `renderedLoads`, so the refresh after the insert counts the memo as computed and does not load it again.
  - Range comments `<!--l<scope id>:w-->` and `<!--/w-->`. They match `MARKER`. Client scope IDs are negative, so the server `SWAP` script (`/^l\d/`), devtools (`/^l[\d.-]+$/`) and navigate (`/^l([\d.]+)$/`) do not read them.
  - A rejected load and a throw of the rest go to `fail(scope, error)`. A throw drops the scopes and `afterInsert` work that the rest made.
  - A wait counts in the boundary of the render that runs. `bound` holds the `rendered` and `afterInsert` work of its body, the work of rests that settle joins it, and `done` runs when the count reaches 0.
- Contract `docs/roadmaps/brumate/contracts/client-pending-boundary.md`: frozen, version 1, with the real signatures.
- Tests in `packages/brumate/test/resume.test.ts`, `describe('await $memo in a component that the browser renders')`, 8 tests: the wait, one run of the code before it and one load; a prop that changes during the wait; a block that switches back during the wait, and one closed after the fill, compared with the markup before the open, also after the load settles; `#for` rows that settle out of order; a rejection and a throw of the rest reaching `fail`; and two contract tests of `bound` and `give`.
- Fixtures in `packages/brumate/test/render/`: `WaitUser.brm`, `WaitBroken.brm`, `waitHost.brm`, `waitRows.brm`, `waitErrors.brm`, `waitData.ts` (loads that the test settles by hand).
- Docs: docs/decisions.md:27 and website/docs/async-data.md say that `await $memo` in the script of a browser-rendered component waits, and what does not wait yet.
- Changeset `.changeset/await-memo-waits-in-browser-renders.md`, minor.

## Deviations

- `wait(id, slots, slot, rest)` in place of the spike's `wait(scope, value, rest)`. The slots of the code before the `await` must reach the scope during the wait and come back to the rest, which the spike's form cannot do.
- `bound` and `give` in place of the spike's `loading` internals. `loading` itself (the compiled `#loading` fallback) is browser-loading-fallback's, and `hold` is browser-root-boundary's.
- Files outside the owned paths: `packages/brumate/src/runtime/client.ts` (one export line and the module order comment; the brief owns `client/**` but not this entry), the new fixtures under `packages/brumate/test/render/`, and the changeset.
- A failed wait does not count down its boundary. browser-try replaces the boundary with its `#catch`. Recorded in the contract.

## Stubs left

- None. Fill in place stays until browser-root-boundary adds `hold`.

## Gotchas

- `await $memo` in the script of a block body or a `#for` row, and `await` in markup, still compile to the bare promise in the browser (browser-await-blocks). Only the instance script splits.
- Several awaits in an instance script nest: each waits after the one before, so their loads do not start together. The topological starts are browser-await-blocks' work.
- A `#try` that the browser renders has no `t` entry, so `fail` reports the error as unhandled (`brumate:error`) unless a `#try` that the server rendered is around it (browser-try).
- A promise prop in the slots during the wait is not marked `plain`, as `setSlots` would mark it. Update code that reads it during the wait treats it as a memo that loads. The rest's `setSlots` marks it.
- `memo` returns without a compute for a key in `renderedLoads` whose slot holds a value. Any other code that adds to `renderedLoads` must put a promise or the computed value in the slot.
- `bound` callers must set `done` right after it returns. Waits settle in a later microtask, never during `bound`.
- A rest that settles inside a held boundary inserts into the detached body, so its markers are indexed and its handlers listen, but its `rendered` scopes and `afterInsert` work wait in `w`.

## Proposed learnings

- The memo that a browser render awaited counts as computed for the refresh after its insert | otherwise the refresh calls the load again | packages/brumate/src/runtime/client | yes
- The rest of a render after `await` takes the slots back as parameters | a prop that changes during the wait must reach the rest | packages/brumate/src/codegen | yes

## Verification

- `npx vitest run` in packages/brumate: 65 files, 1314 tests pass.
- Without the `memo` change, 3 of the 8 new tests fail (loads twice).
- `pnpm lint` (no errors, and warnings of the same kinds as the rest of resume.test.ts), `pnpm format:check` and `pnpm typecheck`: pass.
- Not run: `node e2e/run.mjs` (the full check runs after merging).

## Size

- Todos, `pnpm bench --only brumate --scenario todos --metrics browser`, JS before `load`: before raw 35,467 B, gzip 14,822 B (`16a2d249`). After: raw 35,467 B, gzip 14,820 B. Raw is the same, and gzip moved by 2 B, within the noise of chunk hashes.
- A page that uses `await $memo` in a browser render: `wait` adds 982 B raw, 388 B gzip, to an esbuild `--bundle --minify` entry of the helpers of a page with a branch, a list and a child. This is the spike's method, and the base is 26,136 B raw, 10,261 B gzip. Each split component adds about 60 B raw of compiled code (`return $$b.wait(...)` and the slot list).
- Estimated M, actual M.
