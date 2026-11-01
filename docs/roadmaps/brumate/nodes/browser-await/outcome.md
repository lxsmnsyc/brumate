# Outcome: browser-await

## Built

- `const x = await $memo(...)` in the instance script of a component that the browser renders waits for the memo. The code before it runs once, the rest of the render runs when the memo settles, and its markup fills the place of the component (fill in place). Handlers and updates work after the wait, and the memo loads once.
- Compiler (`packages/brumate/src/codegen/markup.ts`, `render.ts`): the render module splits at each awaited declaration of the instance script into `let x; return $$b.wait($$s1, [slots so far, load], slot, ($$v) => { [names] = $$v; ...rest });`. The awaited name is a `let` before the call, so a function declared before the `await` reads it. The variable declarations before the last `await` are emitted with `let`, and the rest assigns the slots among them, so the rest and those functions read the values after the wait. `Emitter.splitAtAwait` writes the call, `Emitter.openRest` opens the arrow in the same function, so the clone of the markup still works, and `generateRender` closes one `});` for each wait (`Emitter.waits`). The option `waits` turns it on for the render module only. Other declarators of the same statement are written one by one.
- Runtime (`packages/brumate/src/runtime/client/waits.ts`): `wait(id, slots, slot, rest)`, exported from `brumate/client`, and the boundary helpers `bound`, `give`, `join`, `leave`, `fault` and `fillRange`, internal to the client runtime.
  - The scope holds the slots of the code before the `await` while it waits, with the `setSlots` setup, so a prop that a parent writes reaches the memo and a promise declared before the `await` that rejects is handled. A check in `waiters` runs at each write, so the latest load wins, also a newer load that settles before the first one.
  - The scope leaves `rendered` while it waits, so the insert around it runs no memos on it.
  - The rest writes the settled value into the slot (its own `setSlots`), and the slot goes into `renderedLoads`. `memo` (`updates.ts`) now keeps a value that is not a thenable for a key in `renderedLoads`, so the refresh after the insert counts the memo as computed and does not load it again.
  - Range comments `<!--l<scope id>:w-->` and `<!--/w-->`. They match `MARKER`. Client scope IDs are negative, so the server `SWAP` script (`/^l\d/`), devtools (`/^l[\d.-]+$/`) and navigate (`/^l([\d.]+)$/`) do not read them.
  - A rejected load and a throw of the rest go to `fail(scope, error)`, then to `fault(boundary, error)`: the boundary's `f`, or a count-down without one. A throw drops the scopes and `afterInsert` work that the rest made.
  - A wait counts in the boundary of the render that runs, or in the held boundary of a scope above it (`join`). A scope that goes during the wait counts down (`leave`). `bound` holds the `rendered` and `afterInsert` work of its body, the work of rests that settle joins it (`fillRange`), and `done` runs when the count reaches 0.
- Contract `docs/roadmaps/brumate/contracts/client-pending-boundary.md`: frozen, version 1, with the real signatures.
- Tests in `packages/brumate/test/resume.test.ts`, `describe('await $memo in a component that the browser renders')`, 15 tests: the wait, one run of the code before it and one load; a prop that changes during the wait; a block that switches back during the wait, and one closed after the fill, compared with the markup before the open, also after the load settles; `#for` rows that settle out of order; a rejection and a throw of the rest reaching `fail`; a newer load that settles while the first hangs; a rejected async memo declared before the `await`; open, close and open during the wait; a function declared before the `await` that reads the memo; and five contract tests (count and held work, no boundary, a scope that goes while held, a wait under a held scope, `f` and the count-down without it). The four review probes and the three new contract tests fail on 161b1fdc and pass now.
- Fixtures in `packages/brumate/test/render/`: `WaitUser.brm`, `WaitBroken.brm`, `waitHost.brm`, `waitRows.brm`, `waitErrors.brm`, `WaitLabel.brm`, `waitLabelHost.brm`, `WaitSide.brm`, `waitSideHost.brm`, `waitData.ts` (loads that the test settles by hand).
- Docs: docs/decisions.md:27 and website/docs/async-data.md say that `await $memo` in the script of a browser-rendered component waits, and what does not wait yet.
- Changeset `.changeset/await-memo-waits-in-browser-renders.md`, minor.

