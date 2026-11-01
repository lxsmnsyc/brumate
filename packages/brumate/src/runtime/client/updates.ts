// Slots and what reads them: reads and writes of a slot, memos, effects, and the updates that a
// write runs.

import { HAS_BINDINGS } from '../features.ts';
import {
  Binding,
  ElementReference,
  MemoError,
  FunctionReference,
  SlotReference,
  isAsyncIterable,
  isBinding,
  isSlotReference,
} from '../shared.ts';
import type { ScopeId } from '../shared.ts';
import { findElement } from './blocks.ts';
import { childrenReady } from './children.ts';
import { loadModule, loadingCode } from './code.ts';
import { fail } from './errors.ts';
import { call, callNow, setPass } from './references.ts';
import { afterInsert, descendants, findRoot } from './scopes.ts';
import {
  DEV,
  devtools,
  guesses,
  hiding,
  loadingSlots,
  loads,
  memoControllers,
  modules,
  exempt,
  loadingValues,
  renderedLoads,
  scopes,
  timers,
  updating,
  waiters,
} from './state.ts';
import type { Scope } from './state.ts';

// Slots

// oxlint-disable-next-line typescript/no-explicit-any -- Slots hold any value.
export function get(scope: Scope, slot: number): any {
  if (dirty.size > 0 && !draining) {
    settle(scope);
  }
  const value = scope.s[slot];
  if (value instanceof Promise && !scope.plain?.has(slot)) {
    // A memo that reads any promise waits for it.
    if (computing > 0) {
      throw new NotReady(value);
    }
    if (loadingValues.has(value)) {
      // An effect skips the run, and runs again when the value arrives.
      if (runningEffects > 0) {
        throw new NotReady(value);
      }
      // Code that updates the page reads the promise. Anything else has no value to read.
      if (exempt === 0) {
        throw new Error(
          'This value is still loading. Wait for it with await $resolve(memo), or check $isPending(memo) first',
        );
      }
    }
  }
  // A memo that threw holds its error, and each read of it throws.
  if (value instanceof MemoError) {
    throw value.error;
  }
  if (value instanceof ElementReference) {
    const element = findElement(value.scope, value.anchor);
    if (element) {
      scope.s[slot] = element;
    }
    return element ?? undefined;
  }
  return value;
}

/**
 * A memo that threw holds the error in place of a value, and its readers update. Each one that
 * reads it throws into the nearest `#try` around it, and the code that does not read it runs as
 * usual. A memo that computes again without a throw holds its value again.
 */
function hold(scope: Scope, slot: number, key: string, error: unknown): void {
  loadingSlots.delete(key);
  loads.delete(key);
  guesses?.map.delete(key);
  set(scope, slot, new MemoError(error));
}

// The number of writes since the page loaded, so scopes that stream in later know to update.
export let writes: number = 0;

/** Starts the count of writes again. */
export function resetWrites(): void {
  writes = 0;
}

/**
 * Writes a slot from code of a component. A prop that a parent bound with
 * `$bind` writes the parent's slot too, through any number of levels, and
 * the parent's update of the prop then finds the value already there. A
 * binding with a setter, `$bind(name, fn)`, calls it in place of the write,
 * and the parent's update of the prop writes the value that it keeps, before
 * the call returns.
 */
export function set<T>(scope: Scope, slot: number, value: T): T {
  const bound = scope.b?.[slot];
  if (bound === undefined || isSlotReference(bound)) {
    const target = bound && scopes.get(bound.scope);
    if (target) {
      // Both slots change in one pass, so the memos of each read both new values.
      pass(() => {
        writeSlot(scope, slot, value);
        set(target, bound.slot, value);
      });
    } else {
      writeSlot(scope, slot, value);
    }
  } else {
    send(bound, value);
    // The setter wrote the caller's signal, so the update of this prop runs now, and a read
    // right after the write gets what the setter kept.
    flush();
  }
  return value;
}

/**
 * Calls the setter of a binding. An element reference arrives only while a render writes its ref,
 * so the element goes once the render has inserted it.
 */
