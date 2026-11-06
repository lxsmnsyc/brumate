// Contexts that components provide and read, and the values that the runtime provides to the
// whole page.

import { HAS_BRIDGES, HAS_ROUTES } from '../features.ts';
import { NAVIGATION_KEY, ROUTE_KEY, missingContext } from '../context.ts';
import type { Context as ContextValue, Route } from '../context.ts';
import { madeStores } from '../shared.ts';
import type { ScopeId, StoreRead } from '../shared.ts';
import { Store, findStored, isBridged, sameData, sendStore } from '../store.ts';
import type { StoreLike } from '../store.ts';
import { loadModule } from './code.ts';
import { findRoot, resolveScope } from './scopes.ts';
import { DEV, scopes } from './state.ts';
import type { Scope } from './state.ts';
import { pass, sendContext, set, writeSlot } from './updates.ts';

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

/** Provides a value of a context to the scopes inside `scope`. */
export function provideValue<T>(context: ContextValue<T>, value: T, scope: Scope | ScopeId): void {
  const target = resolveScope(scope)!;
  target.v ??= {};
  target.v[context.key] = value;
}

/**
 * Reads a context. With a fallback, a read without a provider gives the fallback, or what it
 * returns when it is a function, in place of the error. With `slot`, which only `$route()` and
 * `$navigation()` pass, it records the slot so that `setGlobal` can write it. A provided value is
 * read once.
 */
export function consumeContext<T>(
  context: ContextValue<T>,
  scope: Scope | ScopeId,
  ...rest: [fallback?: unknown, slot?: number]
): T {
  const [fallback, slot] = rest;
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
  if (HAS_ROUTES && context.key === NAVIGATION_KEY && !globals.has(NAVIGATION_KEY)) {
    globals.set(NAVIGATION_KEY, { pending: false });
  }
  if (globals.has(context.key)) {
    return globals.get(context.key) as T;
  }
  // Only `$getContext(C, fallback)` passes one argument after the scope: `$route()` and
  // `$navigation()` pass the slot after an empty fallback, and still throw without a provider.
  if (rest.length !== 1) {
    throw missingContext(context.key);
  }
  return (typeof fallback === 'function' ? fallback() : fallback) as T;
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

/** The store that a read finds from `scope` by the key of its context. */
function findStore(scope: Scope, read: StoreRead): StoreLike<unknown> {
  const [key, , path, write] = read as [string, number, string | undefined, 1 | undefined];
  const provider = findProvider(scope, key);
  if (!provider) {
    throw missingContext(key);
  }
  return findStored(provider.v![key], path, !!write, key);
}

/**
 * Subscribes a slot to a store, so a new value of the store writes the slot through the queued
 * send of contexts. With `write`, a write of the slot calls `set` of the store. With `repair`, a
 * value that changed since the server render is written now. The scope stops reading when it goes.
 */
function subscribeSlot(
  scope: Scope,
  slot: number,
  found: StoreLike<unknown>,
  repair: boolean,
  write?: unknown,
): void {
  const listener = (value: unknown): void => {
    sendContext(() => writeSlot(scope, slot, value));
  };
  // A bridged store repairs the slot itself, against what the server sent, since its source
  // starts at the first subscriber.
  let bridged = false;
  let stop: () => void;
  if (HAS_BRIDGES && repair && isBridged(found)) {
    bridged = true;
    stop = found.subscribe(listener, scope.s[slot]);
  } else {
    stop = found.subscribe(listener);
  }
  (scope.stops ??= []).push(stop);
  if (write) {
    (scope.b ??= {})[slot] = (value: unknown) => found.set!(value);
  }
  if (repair && !bridged && !sameData(found.get(), scope.s[slot])) {
    sendContext(() => writeSlot(scope, slot, found.get()));
  }
}

/** Links a read of `$store` that a scope resumed with. */
function linkRead(scope: Scope, read: StoreRead): void {
  subscribeSlot(scope, read[1], findStore(scope, read), true, read[3]);
}

/**
 * Subscribes the reads of `$store` of scopes that the page state added, and writes the value of
 * each store that changed since the server render, in one pass. A store that is not in a context
 * comes from its source in the exports `z` of the component, which runs once its code has loaded,
 * with the resumed values of the scope. Resume never calls `set`.
 */
export function resumeStoreReads(
  added: Scope[],
  reads: (scope: Scope) => StoreRead[] | undefined,
): void {
  pass(() => {
    for (const scope of added) {
      const sourced: StoreRead[] = [];
      for (const read of reads(scope) ?? []) {
        if (typeof read[0] === 'string') {
          linkRead(scope, read);
        } else {
          sourced.push(read);
        }
      }
      if (sourced.length === 0) {
        continue;
      }
      // The sources of a scope run in one pass, so a repair of two slots updates once.
      void loadModule(findRoot(scope).m!).then((module) => {
        if (scopes.get(scope.id) !== scope) {
          return;
        }
        pass(() => {
          for (const [link, slot, path, write] of sourced) {
            const found = findStored(module.z![link as number]!(scope), path, !!write);
            subscribeSlot(scope, slot, found, true, write);
          }
        });
      });
    }
  });
}

/** Links the stores of providers that the page state made to their scopes. See `madeStores`. */
export function linkMadeStores(): void {
  for (const made of madeStores) {
    const [id, site, slot] = made.o!;
    const scope = scopes.get(id);
    if (!scope) {
      if (DEV) {
        console.warn(
          `A store of the page state has no scope ${id} to belong to, so it is not linked`,
        );
      }
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

/**
 * `$store(source)` in a component that the browser renders: the value, with its slot subscribed.
 * With no `link`, or with a `fallback`, the source is a context, whose provider gives the store, or
 * the fallback when none is above.
 */
export function consumeStore<T>(
  source: unknown,
  scope: Scope | ScopeId,
  slot: number,
  path?: string,
  link?: number,
  write?: boolean,
  fallback?: () => unknown,
): T {
  const target = resolveScope(scope)!;
  let value = source;
  let key: string | undefined;
  if (link === undefined || fallback) {
    key = (source as ContextValue<unknown>).key;
    const provider = findProvider(target, key);
    if (provider) {
      value = provider.v![key];
    } else if (fallback) {
      value = fallback();
    } else {
      throw missingContext(key);
    }
  }
  const found = findStored(value, path, write, key);
  if (slot >= 0) {
    subscribeSlot(target, slot, found, false, write);
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
    sendStore(found, value, true);
  }
}