## Deviations

- `wait(id, slots, slot, rest)` in place of the spike's `wait(scope, value, rest)`. The slots of the code before the `await` must reach the scope during the wait and come back to the rest, which the spike's form cannot do.
- `bound` and `give` in place of the spike's `loading` internals. `loading` itself (the compiled `#loading` fallback) is browser-loading-fallback's, and `hold` is browser-root-boundary's.
- Files outside the owned paths: `packages/brumate/src/runtime/client.ts` (one export line and the module order comment; the brief owns `client/**` but not this entry), the new fixtures under `packages/brumate/test/render/`, and the changeset.
- The contract was reworked at version 1 after the review of #413, before any consumer: `Boundary.f`, `join`, `leave`, `fault` and `fillRange` were added. With no `f`, a failed wait releases its boundary, and `fail` has reported the error. `waitAll`, `started` and `after` are listed as a v2 addition for browser-await-blocks.

## Stubs left

- None. Fill in place stays until browser-root-boundary adds `hold`.

## Gotchas

- `await $memo` in the script of a block body or a `#for` row, and `await` in markup, still compile to the bare promise in the browser (browser-await-blocks). Only the instance script splits.
- Several awaits in an instance script nest: each waits after the one before, so their loads do not start together. The docs say so. The topological starts are browser-await-blocks' work.
- A `#try` that the browser renders has no `t` entry, so `fail` reports the error as unhandled (`brumate:error`) unless a `#try` that the server rendered is around it (browser-try).
- An async memo that no update reads has no slot, so nothing handles its rejection in a browser render, with or without `await`. This is a bug of `next` and `main`, not of this node (a probe without `await` shows the same unhandled rejection). It needs its own fix from `main`.
- `memo` returns without a compute for a key in `renderedLoads` whose slot holds a value. Any other code that adds to `renderedLoads` must put a promise or the computed value in the slot.
- `bound` callers must set `done` right after it returns. Waits settle in a later microtask, never during `bound`.
- A rest that settles inside a held boundary inserts into the detached body, so its markers are indexed and its handlers listen, but its `rendered` scopes and `afterInsert` work wait in `w`.

## Proposed learnings

- The memo that a browser render awaited counts as computed for the refresh after its insert | otherwise the refresh calls the load again | packages/brumate/src/runtime/client | yes
- The rest of a render after `await` takes the slots back as parameters | a prop that changes during the wait must reach the rest | packages/brumate/src/codegen | yes

## Verification

- `pnpm --filter brumate build && pnpm --filter brumate test`: 65 files, 1321 tests pass.
- Without the `memo` change, 3 of the 8 new tests fail (loads twice).
- `pnpm lint` (no errors, and warnings of the same kinds as the rest of resume.test.ts), `pnpm format:check` and `pnpm typecheck`: pass.
- Not run: `node e2e/run.mjs` (the full check runs after merging).

## Size

- Todos, `pnpm bench --only brumate --scenario todos --metrics browser`, JS before `load`: before raw 35,467 B, gzip 14,822 B (`16a2d249`). After the first round: raw 35,467 B, gzip 14,820 B. After the rework: raw 35,467 B, gzip 14,823 B. Raw is the same, and gzip moves by 1 to 2 B, within the noise of chunk hashes.
- A page that uses `await $memo` in a browser render: `wait` adds 1,372 B raw, 520 B gzip, to an esbuild `--bundle --minify` entry of the helpers of a page with a branch, a list and a child. This is the spike's method, and the base is 26,141 B raw, 10,268 B gzip. The first round was +388 B. The rework added the failure path, `join` through held scopes, the `setSlots` setup and the check at each write. Each split component adds about 80 B raw of compiled code (`let x;`, `return $$b.wait(...)`, the slot list and the assignment).
- Estimated M, actual M.
