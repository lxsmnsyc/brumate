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
  n: number; // waits of the body that have not settled
  done?: () => void; // set by the caller of `bound`, runs when `n` reaches 0
  w?: Work; // the `rendered` scopes and `afterInsert` work of the body, held until `give`
}

// brumate/client. The compiler emits it at `const x = await $memo(...)` of an instance script.
function wait(id: ScopeId, slots: unknown[], slot: number, rest: (slots: any[]) => Out): Out;

// Internal, for boundaries.
function bound(body: () => Out): [Out, Boundary?];
function give(own: Boundary): void;
```

Compiled code:

```ts
const $$s1 = $$b.createScope(1, undefined, 'User_1abc');
const { id } = $$b.unbind($$props, ['id'], undefined, $$b.sink($$s1));
let n = 0;
return $$b.wait($$s1, [id, n, load(id)], 2, ([id, n, user]) => {
  // the rest of the render, as before
  $$b.setSlots($$s1, [id, n, user, upper]);
  return $$f;
});
```

- `slots` holds the slots that the code before the `await` declared, at their slot indexes, with holes for the later ones. `slots[slot]` is the value of the memo. A memo with no slot uses the index after the last slot.
- A wait in a range: `<!--l<scope id>:w-->` and `<!--/w-->`. The start matches `MARKER`, and only client scope IDs (negative) appear in it.

## Behavior

- `wait` with a value that is not a thenable calls `rest(slots)` at once, in the same render, and returns what it returns.
- `wait` with a thenable returns the range, sets `scope.s = slots`, and takes the scope out of `rendered` until the rest runs. Update code that runs during the wait, such as a prop that a parent writes, reads and writes those slots.
- When the memo settles, `wait` reads its slot three ways: pending (a newer load runs, so it waits for that one), an error (`fail(scope, error)`), or a value (`rest(scope.s)`, then `insertHTML` before the end comment). A throw of `rest` goes to `fail(scope, error)`, and drops the scopes and work that `rest` made.
- `wait` drops the rest when the scope left `scopes` or the end comment has no parent.
- After `rest`, the memo slot counts as computed: the refresh after the insert does not load it again (`renderedLoads` with a value that is not a thenable).
- A boundary counts the waits of the renders inside it, nested waits of a rest included, and runs `done` when the count reaches 0.
- `bound(body)` renders `body` with a boundary of its own. With no wait, it returns `[out]`. Otherwise it moves `rendered` and `afterInsert` into `w` and returns `[out, boundary]`. The caller sets `done` before any wait can settle.
- While `w` is set, the scopes and work of each rest that settles join `w`, so the body enters the page with all its work in one insert. `give(boundary)` puts `w` back into `rendered` and `afterInsert`, for the insert of the body.
- A wait that fails does not count down, so `done` does not run. The `#try` around the boundary replaces it (browser-try).
- Without a boundary, the rest fills the place of the component (fill in place). browser-root-boundary adds a boundary outside every `#loading`.
- On an update, a boundary keeps its current content until the new waits settle. Outside every `#loading`, the root boundary does the same (browser-root-boundary).

## Stub

None. The real code is in `waits.ts`.

## Contract tests

In `packages/brumate/test/resume.test.ts`, `describe('a boundary')` inside `await $memo in a component that the browser renders`: the count, the held work, `done` at 0, and no boundary for a body that does not wait.

## Changes

- v1: initial draft from browser-await-spike (2026-11-01).
- v1 frozen by browser-await (2026-11-01): `wait(id, slots, slot, rest)` in place of the spike's `wait(scope, value, rest)`, so the slots set before the wait reach the rest; `bound` and `give` in place of the spike's `loading` internals.