export function send(bound: unknown, value: unknown): void {
  if (value instanceof ElementReference) {
    afterInsert.push(() => {
      const element = findElement(value.scope, value.anchor);
      if (element) {
        send(bound, element);
      }
    });
  } else if (bound instanceof FunctionReference) {
    const args = [...(bound.args ?? []), value];
    // A loaded setter runs at once, so the writer reads what it kept.
    if (!callNow(bound.ref, scopes.get(bound.scope), args)) {
      void call(bound.ref, scopes.get(bound.scope), args);
    }
  } else if (typeof bound === 'function') {
    void bound(value);
  }
}

/** Writes a slot, and updates what reads it. */
export function writeSlot(scope: Scope, slot: number, value: unknown): void {
  if (!Object.is(scope.s[slot], value)) {
    writes++;
    scope.s[slot] = value;
    if (DEV) {
      devtools()?.write?.(scope, slot, value);
    }
    trigger(scope, slot);
  }
}

/** What `$bind(name)` passes a child, in markup that the browser renders. */
export function binding<T>(
  value: T,
  scope: Scope | ScopeId,
  slot: number,
  setter?: unknown,
): Binding<T> {
  return new Binding(
    value,
    new SlotReference(typeof scope === 'object' ? scope.id : scope, slot),
    setter,
  );
}

/**
 * Records the props that a parent bound with `$bind`, among the props that a
 * component the browser renders writes: `slots` has the slot of each, by its name.
 */
export function bindings(
  scope: Scope | ScopeId,
  props: Record<string, unknown>,
  slots: Record<string, number>,
): void {
  const target = typeof scope === 'object' ? scope : scopes.get(scope);
  for (const [name, slot] of Object.entries(slots)) {
    const value = props[name];
    if (target && HAS_BINDINGS && isBinding(value)) {
      (target.b ??= {})[slot] = value.target;
      // An element that the component wrote into its prop goes up once the markup is in the page,
      // when the scope that holds the signal has its slots.
      const written = target.s[slot];
      if (written instanceof ElementReference) {
        afterInsert.push(() => {
          if (scopes.get(target.id) === target) {
            set(target, slot, written);
          }
        });
      }
    }
  }
}

/**
 * The names of a call of a module function, for its shared code. Each ref
 * is a slot of `scope`, `[scope, slot]` for a slot of another scope, or
 * `[value]` for a value that does not change, such as a literal argument.
 */
export function cells(scope: Scope, links: unknown[], names: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [index, name] of names.entries()) {
    const ref = links[index];
    let owner = scope;
    let slot: number;
    if (typeof ref === 'number') {
      slot = ref;
    } else if ((ref as unknown[]).length === 2) {
      [owner, slot] = ref as [Scope, number];
    } else {
      Object.defineProperty(result, name, { get: () => (ref as unknown[])[0], set: () => {} });
      continue;
    }
    Object.defineProperty(result, name, {
      get: () => get(owner, slot),
      set: (value: unknown) => set(owner, slot, value),
    });
  }
  return result;
}

// Numbers loads across all memos, so a load is never numbered like an older one still in flight.
let loadCount = 0;

/** Marks a memo as loading. Its readers update the first time, so `$isPending` becomes true. */
function startLoading(scope: Scope, slot: number, key: string): void {
  if (!loadingSlots.has(key)) {
    loadingSlots.add(key);
    trigger(scope, slot);
  }
}

/**
 * Computes a memo of `$debounced` after its value stops changing for `ms`,
 * or one of `$throttled` at most once every `ms`, with the last value after
 * the wait. The memo is pending while it waits.
 */
