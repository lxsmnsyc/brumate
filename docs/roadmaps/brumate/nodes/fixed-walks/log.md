# Log: fixed-walks

## Measurement (2026-11-25)

- Target: batch/brumate-release-0.10 at 9c2b67f4 (clone-remaining-bodies, template-fragment-return, no-client-html).
- Prototype: a fixed walk for cloned templates, behind `BRUMATE_FIXED_WALK` in `codegen/template.ts` (a static path finder that refuses markup the parser could change, variables per node from the previous sibling, `cloneNodes` in `runtime/client/templates.ts`). The rows page cloned `<tr>` compiled to `m=o(R),h=m.firstChild,g=h.firstChild,_=g.nextSibling.firstChild` against `m[0]..m[3]` before. Reverted after the miss.
- Both builds of the rows app were copied to a scratch folder; each run copied one into `benchmarks/brumate/rows/dist` and ran `node benchmarks/harness/profile-rows.mjs brumate <op> <rounds>`. `bench.py` interleaved base and fixed, metric "ms of script and native work a round".
- Machine: Apple M2, 8 cores. Load average 13 during the runs (other agents were running e2e and benches), 4 to 5 in the first run.

| Run                                    | base median (min, mad) | fixed median (min, mad) | verdict             |
| -------------------------------------- | ---------------------- | ----------------------- | ------------------- |
| create, 20 rounds, 8 runs, load 4 to 5 | 5.5 (5.5, 0)           | 5.5 (5.2, 0.1)          | within noise        |
| create, 40 rounds, 12 runs, load 13    | 9.0 (5.4, 2.7)         | 9.15 (5.2, 3.35)        | within noise, +1.7% |
| replace, 40 rounds, 12 runs, load 13   | 15.3 (10.8, 4.25)      | 16.0 (11.3, 4.4)        | within noise, +4.6% |

- `pnpm bench --only brumate --scenario rows` was not run: the load of 13 to 20 made a latency bench worth less than the profile above, and the profile already shows no gain.
- The best case, the minimum of create, differs by 0.2 ms of 5.4 ms (4%), in a run whose mad is larger than that.

## Size (todos, gzip JS before `load`)

- No-client-html base (19643132): 5 files, 35.3 kB raw / 14.6 kB gzip. Branch (9c2b67f4 plus the brief): 35.4 kB / 14.6 kB. Load average 21 and 22. Client JS emitted in dist: 88.1 kB / 31.1 kB on both.
