---
id: ref-element-writes
title: A ref in a list whose source reads it settles in a browser render
status: todo
priority: must
type: fix
story:
early: false
outline: false
milestone: 0.8.1
target: main
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/differential-1.test.ts test/differential-2.test.ts test/differential-3.test.ts test/differential-4.test.ts test/differential.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent:
owns: []
shared:
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/src/runtime/client/lists.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/test/differential/data.ts
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: release-0.8
    kind: hard
    why: it branches from `main` after the 0.8.0 promotion
---

> 2026-11-19 (refine): the outline's fix (compare references by element) cannot settle this page. Each pass makes a new row with a new element, so the next write is a different element too. The probe below decides between a fix and an accepted cause; `gate: false` so the maintainer picks before code changes.

# A ref in a list whose source reads it settles in a browser render

## Goal

`test/render/refLoop.brm` renders `#for (item of [element]) { <li ref=$bind(element)>x</li> }`. In a browser render it loops (by code reading, until the update guard, BRM187, stops the pass). The server and the resumed page show one `<li>`. Find whether the browser render can match the server without breaking reactive semantics; fix it if so, else mark the cause accepted.

## Context

Code path on origin/main (d64fb2eb), from the compiled output:

- Server: `element = $$ctx.element($$s2, 0)` runs inside the loop, after the list source `[element]` was read (`[undefined]`). The page ends with one row and `element` holding the row's reference. Nothing runs again.
- Resumed page: the ref slot holds an `ElementReference` (cause `lazy-ref`, accepted). Nothing writes it, so it settles. But a click on "Go" (`element = 1`) runs `b5` → `list([1])` → new row `r2` → `afterInsert` `set($$p, 0, elementAt($$s2, 0))` → `b5` again. By code reading the resumed page loops the same way after one write.
- Browser render: `r2` queues the same `afterInsert` write at once, so it loops at mount.
- Why "compare by element" does not help: `get` (`runtime/client/updates.ts`) resolves the reference to the element and stores it in the slot; `list` (`runtime/client/lists.ts`) keys rows by item (`$$k0 = item => item`), so the new item gives a new row with a new `<li>`, and the next reference points at that new element. `writeSlot`'s `Object.is` would fail with any equality.
- Svelte 5 (`bind:this` in `{#each [el]}`) and Solid (`ref={setEl}` in `<For each={[el()]}>`) loop on this program too: the write changes the list that made the element. The difference here is only that brumate's server and resume do not run the ref write reactively.
- docs/decisions.md line 141: a component the browser renders follows the server exactly. Memory of the maintainer: components behave as in Svelte/Solid when state updates.

## Steps

- [ ] Probe on main: a resume test with `refLoop` that clicks "Go" and checks that the update guard reports BRM187 (or the list keeps growing). This settles whether the resumed page also loops.
- [ ] Option A, decided 2026-11-19 from the Svelte/Solid rule (components behave as in Svelte and Solid when state updates, and both loop on this program): change `ref-loop` to `verdict: 'accepted'` with the reason above, keep the probe as a test, and make sure BRM187's message names the ref write when a ref write causes the loop. No other runtime change. Options B (special-case the first browser render) and C (rewrite the fixture) were rejected: B adds a render-path special case decision 141 asks to avoid and still loops after a write; C hides the case.

## Acceptance

- [ ] The probe test is in resume.test.ts and its result is in the outcome.
- [ ] With A or C: `test/differential/data.ts` no longer lists `ref-loop` as `remove` (accepted with a reason, or gone with its page changed). With B: `ref-loop` and its `diverge(...)` line leave the file and `refLoop` passes as a same page.
- [ ] A patch changeset only if runtime behavior changes (B, or a better BRM187 message).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`; `pnpm --filter brumate test` passes.

## Sizing

S: one fixture and one cause; B touches one runtime path.

## Notes for the worker

- Ref slots of resumed pages hold `{scope, anchor}` on purpose (cause `lazy-ref`); do not change that here.
