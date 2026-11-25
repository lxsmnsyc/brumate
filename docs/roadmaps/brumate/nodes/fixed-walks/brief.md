---
id: fixed-walks
title: The walk of a cloned template is code
status: done
priority: should
type: refactor
story:
early: false
outline: false
milestone: 0.10.0
target:
ship: auto
land: auto
from:
size: M
risk: medium
spike: false
hypothesis:
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-25
spent: 106940
owns:
  - packages/brumate/src/codegen/template.ts
  - packages/brumate/test/fixed-walks.test.ts
  - docs/roadmaps/brumate/nodes/fixed-walks/**
shared:
  - packages/brumate/src/codegen/client.ts
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/src/runtime/client/**
  - docs/proposals.md
reserves: []
provides: []
depends_on:
  - on: clone-remaining-bodies
    kind: hard
    why: every body the browser renders must be a cloned template first (re-pointed from drop-marker-index, dropped 2026-11-12)
  - on: no-client-html
    kind: hard
    why: both edit codegen/client.ts and the client walk; run one after the other (hot files)
---

# The walk of a cloned template is code

## Goal

> 2026-11-25: moved to 0.10.0 as should by the maintainer (lives in `brumate`, no new package). Refined the same day.

A cloned template finds the elements its render writes with an encoded walk that the runtime reads (`walkOf`, from #164). Solid and Svelte emit the walk as code instead: each node on the path goes into a variable (`const a = t.firstChild; const b = a.nextSibling`). Do the same for cloned templates, if it is still worth it.

## Context

- Source: [Later: fixed walks](../../../../proposals.md#later-fixed-walks). The prototype is `origin/exp/fixed-walk` (efb77ae4, 2026-10-25): about 100 lines in `codegen/client.ts`, `codegen/template.ts` and `runtime/client.ts`. It predates the encoded walk (#164), cloned bodies for every block and no-client-html, so port the idea, not the patch.
- Then: create 1,000 rows about 6.1 ms with the runtime walk, 5.2 ms with the fixed walk, Marko 6 5.0 ms; replace about the same; 2 to 3% of the 28 ms from click to paint.
- Since: #164 took most of the gain. Allocations for 1,000 rows went from 1,200 kB to 807 kB, against 769 kB for the fixed walk (2026-11-12). The gain left may be within noise.
- The walk costs a line of code per node on a path, in each component. The compiler may only emit it when the parser keeps the markup as written: check the nesting of elements as Solid does (a `<p>` inside a `<p>`, a `<tr>` outside a table, and the like), and keep the encoded walk for a template that fails the check.
- GOAL.md: size is recorded, not a gate, from 0.9.0.

## Steps

1. Measure first, on the target with clone-remaining-bodies and no-client-html landed. Port the fixed walk for the rows page only, behind a local switch, and compare: `node benchmarks/harness/profile-rows.mjs brumate create 20` and `replace`, plus `pnpm bench --only brumate --scenario rows --runs 20`, runtime walk against fixed walk. Use perf-pass's `bench.py` for the noise. Record both in `log.md`.
2. If create 1,000 rows is not faster by more than the noise, stop: write "Not reproduced" in the outcome with the numbers, change no code outside the node folder, and update the proposal's numbers in `docs/proposals.md`.
3. Otherwise emit the fixed walk for every cloned template that passes the nesting check, drop the encoded walk where nothing uses it any more, and keep it for the rest.

## Acceptance

- [ ] The measurement of step 1 is in the outcome: base and branch, create and replace, with the noise.
- [ ] On a go: every cloned template that passes the nesting check uses the fixed walk; `test/fixed-walks.test.ts` covers a template that fails the check (it keeps the encoded walk) and nested blocks; resume, render and differential tests pass.
- [ ] On a go: todos and rows gzip JS before `load` are recorded, base and branch (`pnpm bench --only brumate --scenario todos`).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: a codegen change and its runtime reader, with a measurement gate first. A no-go after step 1 is S.
