---
name: client-pending-boundary
version: 1
status: frozen
defined_by: browser-await
---

# Contract: client-pending-boundary

## Purpose

The runtime interface between a render that waits (`wait` from browser-await) and the boundary that holds it: the root boundary (browser-root-boundary), `#loading` in a browser render (browser-loading-fallback), a promise in markup (promise-in-markup) and `#try` (browser-try).

## Interface

In `packages/brumate/src/runtime/client/waits.ts`. Only `wait` is exported from `brumate/client`. The rest is internal to the client runtime.

```ts
type Out = string | DocumentFragment;
type Work = [made: Scope[], queued: (() => void)[]];

interface Boundary {
  n: number; // waits of the body that have not ended
  done?: () => void; // set by the owner, runs when `n` reaches 0
  f?: (error: unknown) => void; // set by the owner, runs for a failed wait in place of its count-down
  w?: Work; // the `rendered` scopes and `afterInsert` work of the body, held until `give`
}

// brumate/client. The compiler emits it at `const x = await $memo(...)` of an instance script.
function wait(id: ScopeId, slots: unknown[], slot: number, rest: (slots: any[]) => Out): Out;

// Internal, for the owners of boundaries.
function bound(body: () => Out): [Out, Boundary?];
function give(own: Boundary): void;

// Internal, for any kind of wait, such as a promise in markup.
function join(scope?: Scope): Boundary | undefined;
function leave(own: Boundary | undefined): void;
function fault(own: Boundary | undefined, error: unknown): void;
function fillRange(own: Boundary | undefined, end: Node, rest: () => Out): void;
```

Compiled code:

```ts
const $$s1 = $$b.createScope(1, undefined, 'User_1abc');
let { id } = $$b.unbind($$props, ['id'], undefined, $$b.sink($$s1));
let n = 0;
let user;
return $$b.wait($$s1, [id, n, load(id)], 2, ($$v) => {
  [id, n, user] = $$v;
  // the rest of the render, as before
  $$b.setSlots($$s1, [id, n, user, upper]);
  return $$f;
});
```

- `slots` holds the slots that the code before the `await` declared, at their slot indexes, with holes for the later ones. `slots[slot]` is the value of the memo. A memo with no slot uses the index after the last slot.
- The awaited name is a `let` before the call, so a function declared before the `await` reads it. The variable declarations before the last `await` are `let`, and the rest assigns the slots among them, so it and those functions read the values after the wait.
- A wait in a range: `<!--l<scope id>:w-->` and `<!--/w-->`. The start matches `MARKER`, and only client scope IDs (negative) appear in it.

## Behavior

- `wait` with a value that is not a thenable calls `rest(slots)` at once, in the same render, and returns what it returns.
- `wait` with a thenable returns the range, runs the `setSlots` setup on the other slots (promise props, async memos), puts the promise in its slot, and takes the scope out of `rendered` until the rest runs. Update code that runs during the wait, such as a prop that a parent writes, reads and writes those slots.
- The rest runs when the slot holds a value and no newer load runs. A newer load that a prop started wins, also when it settles before the first one. `wait` checks at each write (`waiters`), and runs the rest a microtask later.
- A load that rejects, or a throw of `rest`, calls `fail(scope, error)`, which reports it to the nearest `#try` with a `t` entry or as `brumate:error`, then `fault(boundary, error)`. A throw drops the scopes and work that `rest` made.
- A scope that leaves `scopes` during the wait, or whose end comment has no parent, ends the wait with `leave`. The rest never runs.
- After `rest`, the memo slot counts as computed: the refresh after the insert does not load it again (`renderedLoads` with a value that is not a thenable).
- `join(scope)` counts a wait in the boundary of the render that runs. Outside such a render, it counts in the held boundary (`w` set) of the nearest scope above `scope` (through `p`, then `o`) that a held body made. It returns the boundary, or undefined.
- `leave(own)` counts down. At 0 it runs `done`.
- `fault(own, error)` runs `own.f(error)` when the owner set it, and `leave(own)` otherwise. So with no `f`, a failed wait releases its boundary: the body shows with the failed range empty, and the error was reported by `fail`. browser-try sets `f` to show its `#catch` in place of the boundary.
- `fillRange(own, end, rest)` renders `rest` with `own` as the boundary of the render, and inserts its markup before `end`. While `own.w` is set, the scopes and work of the rest join `w`, so the body enters the page with all its work in one insert.
- `bound(body)` renders `body` with a boundary of its own. With no wait, it returns `[out]`. Otherwise it moves `rendered` and `afterInsert` into `w` and returns `[out, boundary]`. The owner sets `done`, and `f` if it handles failures, before any wait can settle. An owner that drops the whole boundary clears `done` and `f`.
- `give(boundary)` puts `w` back into `rendered` and `afterInsert`, for the insert of the body.
- Without a boundary, the rest fills the place of the component (fill in place). browser-root-boundary adds a boundary outside every `#loading`.
- On an update, a boundary keeps its current content until the new waits settle. Outside every `#loading`, the root boundary does the same (browser-root-boundary).

## Planned additions

- v2, additive, for browser-await-blocks: `waitAll` (a run of awaits), `started` and `after` (loads that start before their `await`), from the spike outcome, "Topological awaits". They count through `join`, `leave` and `fault`.

## Stub

None. The real code is in `waits.ts`.

## Contract tests

In `packages/brumate/test/resume.test.ts`, `describe('a boundary')` inside `await $memo in a component that the browser renders`: the count, the held work, `done` at 0, a scope that goes while the body is held, a wait that starts under a held scope, `f` for a failed wait and the count-down without it, and no boundary for a body that does not wait.

## Changes

- v1: initial draft from browser-await-spike (2026-11-01).
- v1 frozen by browser-await (2026-11-01). `wait(id, slots, slot, rest)` replaces the spike's `wait(scope, value, rest)`, so the slots set before the wait reach the rest. `bound` and `give` replace the spike's `loading` internals.
- v1 reworked before any consumer, from the review of #413 (2026-11-02). Added `Boundary.f`, `join`, `leave`, `fault` and `fillRange`. A scope that goes during a wait counts down, a wait under a held scope joins its boundary, and the latest load wins.
