// Contexts that components provide and read, and the values that the runtime provides to the
// whole page.

import { HAS_ROUTES, HAS_STORES } from '../features.ts';
import { CONTEXT_ADDED, ROUTE_KEY } from '../context.ts';
import type { Context as ContextValue, Route } from '../context.ts';
import { madeStores } from '../shared.ts';
import type { ScopeId, StoreRead } from '../shared.ts';
import { Store, isStore, sendStore } from '../store.ts';
import { resolveScope } from './scopes.ts';
import { scopes } from './state.ts';
import type { Scope } from './state.ts';
import { pass, sendContext, set } from './updates.ts';

/** The scope that provides a context to `scope`: itself or the nearest one above it. */
function findProvider(scope: Scope, key: string): Scope | undefined {
  // A scope reads the contexts of the scopes above it, not its own, so a component can read a
  // context and provide it again to the scopes inside it. Children that a component inserted
  // find their contexts where they are, through `t`.
  for (
    let current: Scope | undefined = scope.t ?? scope.p ?? scope.o;
    current;
    current = current.t ?? current.p ?? current.o
  ) {
    if (current.v && key in current.v) {
      return current;
    }
  }
  return undefined;
}

/**
 * Writes a provided value, and the slot of every scope that reads it from this provider. The
 * provider can read the same context from above, which this does not write.
 */
export function updateContext(scope: Scope, context: ContextValue<unknown>, value: unknown): void {
  scope.v ??= {};
  scope.v[context.key] = value;
  sendContext(() => {
    for (const target of scopes.values()) {
      const slot = target.x?.[context.key];
      if (slot !== undefined && findProvider(target, context.key) === scope) {
        set(target, slot, value);
      }
    }
  });
}

/** Provides a value of a context to the scopes inside `scope`. */
export function provideValue<T>(context: ContextValue<T>, value: T, scope: Scope | ScopeId): void {
  const target = resolveScope(scope)!;
  target.v ??= {};
  target.v[context.key] = value;
}

/** Reads a context, and records its slot so that changes to the provided value reach it. */
export function consumeContext<T>(
  context: ContextValue<T>,
  scope: Scope | ScopeId,
  slot?: number,
): T {
  const target = resolveScope(scope)!;
  if (slot !== undefined) {
    target.x ??= {};
    target.x[context.key] = slot;
  }
  const provider = findProvider(target, context.key);
  if (provider) {
    return provider.v![context.key] as T;
  }
  if (HAS_ROUTES && context.key === ROUTE_KEY && !globals.has(ROUTE_KEY)) {
    globals.set(ROUTE_KEY, currentRoute());
  }
  return (globals.has(context.key) ? globals.get(context.key) : context.defaultValue) as T;
}

/** The values of the contexts that the runtime provides to the whole page, by key. */
const globals = new Map<string, unknown>();

/** The route of the page: `location`, and the params of the route from the last page state. */
function currentRoute(): Route {
  const records = document.querySelectorAll('script[b-state][b-params]');
  const params = records[records.length - 1]?.getAttribute('b-params');
  const url = new URL(location.href);
  return { url, search: url.searchParams, params: params ? JSON.parse(params) : {} };
}

/**
 * Writes a context that the runtime provides to the whole page, and the
 * slot of every scope that reads it without a provider above it.
 */
export function setGlobal(key: string, value: unknown): void {
  globals.set(key, value);
  for (const target of scopes.values()) {
    const slot = target.x?.[key];
    if (slot !== undefined && !findProvider(target, key)) {
      set(target, slot, value);
    }
  }
}

/** Reads the route of the page again, after navigation changed it. */
export function updateRoute(): void {
  setGlobal(ROUTE_KEY, currentRoute());
}

// Stores in contexts: `$toStore` in a provided value, and `$store` in a reader.

/** The reads of `$store` whose context has no provider and whose module has not run yet, by key. */
const waitingReads = new Map<string, [Scope, number, string | undefined][]>();

/** The contexts that the modules of the page made, by key, for the stores of their default values. */
const madeContexts = new Map<string, ContextValue<unknown>>();

