// Contexts that components provide and read, and the values that the runtime provides to the
// whole page.

import { HAS_ROUTES, HAS_STORES } from '../features.ts';
import { CONTEXT_ADDED, ROUTE_KEY } from '../context.ts';
import type { Context as ContextValue, Route } from '../context.ts';
import { madeStores } from '../shared.ts';
import type { ScopeId, StoreRead } from '../shared.ts';
import { Store, findStored, isContext, sendStore } from '../store.ts';
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
  if (DEV && context.key in target.v && !Object.is(target.v[context.key], value)) {
    warnChanged(context.key);
  }
  target.v[context.key] = value;
}

/** The contexts whose provided value changed, which development logged once. */
const changedContexts = new Set<string>();

/** Logs once per context: a context value is read once, so readers keep the first value. */
function warnChanged(key: string): void {
  if (!changedContexts.has(key)) {
    changedContexts.add(key);
    console.warn(
      `The value of context "${key}" changed, but a context value is read once, so its readers keep the first. Put a value that changes in a store with $toStore`,
    );
  }
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
const waitingReads = new Map<string, [Scope, StoreRead][]>();

/** The contexts that the modules of the page made, by key, for the stores of their default values. */
const madeContexts = new Map<string, ContextValue<unknown>>();

if (HAS_STORES) {
  (globalThis as { [key: symbol]: unknown })[CONTEXT_ADDED] = (context: ContextValue<unknown>) => {
    madeContexts.set(context.key, context);
    const reads = waitingReads.get(context.key);
    if (reads) {
      waitingReads.delete(context.key);
      pass(() => {
        for (const [scope, read] of reads) {
          // A scope that went before the module ran reads nothing.
          if (scopes.get(scope.id) === scope) {
            linkRead(scope, read);
          }
        }
      });
    }
  };
}

/** The store that a read finds from `scope` by the key of its context, or undefined while its module loads. */
function findStore(scope: Scope, read: StoreRead): StoreLike<unknown> | undefined {
  const [key, , path, write] = read as [string, number, string | undefined, 1 | undefined];
  const provider = findProvider(scope, key);
  if (!provider && !madeContexts.has(key)) {
    return undefined;
  }
  return findStored(madeContexts.get(key) ?? { key, defaultValue: undefined }, path, !!write, () =>
    provider ? provider.v![key] : madeContexts.get(key)!.defaultValue,
  );
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
  const stop = found.subscribe((value) => {
    sendContext(() => writeSlot(scope, slot, value));
  });
  (scope.stops ??= []).push(stop);
  if (write) {
    (scope.b ??= {})[slot] = (value: unknown) => found.set!(value);
  }
  if (repair && !Object.is(found.get(), scope.s[slot])) {
    sendContext(() => writeSlot(scope, slot, found.get()));
  }
}

/** Links a read of `$store` that a scope resumed with, now or once the module of its context runs. */
function linkRead(scope: Scope, read: StoreRead): void {
  const found = findStore(scope, read);
  if (found) {
    subscribeSlot(scope, read[1], found, true, read[3]);
    return;
  }
  const reads = waitingReads.get(read[0] as string) ?? [];
  reads.push([scope, read]);
  waitingReads.set(read[0] as string, reads);
}

/**
 * Subscribes the reads of `$store` of scopes that the page state added, and writes the value of
 * each store that changed since the server render, in one pass. A store of an import is found
 * in the exports `z` of the component, once its code has loaded.
 */
export function resumeStoreReads(
  added: Scope[],
  reads: (scope: Scope) => StoreRead[] | undefined,
): void {
  pass(() => {
    for (const scope of added) {
      for (const read of reads(scope) ?? []) {
        if (typeof read[0] === 'string') {
          linkRead(scope, read);
          continue;
        }
        const [link, slot, path, write] = read;
        void loadModule(findRoot(scope).m!).then((module) => {
          if (scopes.get(scope.id) === scope) {
            pass(() => {
              const found = findStored(module.z![link], path, !!write, () => undefined);
              subscribeSlot(scope, slot, found, true, write);
            });
          }
        });
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

/** `$store(source)` in a component that the browser renders: the value, with its slot subscribed. */
export function consumeStore<T>(
  source: unknown,
  scope: Scope | ScopeId,
  slot: number,
  path?: string,
  _link?: number,
  write?: boolean,
): T {
  const target = resolveScope(scope)!;
  if (isContext(source)) {
    madeContexts.set(source.key, source);
  }
  const found = findStored(source, path, write, (context) => {
    const provider = findProvider(target, context.key);
    return provider ? provider.v![context.key] : context.defaultValue;
  });
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
