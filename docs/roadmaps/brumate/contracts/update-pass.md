---
name: update-pass
version: 1
status: frozen
defined_by: batching
---

# Contract: update-pass

## Purpose

A pass is the outermost unit of code that runs at once. Writes in a pass queue their updates. The
queue runs when the outermost pass ends, in the order of ordered updates, and effects run after it.

## Interface

### Units that are a pass

- A handler, up to its first `await`.
- A function prop or provided function that another component calls (`call`).
- A run of effects (`$effect`, `$client` callbacks): all the effects that wait run as one pass.
- A value that settles: an async memo, a value that the server streams, an `$optimistic` guess.
- A write outside every pass is a pass of its own. So after an `await`, each write is its own pass and shows at once, unless the code runs inside another pass. There is no batching across `await`, and `flush()` after an `await` does nothing.
- A `$bind` write from a child joins the pass that runs.

### Signatures

In `packages/brumate/src/runtime/client/updates.ts`:

```ts
/** Runs `run` as a pass, or inside the pass that runs, and returns its result. */
export function pass<T>(run: () => T): T;

/** Runs the memos and bindings that wait in the pass at once. Effects still wait for the pass to end. */
export function flush(): void;
```

In `brumate/signals` (`packages/brumate/src/runtime/signals.ts`), for `.brm` files and the code
they import:

```ts
/** Writes what the writes of the handler so far changed, so the code after it can read the DOM. */
export function flush(): void;
```

- `flush()` outside a pass does nothing, since a write outside a pass is already written.
- `flush()` on the server does nothing: nothing writes there.
- `flush()` reaches the client runtime through the registry symbol `Symbol.for('brumate.flush')`,
  as `transition` of `brumate/events` reaches `brumate.updated`. The page then needs no import of the client.

## Behavior

- Memos stay eager. A write computes the memos that read the slot at once, down to the first depth
  that waits for a binding, so a handler that writes `count` and reads `double` reads the new value.
- Bindings, and the memos that sit below a pending binding, wait for the end of the pass or for `flush()`.
- Effects wait for the end of the pass. `flush()` does not run them.
- An error in an update goes to the nearest `#try` as before. An error of a handler does not drop
  the updates of its writes.
- A handler runs after the update code of its scope has loaded, so its writes are never held back
  to run after the handler returns.

### End-of-pass hook (reserved)

```ts
/** Runs after the queue of a pass has run, and before the effects. */
export function onPassEnd(hook: () => void): void;
```

Not built. `search-params` builds it in `updates.ts` when it needs one write of the URL for each pass. It must run the hook list after `drain()` of the outermost pass and clear the list when the pass ends.

## Stub

None. `pass` and `flush` are real in `packages/brumate/src/runtime/client/updates.ts`. `onPassEnd` is reserved.

## Contract tests

The batching tests in packages/brumate/test/resume.test.ts.

## Changes

- v1: frozen by batching. `flush` imports from `brumate/signals` as a function of the runtime, and a mixed import with the compile-time functions stays valid.
