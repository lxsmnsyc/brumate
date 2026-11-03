# Outcome: values-spike

## Built

- Draft PR #451 (`chore: spike: functions for values`), branch `experiment/values-spike` from `next` 8f0cad6e, head e5b40733. An experiment, not to merge as is.
- Value functions. `codegen/client.ts` `emitValues` replaces the `g` table: the update part exports `v`, one function for each kind and slot, such as `1: { 0: ($$s) => { $$b.q($$s, m3, 3); $$b.q($$s, b8); } }`. A memo passes its rank, an effect its name, an update of descendants their kind. `trigger` calls the value function of the slot (`writeValue`) inside a pass.
- One queue. `runtime/client/updates.ts`: `q` puts each update into one array sorted by depth, then memo rank, then the other updates (binary insert, never before the entry that runs, one entry per scope and update). `drain` is one loop over it, `settle` runs the waiting memos of one scope, effects stay in maps by depth and run deepest first after the pass. `Level`, `levels`, `queueWrite` and `queue` are gone; `pass` stays as the batch boundary. Refresh (`insert.ts`) gets the updates of a kind by calling the value functions with a collector set.
- Direct first renders. `codegen/client.ts` `collectDirect` finds the update functions that are one call of `text`, `content`, `attr` or `list`. A clone (`codegen/template.ts`), in `r<n>` bodies and in render modules (`render.ts` imports them from the client entry), drops its own `keepText`, `setAttr`, `setContent` or `fillList` for such a site, keeps the node, and calls `$$b.first(scope, [updates])` once its slots are set. `first` (`state.ts`) runs them with a `rendering` flag, under which `findElement`, `blockStart` and `text` accept the clone's detached nodes. A body that renders before its parent has slots, such as a `#loading` body, waits until `setSlots` or `insertHTML`.
- `packages/brumate/test/spike/browser-only-exports.mjs`: counts the exports of `brumate/client` that compiled code calls only from render code (render modules and `r<n>`/`n<n>` functions), over the 599 components of `test/render`.

## Result

- result: **missed**, against the gates of docs/debates/client-restructure/debate.md, step 4. Proposed: **no-go**. Both render paths stay (P8), and the guards of steps 1-3 stay.
- numbers, baseline 8f0cad6e against candidate e5b40733:

| Gate                                                                  | Baseline                                           | Candidate                                       | Result |
| --------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- | ------ |
| Todos JS gzip before `load`, at least 1.0 kB below (at most 12,893 B) | 13,893 B (core 10,145, App 874)                    | 14,205 B, +312 B (core 10,452, App 878)         | missed |
| Rows own script time, create, at most 1.2x                            | median 2.95 ms [2.62-3.53]                         | 4.21 ms [3.27-4.61], 1.43x, noise 0.96 ms       | missed |
| Rows own script time, replace, at most 1.2x                           | median 4.46 ms [3.97-4.62]                         | 6.82 ms [5.57-7.54], 1.53x, noise 2.16 ms       | missed |
| Rows click within 10% (pair at load 7)                                | create 24.8 ms (23.8-32.3), replace 25.7 (25-85.8) | create 24.8 (23-31.4), replace 25.8 (24.2-28.1) | met    |
| 9 diamond fixtures through the codegen path                           | pass                                               | 9 of 9 pass, twice                              | met    |
| Divergences lower                                                     | 38 pages, 17 causes (11 to remove)                 | 42 pages: 0 removed, 4 new                      | missed |
| Browser-only runtime exports lower                                    | 52 of 135                                          | 52 of 137 (`fillList` out, `first` in)          | missed |

- The fourth gate needs a result no larger than `next` and both counts lower: the candidate is larger and neither count drops, so it fails on all three parts.
- Script time + native total, which the gate does not use: create 10.71 to 12.00 ms (1.12x), replace 22.79 to 24.77 ms (1.09x), both within noise.
- A first click pair at load 11 and 23 gave the candidate 29.0 against 33.0 ms (create) and 26.7 against 39.4 ms (replace): noise from the load, not a gain; the pair at load 7 is the one in the table.
- Where the size goes (quick script: gzip of every todos chunk but rpc, defer and bundles; deltas against 13,900 B on base):
  - Bounds before building, by stubbing code out and putting nothing in its place: the render-only helpers that todos reaches (setAttr, keepText, fillList, setContent, countLoads, place) weigh 67 B; the whole scheduler (pass, queueWrite, queue, drain, getDepth, settle, flushEffects, trigger) weighs 776 B. Even deleting both, with no replacement, saves about 0.85 kB, under the 1.0 kB gate.
  - Value functions and the new queue alone (direct render calls off): +246 B. The direct render calls: +63 B more. `g` is about 100 B in todos, and the queue still needs depth, rank, effects, errors, the loop stop and the waits for code, so value functions give nothing to delete there.
