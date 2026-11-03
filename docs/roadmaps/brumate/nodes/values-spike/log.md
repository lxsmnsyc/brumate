# Log: values-spike

Worktree .claude/worktrees/values-spike, branch experiment/values-spike, cut from origin/next 8f0cad6e.

## 2026-11-03

### Baseline (8f0cad6e, unchanged)

- Todos, `pnpm bench --only brumate --scenario todos` (lock held, load 10.9 at start; size does not depend on load):
  JS before `load` 5 files, 32.4 kB raw / 13,893 B gzip (results JSON `browser.boot.jsGzip`).
  Files gzip: loader 2,422, client entry 280, events 172, App 874, core 10,145.
  Size gate: candidate at most 12,893 B.
- Gate 'click': read as the click time of the rows create 1,000 click (O8 quotes "click 35 ms" for create), from
  `pnpm bench --only brumate --scenario rows`; replace measured too.
- Differential, `npx vitest run test/differential` in packages/brumate: run 1 had 1 failure (load 20+), run 2 passed
  all 531. `DIVERGENCES`: 38 pages, 17 causes; 11 causes to remove (21 pages), 6 accepted.
- Browser-only runtime exports: new script packages/brumate/test/spike/browser-only-exports.mjs (compiles the 599
  components of test/render; an export of `brumate/client` counts when compiled code calls it from render code only:
  the render module, and `r<n>`/`n<n>` functions of client parts, top-level constants by their readers).
  Baseline: 135 exports, 52 browser-only.
- Rows: baseline build of `pnpm run build:rows` saved to the scratchpad (base-rows-dist) for back-to-back timing.
  Load was 23 at the time, so timing runs wait for the end.

### Bounds before building (stubs, reverted)

Quick size script: builds brumate and the todos app, gzip of every chunk but rpc/defer/bundles. Baseline 13,900 B
(bench says 13,893 B; deltas only).

- Stub the render-only helpers that todos reaches (setAttr, keepText, fillList, setContent, countLoads, place):
  13,833 B, -67 B. Their internals are shared with updates.
- Stub the scheduler (pass, queueWrite, queue, drain, getDepth, settle, flushEffects, trigger, no replacement):
  13,124 B, -776 B.
- So the best case, both gone and nothing in their place, is about -0.85 kB. A replacement queue costs some of it.
  The -1.0 kB gate looks out of reach before building. The prototype aims at the fourth gate: no larger than next,
  with fewer divergences and browser-only exports.

### Incident: git stash across worktrees (17:39)

- I ran `git stash` / `git stash pop` in my worktree to run one test on the base code. The stash list is shared by
  all worktrees, and the drop-colon-modifiers worker ran `git stash -u` / `pop` at the same second. My pop applied
  their stash (e2f721e3 + untracked 7387886d, 25 files and 2 changesets), and their pop applied mine (f56dae10).
- Checked that each worktree held exactly the other's stash (diffs equal to the dangling stash commits), then put
  each back: their worktree has its 27 changes again (diff equal to e2f721e3, changesets copied back), mine has its 10.
  The window was about two minutes. The drop-colon-modifiers worker should check its tree.
- From here: no `git stash`. Base runs use a saved patch and `git checkout` inside this worktree.

### Prototype

Codegen (packages/brumate/src/codegen):

- client.ts `emitValues`: the `g` table is gone. The update part exports `v`, one function per kind and slot:
  `1: { 0: ($$s) => { $$b.q($$s, m3, 3); $$b.q($$s, b8); } }`. A memo passes its rank, an effect its name, an
  update of descendants their kind (`$$b.q($$s, u13, undefined, 2)`).
- client.ts `collectDirect`: an update function that is one call of `text`, `content`, `attr` or `list` on its
  scope is the write of its site, by `kind:helper:anchor:name`. `directOf` gives it to render.ts.
- template.ts: a clone drops its own write of such a site (keepText, setAttr, setContent, fillList) and keeps the
  node (`keep`, `markBlock`); after the slots are set it calls `$$b.first(scope, [u.., b..])`, each update once.
  Same in `r<n>` bodies (client.ts passes `direct`) and in render modules (render.ts imports the updates from the
  client entry, as it imports fill renders).
  Runtime (packages/brumate/src/runtime/client):
- state.ts `first(id, fns)`: runs the updates with `rendering` and `exempt` raised. blocks.ts `findElement` and
  `blockStart`, inserts.ts `text` accept the clone's detached nodes while `rendering` is set; `text` turns the
  kept comment into a text node or markers; `write` adds text to an empty place without parsing HTML.
