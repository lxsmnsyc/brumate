// A browser render that waits at `await $memo`, and the boundaries that count such waits.

import { MemoError } from '../shared.ts';
import type { ScopeId } from '../shared.ts';
import { rendered } from './blocks.ts';
import { fail } from './errors.ts';
import { insertHTML } from './insert.ts';
import { afterInsert, resolveScope } from './scopes.ts';
import { loadingValues, renderedLoads, scopes, waiters } from './state.ts';
import type { Scope } from './state.ts';
import { isThenable, pending } from './updates.ts';

/** What a render function of the browser returns. */
export type Out = string | DocumentFragment;

/** The scopes that renders made, and the work that waits for their insert. */
export type Work = [made: Scope[], queued: (() => void)[]];

/**
 * The waits of a body that a boundary renders. `n` counts the waits that have not settled, and
 * `done` runs when it reaches 0. `w` holds the work of the body until the body enters the page.
 */
export interface Boundary {
  n: number;
  done?: () => void;
  w?: Work;
}

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
 * in, and the caller sets `done`, which runs when the last wait settles.
 */
export function bound(body: () => Out): [Out, Boundary?] {
  const own: Boundary = { n: 0 };
  const out = within(own, body);
  if (own.n === 0) {
    return [out];
  }
  own.w = [rendered.splice(0), afterInsert.splice(0)];
  return [out, own];
}

/** Puts back the work that a boundary held, for the insert of its body. */
export function give(own: Boundary): void {
  const [made, queued] = own.w ?? [[], []];
  own.w = undefined;
  rendered.push(...made);
  afterInsert.push(...queued);
}

/**
 * The rest of a render after `const x = await $memo(...)`. `slots` are the slots that the code
 * before the `await` set, with the value of the memo at `slot`, and `rest` gets them back.
 *
 * A value goes on at once, in the same render. A promise leaves a range of two comments, and
 * the scope holds `slots` while it waits, so a parent can write its props. When the memo
 * settles, `rest` renders with the slots as they are then, and its markup fills the range. A
 * newer load of the memo, which a prop started, is waited for too. A rejection, or a throw of
 * `rest`, goes to `fail`.
 */
export function wait(
  id: ScopeId,
  slots: unknown[],
  slot: number,
  // oxlint-disable-next-line typescript/no-explicit-any -- The rest takes the slots by name, as any.
  rest: (slots: any[]) => Out,
): Out {
  const first = slots[slot];
  if (!isThenable(first)) {
    return rest(slots);
  }
  const scope = resolveScope(id)!;
  const promise = Promise.resolve(first);
  slots[slot] = promise;
  scope.s = slots;
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
  const own = boundary;
  if (own) {
    own.n++;
  }
  function settle(): void {
    // A block removed the component while it waited.
    if (scopes.get(scope.id) !== scope || !end.parentNode) {
      return;
    }
    if (pending(scope, slot)) {
      // A newer load, which a prop started. Each write, and the removal of the scope, checks again.
      const check = (): void => {
        if (!pending(scope, slot) || scopes.get(scope.id) !== scope) {
          waiters.delete(check);
          settle();
        }
      };
      waiters.set(check, scope);
      return;
    }
    const value = scope.s[slot];
    if (value instanceof MemoError) {
      fail(scope, value.error);
      return;
    }
    // The scope and the work that the rest makes, which go with its markup.
    rendered.push(scope);
    const made = rendered.length - 1;
    const queued = afterInsert.length;
    let out: Out;
    try {
      out = within(own, () => rest(scope.s));
    } catch (error) {
      rendered.length = made;
      afterInsert.length = queued;
      fail(scope, error);
      return;
    }
    // The memo has its value, so the refresh after the insert does not load it again.
    if (slot < scope.s.length) {
      renderedLoads.add(`${scope.id}:${slot}`);
    }
    // A boundary whose body is not in the page yet keeps the work for its own insert.
    if (own?.w) {
      own.w[0].push(...rendered.splice(made));
      own.w[1].push(...afterInsert.splice(queued));
    }
    insertHTML(end, out);
    if (own && --own.n === 0) {
      own.done?.();
    }
  }
  function write(value: unknown): void {
    // A newer load wrote the slot already.
    if (scope.s[slot] === promise) {
      scope.s[slot] = value;
    }
    settle();
  }
  promise.then(write, (error: unknown) => write(new MemoError(error)));
  return range;
}