- Why the script time grows: each new row calls `first`, which runs the updates through `findElement`, `attr` and `content`/`write`, and records the scope in a WeakSet until its slots are set, in place of the inline `setAttribute` and `textContent` of the clone.
- reproduce:
  - Size: `pnpm bench --only brumate --scenario todos` on each commit, `browser.boot.jsGzip` of the results JSON.
  - Script time: the scratchpad scripts are not committed. profile-own.mjs is `benchmarks/harness/profile-rows.mjs` plus a sum of self time over frames whose URL holds `/assets/`; timing.py swaps the base and candidate `rows/dist` builds (`pnpm run build:rows`) in turn, one warm-up then 5 runs of 5 rounds each, create and replace, and judges by bench.py's rule (change real only above 3x the larger MAD).
  - Click: `pnpm bench --only brumate --scenario rows --no-build --runs 5` with each build swapped in, back to back.
  - Diamonds: `npx vitest run test/resume.test.ts -t "updates of a signal and a memo of it" --hookTimeout 300000` in packages/brumate.
  - Divergences: `npx vitest run test/differential` (a page that newly differs fails; one that matches fails with "no longer differs").
  - Exports: `node test/spike/browser-only-exports.mjs --list` after `pnpm build`.
  - Machine: Apple M2, 8 cores, 8 GB, Node 26.12.1, Chrome 156; shared with other workers, timing under the bench lock.

## Deviations

- The click gate is read as the click time of the rows create and replace clicks from `pnpm bench`, since O8 quotes "click 35 ms" for create; profile-rows.mjs has no click time.
- "Brumate's own script time" is the self time of frames in the app's `/assets/` files (core, loader, App chunk), from a copy of profile-rows.mjs with the same clicks, since profile-rows.mjs prints only the top 28 entries.
- The browser-only export count had no method fixed in advance; the script above fixes one, run on both commits.
- `pass` stays as the batch boundary, and the waits for update code in `trigger` stay: the spike replaces `g`, `queueWrite`, the levels and `drain`.
- Render-path writes of promise values, settled memos and sites with no update (values that never change) keep the old helpers.

## Stubs left

- 12 tests fail on the candidate: 4 differential pages (spreadChildrenPage, spikePage blank; markupKey reads a promise key; PromisePlainChild no longer throws the server's error), 5 resume tests (memo and effect errors in `#try`, an effect that calls its parent's writer, a template import inside a block, `#reveal` order, a failed `#loading` load), 2 codegen await snapshots, 1 vite merged-parts test; plus 23 render snapshots and 3 inspect snapshots that change with the output. values-build would own them on a go.
- The loop stop counts binding runs against 100 x (scopes + 100) in place of 10,000 rounds; not tuned.

## Gotchas

- `git stash` is shared by every worktree of the repo. A stash and pop here crossed with the drop-colon-modifiers worker's at the same second and swapped our changes; both trees were put back from the dangling stash commits (see log.md). Workers should use a WIP commit, never `git stash`.
- A clone that calls update functions must wait for the slots of the scopes around it: a `#loading` body renders before its parent's `setSlots`, and the inline writes hid that by reading local variables.
- The bench lock directory vanished during my timing runs; something else removed it.
- `resume.test.ts` needs `--hookTimeout 300000` when the load is above 20, or its compile hook times out and every test is skipped.

## Proposed learnings

- A size bound by stubbing (delete the code, put nothing in its place, build) answers a size gate before a prototype | here it showed the 1.0 kB gate out of reach in a few minutes | docs/roadmaps/brumate | no
- Never use `git stash` in a worktree of this repo | the stash list is shared, and two workers popped each other's changes | repo-wide | no

## Verification

- Fast check on e5b40733: `pnpm lint` exit 0 (warnings only), `pnpm format:check` exit 0, `pnpm typecheck` exit 0.
- Tests: see Stubs left. The 9 diamond tests pass.

## Size

- Estimated M, actual M: about one day and 0.45M tokens of the three-day, 0.6M box. The stash incident took part of it.
