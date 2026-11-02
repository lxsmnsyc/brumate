# Outcome: browser-await-blocks

## Built

- `await $memo(...)` in the `<script>` of a block body and of a `#for` row that the browser renders waits, as the instance script of browser-await does: the code before it runs once, and the rest renders when the memo settles. A `#loading` around such a body shows its fallback until then.
- `await name` of a memo in markup that the browser renders waits at the start of the markup, after the script. A memo of the scope is assigned its value; a memo of a scope around it is a constant of the rest.
- Topological starts in the browser: each awaited memo's load starts where the server starts it (`findLoadStarts`, `Emitter.earlyLoads`), as `const $$w_x = $$b.started(() => load)`, or `$$b.after([$$w_a], (a) => load)` for a load that reads awaited memos whose `await` comes later. The loads of a run of adjacent awaits start before the first one. A load that reads an awaited memo through a function or another memo starts after that memo's `await`.
- Compiler (`packages/brumate/src/codegen/markup.ts`, `client.ts`): `Emitter.splitBody` gives the split to one render function (`emitRender`, `bodyFunction`) and closes its rests. `splitsScript`, `markupAwaits`, `awaitMarkup`. `blockingDeclarations` takes `server` so the browser can use the server's rule. A row that waits calls `setItem` before the split and writes its `i` markers in the rest. A body with no ID creates its scope when it waits. `watchUnreadMemos` skips a memo that markup awaits.
- Runtime (`packages/brumate/src/runtime/client/waits.ts`): `holdRow` finds a row that waits in its own script by its `i` range. `started` and `after`, exported from `brumate/client`. `wait`: a row's own range is `<!--i<id>-->`/`<!--/i-->` so the list keeps finding it; a value that an update wrote into the slot during an earlier wait wins over the started load; the rest runs inside `updating`.
- Tests: `packages/brumate/test/resume.test.ts`, `describe('await in block scripts, #for rows and markup of a browser render')`, 13 tests: an `#if` body that waits and runs the code after the `await` once; the newer load when a signal changes during the wait; close and reopen during the wait; rows that reverse and drop while they wait; a row dropped during its wait; overlap of two independent loads (`[2, 1]` in flight), a dependent load after its input settles, `after` in the output; an early rejection reported once at its `await`; markup awaits of the body's memo, the outer body's memo and a row's memo; a component's markup await and its constant `#if` that waits; the `#loading` fallback around a body that waits; `#key` and `#try` bodies that wait; a row whose first await has a value and whose second waits; a `#loading (memo)` body (loading-on) that waits in its script and shows `#else` again when the header memo loads. Two codegen tests in `test/codegen.test.ts` (run starts, a read through a function). Fixtures `test/render/await{If,Rows,Starts,Markup,Loading,LoadingOn,Inline,InnerHost}.brm`, `AwaitInner.brm`.
- Existing test changed: the WaitDestr test of browser-await now expects both loads at once.
- Docs: website/docs/async-data.md, docs/decisions.md:27. Changeset `.changeset/await-memo-waits-in-blocks-in-browser.md`, minor.
- Change request: `contracts/client-pending-boundary.change-request.md` (v2: `started`, `after`, the three `wait` changes, no `waitAll`).

## Deviations

- No `waitAll`: the loads of a run start before the first `await`, so nested `wait` calls overlap the same way, with one helper less.
- Markup awaits wait at the start of the markup, after the script, as the brief says. On the server the memo is waited for at its declaration, so statements between the declaration and the markup run before the wait in the browser and after it on the server.
- A load that reads an awaited memo through a function or a plain memo starts later in the browser (after that memo's `await`) than on the server.
- Files outside the owned paths: `runtime/client/waits.ts` and `runtime/client.ts` (shared), the docs, the fixtures, `codegen.test.ts`, the changeset.

## Stubs left

- None.

## Gotchas

- `await name` in a script statement of a browser render is still a plain read of the promise. Only markup and `await $memo` declarations wait.
- A `#key` or `#try` body that waits renders through a function of its own (`emitInlineBody`, `$$b.branchNodes`), so it can split. A rejection in the rest of a `#try` body goes to `fail`, not to its `#catch` (browser-try).
- A row with comment item markers whose first wait is a promise keeps two `i` marker pairs: the wait range and its own. Harmless, two comments per such row.
- `wait` uses `'i' in scope` to know a row. Only `setItem` and the list's assign set `i`.

## Bugs found

- On feat/browser-async (not main, `wait` is not on main): during the first wait of a scope with two `await $memo`, a write that a later awaited memo reads runs that memo's text update with a hole in its slot, which throws `TypeError` (reported as `brumate:error`). The page ends right. Reproduce: WaitDestr with the prop changed before the first load settles. Needs updates of a waiting scope to skip writes to the page.

## Proposed learnings

- The rest of a wait renders inside `updating` | a render function in it reads a memo of an outer scope that loads, and would throw outside an update | packages/brumate/src/runtime/client | yes
- A `#for` row that waits marks itself with its wait range | the list finds rows only by `i` comments and `b-b` | packages/brumate/src/runtime/client | yes

## Verification

- Merged origin/feat/browser-async at 80a2d66e (browser-root-boundary): conflicts in waits.ts (imports; `started`/`after` next to `hold`), docs/decisions.md:27 and website/docs/async-data.md (their root boundary text with this node's sentences). `holdRow` took the ID of its marker from the first held scope, but a row that waits in its own script is out of `rendered`, so the list of held scopes was empty and it threw. It now takes the ID from the `i` range that starts the row's output. Four tests changed to the root boundary's behavior: the old branch stays until the new body settles, an `#if` holds its body until the waits of nested bodies end, and the old `#key` body loads the new key too.
- Merged origin/feat/browser-async at 50a07585 (loading-on): conflicts in `client.ts` `emitRender` (kept the split and the cloned `#loading` fallback), `markup.ts` `emitClientLoading` (kept the body scope and `emitLoadingBody`), and the two new describes at the end of `resume.test.ts` (both kept, each closed).

- Review round 1: one should-fix (`#key` and `#try` bodies did not wait, and a `#try` body never filled), fixed with `emitInlineBody` and two tests; two non-blocking: tests for a sync-first row (added) and the double `i` markers (noted under Gotchas).
- `pnpm install`, `pnpm build`, `pnpm lint` (no errors; one `consistent-function-scoping` warning in the new describe, as the file has), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (67 files, 2076 tests after the merge).

## Size

- Todos, `pnpm bench --only brumate --scenario todos`, JS before `load`: 32.3 kB / 13,837 B gzip before (01017a8e), 32.3 kB / 13,829 B after. Click checks FAIL on both, the known bundles issue of the bench server on this branch.
- Estimated M, actual M/L.