export function timed(
  scope: Scope,
  slot: number,
  ms: number,
  throttle: boolean,
  compute: () => unknown,
): void {
  const key = `${scope.id}:${slot}`;
  const state = timers.get(key) ?? { last: -Infinity };
  timers.set(key, state);
  function recompute(): void {
    state.timer = undefined;
    state.last = Date.now();
    // A scope that left the page computes no more.
    if (scopes.get(scope.id) === scope) {
      memo(scope, slot, compute);
    }
  }
  const since = Date.now() - state.last;
  if (throttle && state.timer === undefined && since >= ms) {
    recompute();
    return;
  }
  if (!throttle) {
    clearTimeout(state.timer);
    state.timer = undefined;
  }
  state.timer ??= setTimeout(recompute, throttle ? ms - since : ms);
  startLoading(scope, slot, key);
}

/** True for a promise, or any object with a `then` method. */
export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}

/**
 * Writes the result of an async memo when it arrives. Until then the slot
 * keeps its value, and `pending` is true. Only the latest load is written.
 */
export function asyncMemo(scope: Scope, slot: number, promise: Promise<unknown>): void {
  const key = `${scope.id}:${slot}`;
  const load = ++loadCount;
  loads.set(key, load);
  startLoading(scope, slot, key);
  function settle(value?: unknown): void {
    if (loads.get(key) !== load) {
      return;
    }
    loadingSlots.delete(key);
    if (!Object.is(scope.s[slot], value)) {
      set(scope, slot, value);
    } else {
      trigger(scope, slot);
    }
  }
  function failed(error: unknown): void {
    // A newer load of the memo aborted this one, so only the latest load holds its error.
    if (loads.get(key) === load) {
      hold(scope, slot, key, error);
    }
  }
  promise.then((value) => {
    if (!isAsyncIterable(value)) {
      settle(value);
      return;
    }
    // A stream, such as a server function that yields: the memo takes each
    // value, and is pending until the first arrives. A newer load stops it.
    void (async () => {
      try {
        for await (const item of value) {
          if (loads.get(key) !== load) {
            break;
          }
          if (loadingSlots.has(key)) {
            settle(item);
          } else if (!Object.is(scope.s[slot], item)) {
            set(scope, slot, item);
          }
        }
      } catch (error) {
        failed(error);
      }
    })();
  }, failed);
}

/** Thrown when a memo reads a value that is still loading. */
class NotReady extends Error {
  readonly source: Promise<unknown>;

  constructor(source: Promise<unknown>) {
    super('The value is still loading');
    this.source = source;
  }
}

// More than 0 while a memo computes, so reading a value that is still loading stops it.
let computing = 0;

// More than 0 while an effect runs, so reading a value that is still loading skips the run.
let runningEffects = 0;

/**
 * `$resolve(memo, { timeout, signal })`: resolves with the value of the memo once it is no longer
 * pending, also after a load that its inputs started. `isLoading` tells whether the memo or a
 * memo that it reads loads, and `read` gives the value or throws the error of the memo.
 */
export function resolve(
  scope: Scope,
  isLoading: () => boolean,
  read: () => unknown,
  options?: { timeout?: number; signal?: AbortSignal },
): Promise<unknown> {
  return new Promise((done, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function end(finish: () => void): void {
      clearTimeout(timer);
      waiters.delete(check);
      options?.signal?.removeEventListener('abort', abort);
      finish();
    }
    function abort(): void {
      end(() => reject(options!.signal!.reason));
    }
    function check(): void {
      // The memo left the page with its component.
      if (scopes.get(scope.id) !== scope) {
        const gone = new Error('The component left the page');
        gone.name = 'AbortError';
        end(() => reject(gone));
        return;
      }
      // Writes that wait for the code of an update can start a load of the memo.
      if (loadingUpdates.size > 0) {
        void Promise.allSettled(loadingUpdates).then(check);
        return;
      }
      if (!draining) {
        for (const scope of dirty) {
          settle(scope);
        }
      }
      if (isLoading()) {
        return;
      }
      try {
        const value = read();
        end(() => done(value));
      } catch (error) {
        end(() => reject(error));
      }
    }
    if (options?.signal?.aborted) {
      abort();
      return;
    }
    options?.signal?.addEventListener('abort', abort);
    if (options?.timeout !== undefined) {
      timer = setTimeout(
        () => end(() => reject(new Error(`The value did not load in ${options.timeout} ms`))),
        options.timeout,
      );
    }
    waiters.set(check, scope);
    check();
  });
}