- updates.ts: `trigger` calls `writeValue` (the value function of the slot) in a pass. `q` queues into one sorted
  array (depth, then memo rank, then other updates), binary insert, never before the entry that runs; a Set by
  scope keeps one entry per update. Effects stay in maps by depth, deepest first after the pass. `drain` is a loop
  over the array; `settle` runs the waiting memos of one scope. The stop for loops counts binding runs against
  100 x (scopes + 100). `levels`, `Level`, `queueWrite`, `queue` are gone. `pass` stays as the batch boundary.
- insert.ts refresh: collects the updates of a kind by calling the value functions with `collector` set.
- The 9 diamond fixtures (describe "updates of a signal and a memo of it" in resume.test.ts): 9 passed, twice
  (`--hookTimeout 300000`; the hook timed out at load 30-60 without it). One run before the queue change had one
  diamond failure that passed on rerun.
- Orchestrator heads-up after the incident: checked at 17:5x, the tree has only my 15 files (no parser, ast,
  analyze, print, error-catalog, modifier edits, fixtures or grammar). WIP commit 108964cd on the branch; no stash.

### Tests of the candidate

- Full `npx vitest run` (packages/brumate, timeouts raised for load 20-40), first candidate: 70 failed of 2766.
  29 differential pages blank: a `#loading` body rendered before the parent's `setSlots`, and its updates read the
  parent's slots (the inline writes read local variables). Fix: `first` waits while an ancestor scope has no
  slots (`unset`), `setSlots` runs what waited, `insertHTML` runs the rest before it inserts.
- After the fix, differential + resume + codegen + vite: 12 failed of 1257.
  - Differential: 0 pages "no longer differ"; 4 new: spreadChildrenPage (blank markup), PromisePlainChild (the
    server's 'then of undefined' error no longer happens in the browser), markupKey (BRM188: the key of a row
    reads a promise in the browser render), spikePage (blank markup). Divergences 38 -> 42 pages.
  - resume (5): memo/effect error in #try, effect calling the parent's writer, template inside a block import,
    #reveal order, #loading load failure. codegen (2): await snapshots. vite (1): merged parts. render.test.ts
    snapshots (23) and inspect (3) change with the output. None fixed here: that is values-build work.
- Browser-only exports: 52 -> 52 (fillList leaves the list, `first` joins it). setAttr, setContent, keepText,
  putText stay, since sites without an update (values that never change) and promise or settled writes keep them.

### Size of the candidate (quick script, deltas against 13,900 B)

- Candidate 108964cd (+ the slot wait): 14,209 B, +309 B. Core 10,153 -> 10,458; App 871 -> 879.
- With the direct render calls off (value functions and the new queue only): 14,146 B, +246 B. The sorted queue,
  the per-scope sets, the exported `q`, `writeValue` and the collector for refresh weigh more than `g` and the levels.
- So the size gate is missed by about 1.3 kB, and the candidate is larger than next.

### Timing (bench lock held from load 7.0; other workers raised it to 12-23 during runs)

- Script time, scratchpad profile-own.mjs: profile-rows.mjs with the same clicks and 50 us sampling, summing the
  self time of frames in the app's `/assets/` files (core, loader, App: brumate's own code). 5 rounds a run,
  base and candidate builds swapped in turn (timing.py), 1 warm-up run then 5 runs each, interleaved.
  - create: base median 2.95 ms [2.62-3.53], candidate 4.21 [3.27-4.61], 1.43x, noise 0.96: real.
  - replace: base 4.46 [3.97-4.62], candidate 6.82 [5.57-7.54], 1.53x, noise 2.16: real.
  - script + native total: create 10.71 vs 12.00 (1.12x), replace 22.79 vs 24.77 (1.09x), both within noise.
- Click, `pnpm bench --only brumate --scenario rows --no-build --runs 5`, builds swapped:
  - pair 1 (load 11 then 23 at the starts): create 33.0 (27-36.8) base, 29.0 (20.9-30.9) candidate;
    replace 39.4 (31-45.6) base, 26.7 (25.6-41.1) candidate. Candidate "faster" under more load: noise.
  - pair 2 (load 7.7 and 7.0 at the starts): create 24.8 (23.8-32.3) base, 24.8 (23-31.4) candidate;
    replace 25.7 (25-85.8) base, 25.8 (24.2-28.1) candidate. Within 1%.
- The bench lock directory was gone when I went to remove it after pair 2: something else removed it during my
  runs. My timing ran under the lock I took at load 7.0, as far as I know.
- Todos bench on the candidate (e5b40733, lock held): 14,205 B gzip before load, +312 B (core 10,452, App 878).
