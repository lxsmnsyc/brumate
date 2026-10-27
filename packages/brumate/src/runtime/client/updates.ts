// Slots and what reads them: reads and writes of a slot, memos, effects, and the updates that a
// write runs.

import { HAS_BINDINGS } from '../features.ts';
import {
  Binding,
  ElementReference,
  FunctionReference,
  SlotReference,
  isAsyncIterable,
  isBinding,
  isSlotReference,
} from '../shared.ts';
import type { ScopeId } from '../shared.ts';
import { findElement } from './blocks.ts';
import { childrenReady } from './children.ts';
import { loadModule, loadPart, loadingCode } from './code.ts';
import { fail } from './errors.ts';
import { call } from './references.ts';
import { afterInsert, descendants, rootOf, treeChanges } from './scopes.ts';
import {
  DEV,
  devtools,
  guesses,
  hiding,
  loadedParts,
  loadingSlots,
  loads,
  memoControllers,
  modules,
  renderedLoads,
  scopes,
  timers,
} from './state.ts';
import type { ClientModule, Part, Scope } from './state.ts';

// Slots

// oxlint-disable-next-line typescript/no-explicit-any -- Slots hold any value.
export function get(scope: Scope, slot: number): any {
  const value = scope.s[slot];
  // A value that the server still streams. A memo that reads it waits for it.
  if (computing > 0 && value instanceof Promise) {
    throw new NotReady(value);
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
 * and the parent's update of the prop writes the value that it keeps.
 */
export function set<T>(scope: Scope, slot: number, value: T): T {
  const bound = scope.b?.[slot];
  if (bound === undefined || isSlotReference(bound)) {
    writeSlot(scope, slot, value);
    const target = bound && scopes.get(bound.scope);
    if (target) {
      set(target, bound.slot, value);
    }
  } else if (bound instanceof FunctionReference) {
    void call(bound.ref, scopes.get(bound.scope), [...(bound.args ?? []), value]);
  } else if (typeof bound === 'function') {
    void bound(value);
  }
  return value;
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
  names.forEach((name, index) => {
    const ref = links[index];
    let owner = scope;
    let slot: number;
    if (typeof ref === 'number') {
      slot = ref;
    } else if ((ref as unknown[]).length === 2) {
      [owner, slot] = ref as [Scope, number];
    } else {
      Object.defineProperty(result, name, { get: () => (ref as unknown[])[0], set: () => {} });
      return;
    }
    Object.defineProperty(result, name, {
      get: () => get(owner, slot),
      set: (value: unknown) => set(owner, slot, value),
    });
  });
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
  const recompute = (): void => {
    state.timer = undefined;
    state.last = Date.now();
    // A scope that left the page computes no more.
    if (scopes.get(scope.id) === scope) {
      memo(scope, slot, compute);
    }
  };
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
  const settle = (value?: unknown, failed = false): void => {
    if (loads.get(key) !== load) {
      return;
    }
    loadingSlots.delete(key);
    if (!failed && !Object.is(scope.s[slot], value)) {
      set(scope, slot, value);
    } else {
      trigger(scope, slot);
    }
  };
  const failed = (error: unknown): void => {
    // A newer load of the memo aborted this one. The memo keeps its value, and the error goes
    // to the nearest `#try` around the memo.
    if (loads.get(key) === load) {
      fail(scope, error);
      settle(undefined, true);
    }
  };
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
  // Server function calls of the last compute are aborted, because their answers are out of date.
  memoControllers.get(key)?.abort();
  memoControllers.delete(key);
  const outer = memoKey;
  memoKey = key;
  computing++;
  try {
    value = compute();
  } catch (error) {
    if (!(error instanceof NotReady)) {
      throw error;
    }
    startLoading(scope, slot, key);
    return;
  } finally {
    computing--;
    memoKey = outer;
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
  return loadingSlots.has(`${scope.id}:${slot}`) || scope.s[slot] instanceof Promise;
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
  const id = rootOf(scope).m!;
  const module = modules.get(id);
  const updates = loadedParts.get(`${id}:update`);
  const children = childrenReady(scope);
  if (module && updates && loadingCode.size === 0 && !children) {
    run(module, updates, scope, slot);
    return;
  }
  // The first write to a component loads its update code. Later writes wait in order, and
  // for the code of the page, which the updates can render and call.
  const loading = loadModule(id).then(async (loaded) => {
    if (loaded.g[scope.k]?.[slot]) {
      const code = await loadPart(loaded, 'update');
      await Promise.allSettled([...loadingCode, children]);
      run(loaded, code, scope, slot);
    }
  });
  loadingUpdates.add(loading);
  void loading.finally(() => loadingUpdates.delete(loading));
}

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

let running = 0;

let flushing = false;

/** The updates that ran since the outermost `run` started, and when it started, for the devtools. */
let updateCount = 0;

let updateStart = 0;

function run(module: ClientModule, updates: Part, scope: Scope, slot: number): void {
  if (DEV && running === 0) {
    updateCount = 0;
    updateStart = performance.now();
  }
  running++;
  // The descendants of each kind, found once while the tree does not change.
  let found: Map<number, Scope[]> | undefined;
  let foundAt = treeChanges;
  try {
    for (const [kind, name] of module.g[scope.k]?.[slot] ?? []) {
      const fn = updates[name] as (scope: Scope) => void;
      if (kind === scope.k) {
        runUpdate(fn, name, scope);
        continue;
      }
      if (foundAt !== treeChanges) {
        found = undefined;
        foundAt = treeChanges;
      }
      found ??= new Map();
      let targets = found.get(kind);
      if (!targets) {
        targets = descendants(scope, kind);
        found.set(kind, targets);
      }
      for (const target of targets) {
        runUpdate(fn, name, target);
      }
    }
  } finally {
    running--;
  }
  if (running === 0) {
    flushEffects();
    if (DEV) {
      devtools()?.updated?.(updateCount, updateStart, performance.now());
    }
  }
}

/** Runs an update on a scope. An effect waits until the other updates have run. */
function runUpdate(fn: (scope: Scope) => void, name: string, target: Scope): void {
  if (DEV) {
    updateCount++;
  }
  if (name[0] === 'e') {
    pendingEffects.set(`${target.id}:${name}`, () => {
      if (scopes.has(target.id)) {
        fn(target);
      }
    });
  } else {
    fn(target);
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
    // A map iterator also visits entries that are added while it runs.
    for (const [key, runEffect] of pendingEffects) {
      pendingEffects.delete(key);
      runEffect();
    }
  } finally {
    flushing = false;
  }
}

/** Runs an effect or a `$client` callback, after the cleanup of its previous run. */
export function effect(scope: Scope, name: string, callback: () => unknown): void {
  // In a hidden `#offscreen` body, it runs when the body shows.
  if (hiding?.paused(scope, name)) {
    return;
  }
  scope.cleanups ??= new Map();
  scope.cleanups.get(name)?.();
  let cleanup: unknown;
  const start = DEV ? performance.now() : 0;
  try {
    cleanup = callback();
  } catch (error) {
    // The error goes to the nearest `#try` around the effect. The effect runs again on the next change.
    fail(scope, error);
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