// The effects that skipped their run, by scope and name, so one run follows the value.
const skipped: Map<string, object> = new Map();

/** The key of the memo that computes, if any. */
let memoKey: string | undefined;

/** The signal for server function calls while a memo computes. It is made on the first call. */
export function memoSignal(): AbortSignal | undefined {
  if (memoKey === undefined) {
    return undefined;
  }
  let controller = memoControllers.get(memoKey);
  if (!controller) {
    controller = new AbortController();
    memoControllers.set(memoKey, controller);
  }
  return controller.signal;
}

/**
 * Computes a memo. A promise loads, and the memo keeps its value until it
 * settles. A memo that reads a value that is still loading keeps its value
 * too, and is pending until that value arrives and the memo computes again.
 * A throw is held as the value of the memo, and its readers throw.
 */
export function memo(scope: Scope, slot: number, compute: () => unknown): void {
  const key = `${scope.id}:${slot}`;
  // A guess stays while its source has not changed, such as when a value the server streamed arrives.
  if (guesses?.same(key)) {
    return;
  }
  const rendered = scope.s[slot];
  if (renderedLoads.delete(key) && isThenable(rendered)) {
    asyncMemo(scope, slot, Promise.resolve(rendered));
    return;
  }
  let value: unknown;
  let threw = false;
  // Server function calls of the last compute are aborted, because their answers are out of date.
  memoControllers.get(key)?.abort();
  memoControllers.delete(key);
  const outer = memoKey;
  memoKey = key;
  computing++;
  try {
    value = compute();
  } catch (error) {
    if (error instanceof NotReady) {
      startLoading(scope, slot, key);
      return;
    }
    threw = true;
    value = error;
  } finally {
    computing--;
    memoKey = outer;
  }
  // Held after the compute ends, since the write runs the readers.
  if (threw) {
    hold(scope, slot, key, value);
    return;
  }
  if (isThenable(value) || isAsyncIterable(value)) {
    asyncMemo(scope, slot, Promise.resolve(value));
    return;
  }
  // The values it read have arrived, so it is no longer pending.
  const waited = loadingSlots.delete(key);
  loads.delete(key);
  // An optimistic value that computes again follows its source, and drops its guess.
  guesses?.map.delete(key);
  if (!Object.is(scope.s[slot], value)) {
    set(scope, slot, value);
  } else if (waited) {
    trigger(scope, slot);
  }
}

/** True while a new value of a memo loads, or while the server still streams its value. */
export function pending(scope: Scope, slot: number): boolean {
  return (
    loadingSlots.has(`${scope.id}:${slot}`) ||
    (scope.s[slot] instanceof Promise && !scope.plain?.has(slot))
  );
}

/** True when a parent bound the prop of the slot with `$bind`. */
export function isBound(scope: Scope, slot: number): boolean {
  return scope.b?.[slot] !== undefined;
}

/** `x++`, `x--`, `++x` and `--x`. */
export function update(scope: Scope, slot: number, delta: number, prefix: boolean): number {
  const previous = get(scope, slot) as number;
  set(scope, slot, previous + delta);
  return prefix ? previous + delta : previous;
}

