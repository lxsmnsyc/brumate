# Outcome: ui-store-guards

## Built

- 63 readers in 54 files of `packages/ui/src` lost their second guard. Each pair
  `const g = $hasContext(C) ? $getContext(C) : undefined; const s = $hasContext(C) ? $store(g.key) : undefined;`
  is now `const g = $hasContext(C) ? $getContext(C) : undefined; const s = $store(g?.key);`.
  That is the short guarded form of store-any-source: it compiles to `has(C, scope) ? consumeStore(C, scope, slot, "key") : undefined`, the same code as before.
- A perl script did the edit. It rewrote a line only when its root name (`given`, `handlers`, `range`, ...) was declared in the same file as `$hasContext(C) ? $getContext(C) : undefined` with the same context. All 63 matched, none was left.
- Left as they are: the 80-odd readers of the form `$hasContext(C) ? $store(C) : undefined` (the source is the context itself, which throws without a provider, so the guard is still needed; the brief covers only sources that are already optional) and every `$hasContext(C) ? $getContext(C) : undefined`.

## Deviations

- The brief says 205 `$hasContext` calls; the tree had 291 (the count grew with later ui-no-defaults work).
- The brief file existed only on main, not on `feat/context-stores`. I copied `brief.md` into this branch so the node folder is complete.

## Stubs left

- None.

## Gotchas

- `$hasContext` count in `packages/ui/src` (`grep -ro '\$hasContext' packages/ui/src | wc -l`): 291 before, 228 after (63 fewer). The import lists still name `$hasContext`, which is part of the count.
- A fresh worktree needs `pnpm install --frozen-lockfile` and a build of every package (`pnpm -r --filter='./packages/*' build`), not only `brumate`. With only `brumate` built, 4 ui tests (`generics-markup`, `skill`) fail because the tsc packages have no dist; they pass after the full build.
- The size win is small: 32 B gzip of the 241 B that ui-no-defaults added. The guard already compiled to the same code, so the source change mostly shrinks the source, not the output.

## Proposed learnings

- Read a context that may be absent with `const g = $hasContext(C) ? $getContext(C) : undefined` once, then `$store(g?.key)` for each store | one guard per context read | packages/ui | no

## Verification

- Probe: ColorSwatchPicker alone, `vitest run test/*olor*` in packages/ui: 127 pass.
- `pnpm lint`: exit 0. `pnpm format:check`: exit 0. `pnpm typecheck`: exit 0.
- `node e2e/run.mjs --only ui --no-build` (ui example built clean): exit 0.
- `npx vitest run` in every package and example with a test script, all exit 0: brumate 2841 pass (1 expected fail), language-server 7, tsc 3, ui 774 pass (1 expected fail), vscode 5, hackernews 5, kit-app 1, nitro 3, todos 4, tracker 17, ui-kit 2.
- Size, examples/ui, `rm -rf dist node_modules/.vite`, `vite build --outDir dist/client`, `vite build --ssr src/server.ts --outDir dist/server`, sum of `.js` under `dist/client`:

|                   | raw       | gzip -9   |
| ----------------- | --------- | --------- |
| before (419f76cf) | 677,604 B | 203,030 B |
| after             | 677,527 B | 202,998 B |

No changeset: public behavior does not change.

## Size

- Estimated M, actual M.