if (HAS_STORES) {
  (globalThis as { [key: symbol]: unknown })[CONTEXT_ADDED] = (context: ContextValue<unknown>) => {
    madeContexts.set(context.key, context);
    const reads = waitingReads.get(context.key);
    if (reads) {
      waitingReads.delete(context.key);
      pass(() => {
        for (const [scope, slot, path] of reads) {
          linkRead(scope, context.key, slot, path, true);
        }
      });
    }
  };
}

/** The store that a read of `$store` finds from `scope`, or undefined while its module loads. */
function findStore(
  scope: Scope,
  key: string,
  path: string | undefined,
): Store<unknown> | undefined {
  const provider = findProvider(scope, key);
  let value: unknown;
  if (provider) {
    value = provider.v![key];
  } else if (madeContexts.has(key)) {
    value = madeContexts.get(key)!.defaultValue;
  } else {
    return undefined;
  }
  const found = path === undefined ? value : (value as Record<string, unknown>)?.[path];
  if (!isStore(found)) {
    throw new Error(`$store reads the context "${key}", which holds no store of brumate/store`);
  }
  return found;
}

/**
 * Subscribes a slot to a store, so a new value of the store writes the slot through the queued
 * send of contexts. With `repair`, a value that changed since the server render is written now.
 */
function subscribeSlot(scope: Scope, slot: number, found: Store<unknown>, repair: boolean): void {
  const stop = found.subscribe((value) => {
    // A reader that left the page stops reading. Its cleanups would also run while an
    // `#offscreen` body hides, which must keep reading.
    if (scopes.get(scope.id) !== scope) {
      stop();
      return;
    }
    sendContext(() => set(scope, slot, value));
  });
  if (repair && !Object.is(found.get(), scope.s[slot])) {
    sendContext(() => set(scope, slot, found.get()));
  }
}

/** Links a read of `$store` that a scope resumed with, now or once the module of its context runs. */
function linkRead(
  scope: Scope,
  key: string,
  slot: number,
  path: string | undefined,
  repair: boolean,
): void {
  const found = findStore(scope, key, path);
  if (found) {
    subscribeSlot(scope, slot, found, repair);
    return;
  }
  const reads = waitingReads.get(key) ?? [];
  reads.push([scope, slot, path]);
  waitingReads.set(key, reads);
}

/**
 * Subscribes the reads of `$store` of scopes that the page state added, and writes the value of
 * each store that changed since the server render, in one pass.
 */
export function resumeStoreReads(
  added: Scope[],
  reads: (scope: Scope) => StoreRead[] | undefined,
): void {
  pass(() => {
    for (const scope of added) {
      for (const [key, slot, path] of reads(scope) ?? []) {
        linkRead(scope, key, slot, path, true);
      }
    }
  });
}

/** Links the stores of providers that the page state made to their scopes. See `madeStores`. */
export function linkMadeStores(): void {
  for (const made of madeStores) {
    const [id, site, slot] = made.o!;
    const scope = scopes.get(id);
    if (!scope) {
      continue;
    }
    (scope.st ??= {})[site] = made;
    if (slot === undefined) {
      made.r = true;
    } else {
      made.w = (value) => set(scope, slot, value);
    }
  }
  madeStores.length = 0;
}

/** `$store(context)` in a component that the browser renders: the value, with its slot subscribed. */
export function consumeStore<T>(
  context: ContextValue<unknown>,
  scope: Scope | ScopeId,
  slot: number,
  path?: string,
): T {
  const target = resolveScope(scope)!;
  madeContexts.set(context.key, context);
  const found = findStore(target, context.key, path)!;
  if (slot >= 0) {
    subscribeSlot(target, slot, found, false);
  }
  return found.get() as T;
}

/** `$toStore(value)` in a provided value of a component that the browser renders. */
export function toStore<T>(
  value: T,
  scope: Scope | ScopeId,
  site: number,
  slot?: number,
): Store<T> {
  const target = resolveScope(scope)!;
  const made = new Store(value);
  (target.st ??= {})[site] = made as Store<unknown>;
  if (slot === undefined) {
    made.r = true;
  } else {
    made.w = (next) => set(target, slot, next);
  }
  return made;
}

/** The update of `$toStore(value)`, in the binding stage: sends the new value to the readers. */
export function storeUpdate(scope: Scope, site: number, value: unknown): void {
  const found = scope.st?.[site];
  if (found) {
    sendStore(found, value);
  }
}