function trigger(scope: Scope, slot: number): void {
  for (const check of waiters.keys()) {
    check();
  }
  const id = findRoot(scope).m!;
  const children = childrenReady(scope);
  if (modules.has(id) && loadingCode.size === 0 && !children) {
    pass(() => queueWrite(scope, slot));
    return;
  }
  // The first write to a component loads its update code. Later writes wait in order, and for
  // the code of the page, which the updates can render and call. The writes of one pass that
  // wait, such as the props of a child, join its list and run as one pass, so a child computes once.
  // `waiting` is set only while a pass runs.
  if (waiting) {
    // Its code starts to load now, so the pass waits no longer than the first write.
    waiting.push([
      scope,
      slot,
      loadModule(id)
        .then(() => childrenReady(scope))
        .catch((error) => fail(scope, error)),
    ]);
    return;
  }
  const list: [Scope, number, Promise<unknown>?][] = [[scope, slot]];
  if (running > 0) {
    waiting = list;
  }
  const loading = loadModule(id)
    .then(async () => {
      const waits: unknown[] = [...loadingCode, children];
      for (const [, , load] of list) {
        waits.push(load);
      }
      await Promise.allSettled(waits);
      pass(() => {
        for (const [target, at] of list) {
          queueWrite(target, at);
        }
      });
    })
    .catch((error: unknown) => {
      // The write cannot run. Its effects do not wait for it any longer.
      fail(scope, error);
      flushEffects();
    });
  loadingUpdates.add(loading);
  void loading.finally(() => loadingUpdates.delete(loading));
}

/** The writes of the pass that runs that wait for code, to run as one pass of their own. */
let waiting: [Scope, number, Promise<unknown>?][] | undefined;

/** The updates that wait for their code. */
const loadingUpdates = new Set<Promise<unknown>>();

/**
 * Resolves when the updates of the writes so far have run, including those
 * whose code is loading. `transition` of `brumate/events` waits for it.
 */
export async function updated(): Promise<void> {
  while (loadingUpdates.size > 0) {
    // oxlint-disable-next-line no-await-in-loop -- An update can start more loads.
    await Promise.allSettled(loadingUpdates);
  }
}

(globalThis as { [key: symbol]: unknown })[Symbol.for('brumate.updated')] = updated;

// Effects wait until every other update of a write has run, and run once each.
export const pendingEffects: Map<string, () => void> = new Map();

/**
 * The updates that wait in the pass at one depth of scopes, so each runs once.
 * A memo has its rank, the number in its name: memos are numbered in the
 * order they are declared, after the memos they read.
 */
interface Level {
  /** The memos, in buckets by rank. */
  m: Map<string, () => void>[];
  /** The bindings. */
  b: Map<string, () => void>;
  /** The effects. */
  e: Map<string, () => void>;
}

let levels: Level[] = [];

let running = 0;

let flushing = false;

/** The updates that ran since the outermost pass started, and when it started, for the devtools. */
let updateCount = 0;

let updateStart = 0;

/**
 * Runs a pass: `write` queues updates. The outermost pass runs them by the
 * depth of their scope, so the bindings of a component, such as its props
 * and contexts, reach the components inside before their memos compute. At
 * each depth, the memos in the order of their ranks, then the bindings as
 * one round. Effects run after them, the deepest first, so the effects of
 * a child run before those of its parent.
 */
export function pass<T>(write: () => T): T {
  if (DEV && running === 0) {
    updateCount = 0;
    updateStart = performance.now();
  }
  // Effects run after the pass, so an error of one stops the effects after it until a pass starts.
  if (running++ === 0) {
    failed = false;
  }
  let result!: T;
  let held = false;
  try {
    result = write();
  } finally {
    // The writes of a handler that throws still reach the page.
    if (running === 1) {
      drain();
    }
    if (--running === 0) {
      // The deepest effects first. An effect that waits already keeps its place.
      // oxlint-disable-next-line unicorn/no-array-reverse -- The levels are dropped right after.
      for (const level of levels.reverse()) {
        for (const [key, runEffect] of level?.e ?? []) {
          pendingEffects.set(key, runEffect);
        }
      }
      levels = [];
      // Writes that wait for code run as a pass of their own, and the effects wait for it.
      held = waiting !== undefined;
      waiting = undefined;
      depths.clear();
      failed = false;
      stuck = false;
      dirty.clear();
    }
  }
  if (running === 0) {
    if (!held) {
      flushEffects();
    }
    if (DEV) {
      devtools()?.updated?.(updateCount, updateStart, performance.now());
    }
  }
  return result;
}

setPass(pass);

// The scopes with memos that wait in the pass, so a read computes the ones of its scope.
const dirty: Set<Scope> = new Set();

