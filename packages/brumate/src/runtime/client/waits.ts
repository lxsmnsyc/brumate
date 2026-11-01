// A browser render that waits at `await $memo`, and the boundaries that count such waits.

import { MemoError } from '../shared.ts';
import type { ScopeId } from '../shared.ts';
import { rendered } from './blocks.ts';
import { setSlots } from './components.ts';
import { fail } from './errors.ts';
import { insertHTML, refresh } from './insert.ts';
import { afterInsert, resolveScope } from './scopes.ts';
import { loadingValues, renderedLoads, scopes, waiters } from './state.ts';
import type { Scope } from './state.ts';
import { isThenable, pending, writes } from './updates.ts';

/** What a render function of the browser returns. */
export type Out = string | DocumentFragment;

/** The scopes that renders made, and the work that waits for their insert. */
export type Work = [made: Scope[], queued: (() => void)[]];

/**
 * The waits of a body that a boundary renders. `n` counts the waits that have not settled, and
 * `done` runs when it reaches 0. `f` runs for a wait that fails, in place of its count-down.
 * `w` holds the work of the body until the body enters the page.
 */
export interface Boundary {
  n: number;
  done?: () => void;
  f?: (error: unknown) => void;
  w?: Work;
  /** The count of writes when the body rendered, so `give` knows whether updates missed it. */
  c: number;
}

/** The slots of a scope whose awaits settled, until the insert that shows the scope. */
const settledSlots: WeakMap<Scope, number[]> = new WeakMap();

/** The boundary of the render that runs, if any. */
let boundary: Boundary | undefined;

/** Runs a render with `own` as the boundary that its waits count in. */
function within(own: Boundary | undefined, render: () => Out): Out {
  const outer = boundary;
  boundary = own;
  try {
    return render();
  } finally {
    boundary = outer;
  }
}

/**
 * Renders `body` in a boundary of its own. Returns what it rendered, and the boundary when a wait
 * in it has not settled. That boundary holds the scopes and the `afterInsert` work of the body,
 * so the insert of anything else does not take them. `give` puts them back before the body goes
 * in, and the caller sets `done`, and `f` if it handles failures, before any wait settles.
 */
export function bound(body: () => Out): [Out, Boundary?] {
  const own: Boundary = { n: 0, c: writes };
  // The work of the render around it stays there.
  const made = rendered.length;
  const queued = afterInsert.length;
  const out = within(own, body);
  if (own.n === 0) {
    return [out];
  }
  own.w = [rendered.splice(made), afterInsert.splice(queued)];
  return [out, own];
}

/**
 * Puts back the work that a boundary held, for the insert of its body. Updates do not reach a
 * body that is not in the page, since blocks find their markers in the page. So when anything
 * was written during the hold, the updates of the body's scopes all run once it is in.
 */
export function give(own: Boundary): void {
  const [made, queued] = own.w ?? [[], []];
  own.w = undefined;
  if (own.c === writes) {
    rendered.push(...made);
  } else {
    queued.push(() => refresh(made));
  }
  afterInsert.push(...queued);
}

/** Counts a new wait in the boundary of the render that runs, and returns that boundary. */
export function join(): Boundary | undefined {
  const own = boundary;
  if (own) {
    own.n++;
  }
  return own;
}

/** True when the wait of `scope` in the range that `end` closes is gone with its block. */
function gone(scope: Scope, end: Node): boolean {
  return scopes.get(scope.id) !== scope || !end.parentNode;
}

/**
 * Waits until `ready()`, then runs `run` a microtask later, outside the write that made it ready.
 * Each write of a slot, and the removal of `scope`, checks again. A scope or range that goes ends
 * the wait with `leave`. `run` gets the check, to wait again with `waiters.set(check, scope)`.
 */
export function until(
  own: Boundary | undefined,
  scope: Scope,
  end: Node,
  ready: () => boolean,
  run: (check: () => void) => void,
): () => void {
  function check(): void {
    if (gone(scope, end)) {
      waiters.delete(check);
      leave(own);
    } else if (ready()) {
      waiters.delete(check);
      queueMicrotask(() => {
        if (gone(scope, end)) {
          leave(own);
        } else {
          run(check);
        }
      });
    }
  }
  waiters.set(check, scope);
  return check;
}

/** Ends a wait that `join` counted. At 0, the boundary runs `done`. */
export function leave(own: Boundary | undefined): void {
  if (own && --own.n === 0) {
    own.done?.();
  }
}

