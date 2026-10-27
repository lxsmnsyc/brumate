# Log: memo-errors-server

- Server codegen: a memo that the render waits for without `await` is declared as `let x; try { x = ... } catch {}`, and the markup reads it as `$$b.read($$p_x)` (patch.ts `lazy`, scopes.ts `lazyMemos`, markup.ts `awaitHeld`).
- Reads inside `$isPending(...)` and `$isBound(...)` are skipped, and a read is replaced once by position.
- Tests: flipped the it.fails test, added two-#try and awaited tests, updated 3 codegen expectations and 4 render snapshots.
- Environment: vitest with happy-dom fails inside .git/node-worktrees (module path error), so tests ran in a copy worktree outside .git. pnpm refuses a symlinked node_modules, so lint/format ran through npx.