/** Computes the memos of a scope that wait, so code that reads one in a handler reads the new value. */
function settle(scope: Scope): void {
  // A memo that reads another memo of the scope settles it through `get`, so the order here does not matter.
  if (dirty.delete(scope)) {
    for (const [rank, bucket] of (levels[getDepth(scope)]?.m ?? []).entries()) {
      const key = `${scope.id}:m${rank}`;
      const compute = bucket?.get(key);
      bucket?.delete(key);
      compute?.();
    }
  }
}

// True while `drain` runs.
let draining = false;

/**
 * Runs the memos and bindings that wait in the pass at once, such as for a handler that must focus
 * or measure what it rendered. Effects still wait for the end of the pass.
 */
export function flush(): void {
  if (running > 0 && !draining) {
    drain();
  }
}

(globalThis as { [key: symbol]: unknown })[Symbol.for('brumate.flush')] = flush;

/**
 * Queues the updates that read a slot, on the scope and on its descendants of
 * each kind, once the code of the component has loaded.
 */
function queueWrite(scope: Scope, slot: number): void {
  const id = findRoot(scope).m!;
  const module = modules.get(id);
  if (!module) {
    return;
  }
  for (const [kind, name] of module.g[scope.k]?.[slot] ?? []) {
    for (const target of kind === scope.k ? [scope] : descendants(scope, kind)) {
      queue((module as unknown as Record<string, (scope: Scope) => void>)[name]!, name, target);
    }
  }
}

/** Queues an update of a scope, once. */
function queue(fn: (scope: Scope) => void, name: string, target: Scope): void {
  if (DEV) {
    updateCount++;
  }
  const key = `${target.id}:${name}`;
  // An update of a scope that left the page in the pass does not run. An error goes to the
  // nearest `#try` around the update, whether its write ran at once or waited for code.
  function later(): void {
    if (!failed && scopes.get(target.id) === target) {
      try {
        // Past the limit of rounds, the next update fails in place of running.
        if (stuck) {
          // The rest of the pass does not run.
          failed = true;
          throw new Error(
            DEV
              ? 'The updates of a write did not settle after 10000 rounds. An update writes a value that it reads, such as through ref=$bind.'
              : 'Update loop',
          );
        }
        updating(() => fn(target));
      } catch (error) {
        fail(target, error);
      }
    }
  }
  const depth = getDepth(target);
  const level = (levels[depth] ??= { m: [], b: new Map(), e: new Map() });
  if (name[0] === 'm') {
    (level.m[+name.slice(1)] ??= new Map()).set(key, later);
    dirty.add(target);
  } else {
    (name[0] === 'e' ? level.e : level.b).set(key, later);
  }
}

/**
 * The depth of a scope: one more than the deeper of the scope where it renders, for children
 * and templates that another component inserts, and of its parent. So children that a provider
 * inserts come after the provider, and a template that a shallower component renders comes after
 * the component that wrote it.
 */
function getDepth(scope: Scope | undefined): number {
  if (!scope) {
    return -1;
  }
  if (!scope.t) {
    return 1 + getDepth(scope.p ?? scope.o);
  }
  // Kept for the pass, since the scope where it renders and its parent can reach the same scope.
  let depth = depths.get(scope);
  if (depth === undefined) {
    depth = 1 + Math.max(getDepth(scope.t), getDepth(scope.p ?? scope.o));
    depths.set(scope, depth);
  }
  return depth;
}

// The depths of the scopes of the pass.
const depths: Map<Scope, number> = new Map();

// True once the pass was stopped for running too many rounds.
let failed = false;

// True once the pass ran 10000 rounds of bindings, for updates that keep writing what they read.
let stuck = false;

/**
 * Runs what waits, the lowest depth first: its memo of the lowest rank, until
 * none waits, then its bindings as one round. After each, it looks again from
 * the top, since a write can queue updates of a lower depth, such as a `$bind`
 * write into a parent.
 */
