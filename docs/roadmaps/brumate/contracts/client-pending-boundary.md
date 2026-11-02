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
  c: number; // the count of writes when the body rendered
  o?: Boundary; // the boundary of the render around the body, if any
}

// brumate/client. The compiler emits it at `const x = await $memo(...)` of an instance script.
function wait(id: ScopeId, slots: unknown[], slot: number, rest: (slots: any[]) => Out): Out;

// Internal, for the owners of boundaries.
function bound(body: () => Out): [Out, Boundary?];
function give(own: Boundary): void;

// Internal, for any kind of wait, such as a promise in markup.
function join(): Boundary | undefined;
function until(
  own: Boundary | undefined,
  scope: Scope,
  end: Node,
  ready: () => boolean,
  run: (check: () => void) => void,
): () => void;
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
- The awaited name is a `let` before the call, so a function declared before the `await` reads it. A call of such a function before the `await` reads `undefined`, where the server throws a `ReferenceError`. The variable declarations before the last `await` are `let`, and the rest assigns the slots among them, so it and those functions read the values after the wait.
- A wait in a range: `<!--l<scope id>:w-->` and `<!--/w-->`. The start matches `MARKER`, and only client scope IDs (negative) appear in it.

## Behavior

- `wait` with a value that is not a thenable calls `rest(slots)` at once, in the same render, and returns what it returns.
- `wait` with a thenable returns the range, runs the `setSlots` setup on the other slots (promise props, async memos) and keeps `scope.props`, so the rest's own `setSlots` keeps a promise prop a plain promise. It puts the promise in its slot, and takes the scope out of `rendered` until the rest runs. Update code that runs during the wait, such as a prop that a parent writes, reads and writes those slots.
- The rest runs when the slot holds a value and no newer load runs. A newer load that a prop started wins, also when it settles before the first one. `wait` waits with `until`.
- A load that rejects, or a throw of `rest`, calls `fail(scope, error)`, which reports it to the nearest `#try` with a `t` entry or as `brumate:error`, then `fault(boundary, error)`. A throw drops the scopes and work that `rest` made.
- A scope that leaves `scopes` during the wait, or whose end comment has no parent, ends the wait with `leave`. The rest never runs.
- After `rest`, the memo slot counts as computed: the refresh after the insert does not load it again (`renderedLoads` with a value that is not a thenable). When the rest waits again at a later `await`, the settled slots wait for the insert that shows the scope.
- `join()` counts a wait in the boundary of the render that runs, and returns it, or undefined. A wait that starts outside such a render fills in place.
- `until(own, scope, end, ready, run)` is the check that every wait uses. It runs at each write of a slot (`waiters`) and when `scope` goes. When `scope` leaves `scopes` or `end` has no parent, it ends the wait with `leave(own)`. When `ready()` is true, it runs `run(check)` a microtask later, outside the write, and `run` waits again with `waiters.set(check, scope)`. It returns the check, which code that settles a value can call at once. `run` owns the count-down: it ends with `leave(own)`, or `fault(own, error)` when it fails or throws, or it waits again.
- `leave(own)` counts down. At 0 it runs `done`.
- `fault(own, error)` runs `own.f(error)` when the owner set it, and `leave(own)` otherwise. So with no `f`, a failed wait releases its boundary: the body shows with the failed range empty, and the error was reported by `fail`. browser-try sets `f` to show its `#catch` in place of the boundary.
- `fillRange(own, end, rest)` renders `rest` with `own` as the boundary of the render, and inserts its markup before `end`. While `own.w` is set, the scopes and work of the rest join `w`, so the body enters the page with all its work in one insert.
- `bound(body)` renders `body` with a boundary of its own. With no wait, it returns `[out]`. Otherwise it moves the `rendered` scopes and `afterInsert` work that the body added into `w`, and returns `[out, boundary]`. The work of the render around it, such as an outer `bound`, stays there. The owner sets `done`, and `f` if it handles failures, before any wait can settle. An owner that drops the whole boundary clears `done` and `f`.
- `give(boundary)` puts `w` back into `rendered` and `afterInsert`, for the insert of the body. When the boundary around it (`o`) still holds its own body, `give` moves the work into `o.w` instead, so the outer `give` runs the updates that either body missed (its `c` is never newer).
- Updates do not reach a held body that is not in the page, since blocks find their markers in the page. So when any slot was written during the hold (the write count differs from `c`), `give` runs all the updates of the body's scopes once the body is in, in place of the memos-only refresh: an `#if` that a write opened opens then, and the waits that this starts fill in place. browser-root-boundary relies on this for a prop that a parent writes during the hold.
- Without a boundary, the rest fills the place of the component (fill in place). browser-root-boundary adds a boundary outside every `#loading`.
- On an update, a boundary keeps its current content until the new waits settle. Outside every `#loading`, the root boundary does the same (browser-root-boundary).

## Planned additions

- v2, additive, for browser-await-blocks: `waitAll` (a run of awaits), `started` and `after` (loads that start before their `await`), from the spike outcome, "Topological awaits". They count through `join`, `leave` and `fault`.

## Stub

None. The real code is in `waits.ts`.

## Contract tests

In `packages/brumate/test/resume.test.ts`, `describe('a boundary')` inside `await $memo in a component that the browser renders`: the count, the held work, `done` at 0, a scope that goes while the body is held, the updates that a held body missed, a nested body, a nested body given into a held outer body, an async memo that settles during the hold, one count-down per wait, `f` for a failed wait and the count-down without it, and no boundary for a body that does not wait.

## Changes

- v1: initial draft from browser-await-spike (2026-11-01).
- v1 frozen by browser-await (2026-11-01). `wait(id, slots, slot, rest)` replaces the spike's `wait(scope, value, rest)`, so the slots set before the wait reach the rest. `bound` and `give` replace the spike's `loading` internals.
- v1 reworked before any consumer, from the review of #413 (2026-11-02). Added `Boundary.f`, `join`, `leave`, `fault` and `fillRange`. A scope that goes during a wait counts down, and the latest load wins.
- v1 reworked again, from the re-review of #413 (2026-11-02). Added `until` and `Boundary.c`. From the third review: `Boundary.o`, and `give` into a held outer body. `join` no longer walks held scopes: `give` runs the updates that a held body missed. A nested `bound` holds only its own work.
