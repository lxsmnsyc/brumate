# Outcome: memo-errors-server

## Built

- A memo that throws on the server renders the `#catch` of the nearest `#try` that reads it, wherever the memo is declared. The server still waits for a memo that the page reads, but keeps its error (`let x; try { x = ... } catch {}` from `awaitHeld` in `packages/brumate/src/codegen/markup.ts`), and the markup reads it in place as `$$b.read($$p_x)`. `lazyMemos` in `codegen/scopes.ts` picks these memos (blocking, no `await`, not inline). `addValueEdits` in `codegen/patch.ts` takes them as a new `lazy` argument.
- `await $memo(...)` is unchanged: it throws at its declaration (test `memoErrorAwaitOutside.brm`).
- Tests in `packages/brumate/test/resume.test.ts`: the `it.fails` "declared outside the #try" is now `it`; a memo read in two `#try` blocks renders each `#catch` (`memoErrorServerTwo.brm`); the awaited case outside a `#try` rejects with 'Bar failed'.
- Docs: `docs/decisions.md` and `website/docs/effects.md` drop the inside-only caveat and state the awaited rule. Changeset `.changeset/memo-errors-server.md` (patch).
- Updated server output expectations in `test/codegen.test.ts` (3) and snapshots `test/__snapshots__/render/{doubler,memos,search,todos}.txt`.

## Deviations

- Edited `codegen/scopes.ts` and `codegen/server.ts` (small, to pass the `lazy` set), and the codegen test and snapshots, which the brief does not list.

## Stubs left

- None.

## Gotchas

- Code in the script body outside functions and memos (for example a top-level `console.log(x)`) still reads the `let` variable, which is undefined after an error.
- `$$ctx.slots(...)` gets `undefined` for a failed memo.
- `readMemos` now skips reads inside `$isPending(...)` and `$isBound(...)`, and replaces a read once by position, since a site can contain the node of another.
- vitest with happy-dom fails under `.git/node-worktrees` (module path error), also on main. Run those suites from a worktree outside `.git`.

## Proposed learnings

- On the server a memo that the page reads is read in place with `$$b.read`, never through a `const` at its declaration, except with `await` | an early read would fail the page outside the `#try` | packages/brumate/src/codegen | yes (resume memo error tests)

## Verification

- `vitest run test/resume.test.ts -t "memo error"` (verify command, from a copy worktree outside .git): 14 passed.
- `vitest run` in packages/brumate: only the 4 `vite.test.ts` failures remain, which also fail on main in this environment (4 failed before my change, same files).
- `oxlint`: warnings only. `oxfmt --check`: pass. `tsc --noEmit` in packages/brumate: 0 errors in `src`; the errors in `test/` come from the missing `dist` of the copy worktree. `pnpm typecheck` could not run (pnpm refuses the symlinked node_modules).
- Not run: ui suite, e2e.

## Size

- `pnpm bench` could not run in this environment. The change is server-only: `lazy` is passed only by `codegen/server.ts`, and `awaitHeld` runs only in server mode, so client output is unchanged (delta 0 B by construction).
- Estimated M, actual M.