function drain(): void {
  let rounds = 0;
  let depth = 0;
  draining = true;
  try {
    while (depth < levels.length) {
      const level = levels[depth];
      if (!level) {
        depth++;
        continue;
      }
      // The bucket of the lowest rank. Each runs whole, so the scan is short.
      const memos = level.m;
      let rank = 0;
      while (rank < memos.length && !memos[rank]?.size) {
        rank++;
      }
      const bucket = memos[rank];
      if (bucket) {
        // The whole bucket runs in one loop, with the memos that join it while it runs. A memo that
        // queues a lower rank or a lower depth, such as of a template that a shallower component
        // renders, runs after the bucket, since the scan starts again.
        for (const [key, compute] of bucket) {
          bucket.delete(key);
          compute();
        }
      } else if (level.b.size > 0) {
        stuck = ++rounds > 10_000;
        const round = [...level.b.values()];
        level.b.clear();
        for (const waiter of round) {
          waiter();
        }
      } else {
        depth++;
        continue;
      }
      depth = 0;
    }
  } finally {
    draining = false;
  }
}

/**
 * Runs the effects that writes scheduled, in the order they were first
 * scheduled. Writes in an effect schedule more effects, which run after.
 */
function flushEffects(): void {
  if (flushing) {
    return;
  }
  flushing = true;
  try {
    // The effects that wait run as one pass, so their writes update the page once. A pass that
    // they start puts the effects it schedules back, and they run next.
    while (pendingEffects.size > 0) {
      const run = [...pendingEffects.values()];
      pendingEffects.clear();
      pass(() => {
        for (const runEffect of run) {
          runEffect();
        }
      });
    }
  } finally {
    flushing = false;
  }
}

/**
 * Runs an effect, or a `$client` callback when `client` is set, after the cleanup of its previous
 * run. An effect that reads a value that is still loading skips the run, and runs again when the
 * value arrives. A `$client` callback is a handler: the same read throws.
 */
export function effect(
  scope: Scope,
  name: string,
  callback: () => unknown,
  client?: boolean,
): void {
  // In a hidden `#offscreen` body, it runs when the body shows.
  if (hiding?.paused(scope, name)) {
    return;
  }
  const key = `${scope.id}:${name}`;
  skipped.delete(key);
  scope.cleanups ??= new Map();
  scope.cleanups.get(name)?.();
  let cleanup: unknown;
  const start = DEV ? performance.now() : 0;
  if (!client) {
    runningEffects++;
  }
  try {
    cleanup = callback();
  } catch (error) {
    if (error instanceof NotReady) {
      // The run is skipped. It runs again when the value arrives, unless a change ran it first.
      const token = {};
      skipped.set(key, token);
      scope.cleanups.set(name, noop);
      function again(): void {
        if (skipped.get(key) === token && scopes.get(scope.id) === scope) {
          effect(scope, name, callback);
        }
      }
      // After the writes that the value starts, which can run the effect themselves.
      void error.source.then(
        () => Promise.allSettled(loadingUpdates).then(again),
        // The error reaches the nearest `#try`.
        (reason: unknown) => {
          if (skipped.get(key) === token) {
            skipped.delete(key);
            fail(scope, reason);
          }
        },
      );
      return;
    }
    // The error goes to the nearest `#try` around the effect. The effect runs again on the next change.
    fail(scope, error);
  } finally {
    if (!client) {
      runningEffects--;
    }
  }
  // An entry without a cleanup too, so a hidden `#offscreen` body knows what to run again.
  let stored = typeof cleanup === 'function' ? (cleanup as () => void) : noop;
  if (DEV) {
    devtools()?.effect?.(scope, name, 'run', performance.now() - start);
    // Each way that a cleanup runs calls this function: the next run, a removed scope, a hidden
    // `#offscreen` body, or a page that navigation leaves.
    const own = stored;
    stored = () => {
      devtools()?.effect?.(scope, name, 'cleanup', 0);
      own();
    };
  }
  scope.cleanups.set(name, stored);
}

export function noop(): void {}
