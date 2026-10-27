# Outcome: size-trim

## Built

- Three small cuts in `client/updates.ts`, `shared.ts` and `client/resume.ts`. `updateReady` is recursive without a closure, `dirty` is a set of scopes and `settle` finds the memos by key, and two expressions are shorter. Behavior is unchanged.
- handler-merge-trim was still open, so it is folded in. The merge code costs about 45 B gzip, and was already in the baseline. I found no cut worth its risk. The orchestrator marks that node.
- `docs/performance.md` has the sizes against the baseline, and what the remaining bytes buy.

| Cut                                    | Bytes saved (gzip) |
| -------------------------------------- | -----------------: |
| `updateReady` without closure          |                 20 |
| `dirty` set of scopes, `settle` by key |                 32 |
| `addEntryHandlers` regex, `custom`     |                  3 |
| Total                                  |                 62 |

## Deviations

- The goal of 0.1 kB of the baseline is not met. Todos before `load`: baseline 14,227 B, main 14,825 B (+598), after 14,763 B (+536). Main before the rebase was 14,836 B.
- Most of the gap is features: `readFields` is about 256 B, `settle` about 50 B, merged handlers about 45 B. See `docs/performance.md`. Cutting more means dropping or reshaping a feature, The maintainer accepted the remaining size over the baseline on 2026-10-27, as this accounting explains it.

- Review fixes: `settle` keeps its early return (`if (dirty.delete(scope))`), so a read of a clean scope walks no bucket. `updateReady` is `async` again, so a synchronous throw of `load` rejects. The regex merge in `readFields` was not done. I did not rerun the memo-chain timing probe; the memo and batching tests pass.

## Stubs left

- None.

## Gotchas

- Per-bytes micro cuts give 3 to 30 B each. They do not close a 500 B gap.
- `import/no-cycle` blocks importing `pass` in references.ts, so `setPass` stays (22 B).
- `pnpm` and the e2e run refuse a worktree with linked node_modules. benchmarks need node_modules copied into `benchmarks/brumate` and `benchmarks/harness`.

## Proposed learnings

- Measure a feature by removing it and rebuilding todos | gives its byte cost in 40 s | benchmarks | no

## Verification

- `npx oxlint` (warnings only), root `npx oxfmt --check`, `npx tsc --noEmit` in packages/brumate: pass.
- packages/brumate `npx vitest run`: 1066 passed. packages/ui `npx vitest run --maxWorkers=2`: 537 passed, 1 expected fail.
- Rows probe, 3 runs each on main and head, ms per click after the first: 1000 rows 5 to 6 both; 4000 rows 10 to 14 both; 10000 rows 31 to 52 main, 31 to 39 head.
- Not run: `node e2e/run.mjs` and `pnpm bench` (pnpm refuses a linked node_modules); sizes came from the harness with `--metrics dist,browser --no-build`.

## Size

- Estimated M, actual S: the cuts that are safe are small.
