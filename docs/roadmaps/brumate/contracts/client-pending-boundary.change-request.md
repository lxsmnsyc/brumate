# Change request: client-pending-boundary v2 (browser-await-blocks)

Requested by browser-await-blocks, 2026-11-02. Additive. It lands the "Planned additions" of v1.2 with one change: no `waitAll`.

## Additions

In `packages/brumate/src/runtime/client/waits.ts`, exported from `brumate/client`:

```ts
// The load of an awaited memo that starts before its `await`. A throw becomes a rejected
// promise, and a rejection is handled here, so neither surfaces before the `await`.
function started(load: () => unknown): unknown;

// The load of an awaited memo that reads other awaited memos whose `await` comes later: it
// starts when their loads settle, with their values. A rejection of theirs rejects it.
function after(loads: unknown[], load: (...values: any[]) => unknown): unknown;
```

Compiled code, in a render module or a render function of a block:

```ts
const $$w_b = $$b.started(() => (loadUser(2)));
const $$w_d = $$b.after([$$w_b], (b) => (loadUser(b.name.length + 20)));
let a;
return $$b.wait($$s2, [(loadUser(1))], 0, ($$v) => {
  [a] = $$v;
  ran('between', a.name);
  let b;
  return $$b.wait($$s2, [a, $$w_b], 1, ($$v) => { ... });
});
```

- The start points are the server's (`findLoadStarts`, `Emitter.earlyLoads`). A run of adjacent awaits, which the server starts together with `waitAll`, starts before its first `await` in the browser.
- A load reads the memos of `after` as parameters. A load that reads such a memo through a local function or another memo starts after that memo's `await` instead.

## Changed behavior of `wait`

- A value that an update wrote into the slot during an earlier wait of the scope replaces `slots[slot]`: a newer load wins over the load that started before the `await`.
- The range of a wait of a `#for` row in its own script or markup is `<!--i<id>-->` and `<!--/i-->`, when the row is not inside an earlier range of its own. The scope has `i` (`setItem` runs before the wait), so the list finds the row while it waits and after.
- The rest runs inside `updating`, as an update does, so a render function inside it reads a memo of an outer scope that still loads as a promise, not as an error.

- `holdRow` (browser-root-boundary) names its range after the `i` range that starts the row's output when no held scope has the list as parent: a row that waits in its own script is out of `rendered` until its rest runs.

## Not added

- `waitAll`. The loads of a run start before the first `await`, so the nested `wait` calls overlap the same way. One helper less in the bundle of a page that waits.

## Contract tests

`packages/brumate/test/resume.test.ts`, `describe('await in block scripts, #for rows and markup of a browser render')`: the overlap of two independent loads, a dependent load that starts when its input settles, an early rejection reported once at its `await` with no unhandled rejection, rows that move and go while they wait, and a `#loading` fallback around a body that waits in its script.
