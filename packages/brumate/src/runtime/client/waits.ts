// A browser render that waits for memos: at `await $memo`, in cloned markup that reads a memo
// which never changes, and at the memos that markup reads. The boundaries count such waits, and
// `#loading` shows its fallback until they end.

import { MemoError } from '../shared.ts';
import type { ScopeId } from '../shared.ts';
import { HAS_LOADING } from '../features.ts';
import { clear, rendered } from './blocks.ts';
import { setSlots } from './components.ts';
import { fail } from './errors.ts';
import { insertHTML, markCloned, parseHTML, refresh } from './insert.ts';
import { afterInsert, destroy, resolveScope } from './scopes.ts';
import { loadingValues, renderedLoads, scopes, updating, waiters } from './state.ts';
import type { Scope } from './state.ts';
import { isThenable, noop, pending, writes } from './updates.ts';

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
  /** The boundary of the render around the body, which takes its work while it holds its own. */
  o?: Boundary;
}

/** The slots of a scope whose awaits settled, until the insert that shows the scope. */
const settledSlots: WeakMap<Scope, number[]> = new WeakMap();

/** The boundary of the render that runs, if any. */
let boundary: Boundary | undefined;

/** The scope whose rest of a render runs after a wait, if any. */
let resting: Scope | undefined;

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
  const own: Boundary = { n: 0, c: writes, o: boundary };
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
  // A body that goes into an outer body that is not in the page yet: the outer one holds the
  // work, and its own `give` runs the updates that either missed.
  const outer = own.o?.w;
  if (outer) {
    outer[0].push(...made);
    outer[1].push(...queued);
    return;
  }
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
 * The scope that `fillSettled` and `countLoads` reported each rejection to, as two renders or two
 * writes in one scope can read the same memo.
 */
const reportedRejections = new WeakMap<object, Scope>();

/** Ends a wait for a value that rejected: `fail`, once per error and scope, then `fault`. */
function failOnce(scope: Scope, own: Boundary | undefined, error: unknown): void {
  // A closed block shows nothing, so its error has no `#catch` to show.
  if (scopes.get(scope.id) !== scope) {
    leave(own);
    return;
  }
  const object = typeof error === 'object' && error !== null;
  try {
    if (!object || reportedRejections.get(error) !== scope) {
      if (object) {
        reportedRejections.set(error, scope);
      }
      // `onError` of the page can throw.
      fail(scope, error);
    }
  } finally {
    fault(own, error);
  }
}

/**
 * The wait of cloned markup that reads memos which never change: `write` runs once the ones
 * that are promises settle, as no update writes their values. It counts in the boundary of the
 * render, as `wait` does. A rejection goes to `fail`, once per error and scope, then to `fault`.
 * A scope that goes during the wait ends it with `leave`.
 */