/** Ends a wait that failed: its boundary's `f`, or the count-down when the boundary has none. */
export function fault(own: Boundary | undefined, error: unknown): void {
  if (own?.f) {
    own.f(error);
  } else {
    leave(own);
  }
}

/**
 * Renders the rest of a wait in its boundary and puts it before `end`. In a boundary whose body
 * is not in the page yet, the scopes and work of the rest join the body's. A throw drops them.
 */
export function fillRange(own: Boundary | undefined, end: Node, rest: () => Out): void {
  const made = rendered.length;
  const queued = afterInsert.length;
  let out: Out;
  try {
    out = within(own, rest);
  } catch (error) {
    rendered.length = made;
    afterInsert.length = queued;
    throw error;
  }
  if (own?.w) {
    own.w[0].push(...rendered.splice(made));
    own.w[1].push(...afterInsert.splice(queued));
  }
  insertHTML(end, out);
}

/**
 * The rest of a render after `const x = await $memo(...)`. `slots` are the slots that the code
 * before the `await` set, with the value of the memo at `slot`, and `rest` gets them back.
 *
 * A value goes on at once, in the same render. A promise leaves a range of two comments, and
 * the scope holds `slots` while it waits, so a parent can write its props. The rest renders when
 * the slot holds a value: the first load's, or a newer load's that a prop started, whichever
 * settles as the latest. Its markup fills the range. A rejection, or a throw of `rest`, goes to
 * `fail`. A scope that goes during the wait ends it, and its boundary counts down.
 */
export function wait(
  id: ScopeId,
  slots: unknown[],
  slot: number,
  // oxlint-disable-next-line typescript/no-explicit-any -- The rest assigns the slots by name.
  rest: (slots: any[]) => Out,
): Out {
  const first = slots[slot];
  if (!isThenable(first)) {
    return rest(slots);
  }
  const scope = resolveScope(id)!;
  const promise = Promise.resolve(first);
  // The setup of the slots that the code before the `await` set, such as a promise prop or an
  // async memo, whose rejection the memo reports. The slot of the memo is this wait's.
  // The props stay for the rest's own `setSlots`, which keeps a promise prop a plain promise.
  slots[slot] = undefined;
  const props = scope.props;
  setSlots(id, slots);
  scope.props = props;
  scope.s[slot] = promise;
  // Update code that runs during the wait reads the promise, as it reads a memo that loads.
  loadingValues.add(promise);
  // The scope is not in the page until the rest runs, so the insert around it does not run its
  // memos.
  const at = rendered.indexOf(scope);
  if (at !== -1) {
    rendered.splice(at, 1);
  }
  // `l` and the scope ID match `MARKER`, so a block that closes removes the whole range. Client
  // scope IDs are negative, so no other reader of `l` comments matches it.
  const start = document.createComment(`l${scope.id}:w`);
  const end = document.createComment('/w');
  const range = document.createDocumentFragment();
  range.append(start, end);
  const own = join();
  function settle(check: () => void): void {
    if (pending(scope, slot)) {
      waiters.set(check, scope);
      return;
    }
    const value = scope.s[slot];
    if (value instanceof MemoError) {
      fail(scope, value.error);
      fault(own, value.error);
      return;
    }
    // A rest that waits again at a later `await` takes the scope out of the insert.
    let shown = false;
    try {
      fillRange(own, end, () => {
        // The scope goes with the markup of the rest.
        rendered.push(scope);
        const out = rest(scope.s);
        shown = rendered.includes(scope);
        return out;
      });
    } catch (error) {
      fail(scope, error);
      fault(own, error);
      return;
    }
    // The memos have their values, so the refresh after the insert that shows the scope does
    // not load them again.
    const done = settledSlots.get(scope) ?? [];
    done.push(slot);
    settledSlots.set(scope, done);
    if (shown) {
      settledSlots.delete(scope);
      for (const settled of done) {
        if (settled < scope.s.length) {
          renderedLoads.add(`${scope.id}:${settled}`);
        }
      }
    }
    leave(own);
  }
  const check = until(own, scope, end, () => !pending(scope, slot), settle);
  function write(value: unknown): void {
    // A newer load wrote the slot already.
    if (scope.s[slot] === promise) {
      scope.s[slot] = value;
    }
    if (waiters.has(check)) {
      check();
    }
  }
  promise.then(write, (error: unknown) => write(new MemoError(error)));
  return range;
}