export function fillSettled(
  id: ScopeId | Scope,
  values: unknown[],
  write: (...values: unknown[]) => void,
): void {
  let promised = false;
  for (const value of values) {
    promised ||= isThenable(value);
  }
  if (!promised) {
    write(...values);
    return;
  }
  const scope = resolveScope(id)!;
  const own = join();
  Promise.all(values).then(
    (settled) => {
      try {
        // A closed block removed the nodes.
        if (scopes.get(scope.id) === scope) {
          write(...settled);
        }
      } finally {
        leave(own);
      }
    },
    (error: unknown) => failOnce(scope, own, error),
  );
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
  const scope = resolveScope(id)!;
  // A load that an update started during an earlier wait of the scope is newer than one that
  // started before the `await`.
  if (scope.s[slot] !== undefined) {
    slots[slot] = scope.s[slot];
  }
  const first = slots[slot];
  if (!isThenable(first)) {
    return rest(slots);
  }
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
  // scope IDs are negative, so no other reader of `l` comments matches it. The range of an item
  // of a list that waits in its own script, outside an earlier range of it, marks the item.
  const item = 'i' in scope && resting !== scope;
  const start = document.createComment(item ? `i${scope.id}` : `l${scope.id}:w`);
  const end = document.createComment(item ? '/i' : '/w');
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
        const outer = resting;
        resting = scope;
        try {
          // The rest renders as an update does: it reads a memo that still loads as a promise.
          const out = updating(() => rest(scope.s));
          shown = rendered.includes(scope);
          return out;
        } finally {
          resting = outer;
        }
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

/**
 * Starts the load of an awaited memo before its `await`, where its inputs are ready. A throw
 * becomes a rejected promise, and a rejection is handled here, so neither surfaces before the
 * `await` waits for the load, which gets the same rejection.
 */
export function started(load: () => unknown): unknown {
  let value: unknown;
  try {
    value = load();
  } catch (error) {
    value = Promise.reject(error);
  }
  if (isThenable(value)) {
    value.then(undefined, noop);
  }
  return value;
}

/**
 * Starts the load of an awaited memo that reads other awaited memos once their loads settle.
 * `load` gets their values. A rejection of theirs rejects it too.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- The load names the values.
export function after(loads: unknown[], load: (...values: any[]) => unknown): unknown {
  return started(() => Promise.all(loads).then((values) => load(...values)));
}

/**
 * Counts the memos that markup of a browser render reads and that still load, in the boundary of
 * the render, as the server waits for them. The compiler passes the memos of a scope that markup
 * outside every `#loading` body reads, and the memos that a `#loading` body reads from outside.
 * Each counts down when its value settles. A rejection goes to `fail` and `fault`, as in
 * `fillSettled`. Outside a boundary, the markup fills in when the values arrive.
 */
export function countLoads(id: ScopeId | Scope, values: unknown[]): void {
  if (!HAS_LOADING || !boundary) {
    return;
  }
  for (const value of values) {
    if (isThenable(value)) {
      const scope = resolveScope(id)!;
      const own = join();
      Promise.resolve(value).then(
        () => leave(own),
        (error: unknown) => failOnce(scope, own, error),
      );
    }
  }
}

/** The order of a `#reveal` block. */
type RevealOrder = 'sequential' | 'backwards' | 'together' | 'natural';

/** A `#loading` block of a `#reveal` block that the browser renders. */
interface Member {
  /** Shows the body, once the body is ready. */
  s?: () => void;
  /** True once the body showed. */
  d?: boolean;
  /** Shows the fallback that `collapsed` held back. */
  f?: () => void;
}

/**
 * The `#loading` blocks of a `#reveal` block that the browser renders, in the order of the
 * markup, as the server orders the bodies that stream. One group is one chain of bodies.
 */
export interface Reveal {
  o: RevealOrder;
  c: boolean;
  m: Member[];
  /** True once the render of the block ended, so the group knows its last body. */
  e?: boolean;
  /** Shows the bodies that are ready and whose turn it is. A page without `#reveal` has no code for it. */
  t: () => void;
}

/** The `#reveal` block whose body renders, which the `#loading` blocks of the render join. */
let revealing: Reveal | undefined;

/**
 * A `#reveal` block in a browser render: the `#loading` blocks that its body renders, also in
 * the components inside it, join one group, as on the server. The group ends with the render,
 * before any body settles, so a block that a later update adds there is not ordered.
 */
export function reveal(order: RevealOrder, collapsed: boolean, body: () => Out): DocumentFragment {
  const group: Reveal = { o: order, c: collapsed, m: [], t: () => showTurns(group) };
  queueMicrotask(() => {
    group.e = true;
    group.t();
  });
  const outer = revealing;
  revealing = group;
  try {
    return toNodes(body());
  } finally {
    revealing = outer;
  }
}

/** Shows the bodies of a `#reveal` block that are ready and whose turn it is. */
function showTurns(group: Reveal): void {
  const { m: members, o: order } = group;
  function showAt(index: number): void {
    const member = members[index]!;
    member.d = true;
    member.s!();
    // `collapsed`: the body that shows brings the fallback of the next one in.
    members[index + 1]?.f?.();
  }
  if (order === 'natural') {
    for (const [index, member] of members.entries()) {
      if (member.s && !member.d) {
        showAt(index);
      }
    }
  } else if (order === 'sequential') {
    for (let index = 0; index < members.length && members[index]!.s; index++) {
      if (!members[index]!.d) {
        showAt(index);
      }
    }
  } else if (group.e && order === 'backwards') {
    for (let index = members.length - 1; index >= 0 && members[index]!.s; index--) {
      if (!members[index]!.d) {
        showAt(index);
      }
    }
  } else if (group.e) {
    // `together`: every body must be ready before any shows.
    let ready = true;
    for (const member of members) {
      ready &&= member.s !== undefined;
    }
    for (const [index, member] of members.entries()) {
      if (ready && !member.d) {
        showAt(index);
      }
    }
  }
}

/** What a body or a fallback rendered, as nodes. HTML holds clones that it parses back in. */
function toNodes(out: Out): DocumentFragment {
  if (typeof out !== 'string') {
    return out;
  }
  markCloned();
  return parseHTML(out);
}

/**
 * A `#loading` block that the browser renders, as a streamed one shows: the body at once when
 * nothing that it reads loads, and otherwise the fallback, until every wait of the body ends.
 * The body renders now, in a boundary of its own, and enters the page in one insert with its
 * work. A body whose wait fails keeps the fallback, and `fail` reported the error. The `#reveal`
 * block around it can hold a body that is ready for its turn. Updates after that keep the
 * content, since they render no boundary.
 */
export function loading(body: () => Out, fallback?: () => Out): DocumentFragment {
  const group = revealing;
  // A `#reveal` inside the body or the fallback orders only its own blocks, as on the server.
  revealing = undefined;
  try {
    return renderLoading(group, body, fallback);
  } finally {
    revealing = group;
  }
}

/** `loading` with the `#reveal` group of the render, and none for its own body and fallback. */
function renderLoading(
  group: Reveal | undefined,
  body: () => Out,
  fallback?: () => Out,
): DocumentFragment {
  const made = rendered.length;
  const queued = afterInsert.length;
  // A body that is ready shows at once, unless the `#reveal` around it holds it for its turn.
  const turn =
    group && !(group.o === 'natural' || (group.o === 'sequential' && group.m.length === 0));
  const result = bound(body);
  const nodes = toNodes(result[0]);
  let own = result[1];
  if (!own) {
    if (!turn) {
      return nodes;
    }
    // Held for its turn: its scopes and work wait, as those of a body that waits do.
    own = { n: 0, c: writes, o: boundary, w: [rendered.splice(made), afterInsert.splice(queued)] };
  }
  const held = own;
  // The range that the fallback fills, and then the body. Its comments name no block.
  const start = document.createComment('');
  const end = document.createComment('');
  const range = document.createDocumentFragment();
  // The scopes that the fallback made, which go when the body shows.
  let fallbackScopes: Scope[] = [];
  function showFallback(): DocumentFragment {
    const first = rendered.length;
    const fallbackNodes = fallback ? toNodes(fallback()) : document.createDocumentFragment();
    fallbackScopes = rendered.slice(first);
    return fallbackNodes;
  }
  const member: Member = {};
  // `#reveal (collapsed)` holds the fallback until the body before it shows.
  const hidden = group?.c && group.m.length > 0;
  range.append(start);
  if (!hidden) {
    range.append(showFallback());
  }
  range.append(end);
  if (hidden) {
    member.f = () => {
      if (end.parentNode) {
        insertHTML(end, showFallback());
      }
    };
  }
  function showBody(): void {
    // A block that closed during the wait dropped the body and its scopes.
    let dropped = !end.parentNode;
    for (const scope of held.w?.[0] ?? []) {
      dropped ||= scopes.get(scope.id) !== scope;
    }
    if (dropped) {
      held.w = undefined;
      return;
    }
    for (const scope of fallbackScopes) {
      destroy(scope);
    }
    clear(start, end);
    give(held);
    // The body can hold HTML that the insert reads, as a clone that a render made.
    markCloned();
    insertHTML(end, nodes);
  }
  if (group) {
    group.m.push(member);
  }
  held.done = () => {
    if (group) {
      member.s = showBody;
      group.t();
    } else {
      showBody();
    }
  };
  held.f = () => {
    // The fallback stays, as on the server, and the scopes of the body go. A body that fails
    // takes its turn, so the bodies after it still show.
    held.done = undefined;
    held.f = noop;
    for (const scope of held.w?.[0] ?? []) {
      destroy(scope);
    }
    held.w = undefined;
    if (group) {
      member.s = noop;
      group.t();
    }
  };
  if (held.n === 0) {
    held.done();
  }
  return range;
}
