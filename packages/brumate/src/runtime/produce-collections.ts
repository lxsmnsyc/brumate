import type { DraftChild, DraftState } from './produce.ts';

/** What the collections need from `produce.ts`, passed in so the two files do not import each other. */
export interface Host {
  draft: symbol;
  createDraftOf(base: object, parent: DraftState | undefined): DraftChild;
  finalize(state: DraftState): unknown;
  getDraftState(value: unknown): DraftState | undefined;
  isDraftable(value: unknown): value is object;
  prepare(state: DraftState): object;
}

/** Set by the first draft of a collection. */
let host = null as unknown as Host;

type Collection = Map<unknown, unknown> | Set<unknown>;

function latest(state: DraftState): Collection {
  return (state.copy ?? state.base) as Collection;
}

function stateOf(draft: object): DraftState {
  return host.getDraftState(draft)!;
}

/** The draft of a value of the base, or the value itself when it is not one. */
function read(state: DraftState, key: unknown, value: unknown): unknown {
  const base = state.base;
  const original = base instanceof Map ? base.get(key) : key;
  if (!host.isDraftable(value) || value !== original || (base instanceof Set && !base.has(key))) {
    return value;
  }
  let child = state.children.get(key);
  if (!child) {
    child = host.createDraftOf(value, state);
    state.children.set(key, child);
  }
  return child.proxy;
}

/** The entries as they are now. A set gives its value twice, as `Set.prototype.entries` does. */
function* entriesOf(state: DraftState): Generator<[unknown, unknown]> {
  const source = latest(state);
  for (const key of Array.from(source.keys())) {
    const current = latest(state);
    if (!current.has(key)) {
      continue;
    }
    if (current instanceof Map) {
      yield [key, read(state, key, current.get(key))];
    } else {
      const value = read(state, key, key);
      yield [value, value];
    }
  }
}

/** A draft of a value of the set that the recipe got, as its base value. */
function unwrap(state: DraftState, value: unknown): unknown {
  const draft = host.getDraftState(value);
  return draft && state.children.get(draft.base) === draft ? draft.base : value;
}

function has(this: object, key: unknown): boolean {
  const state = stateOf(this);
  return latest(state).has(state.base instanceof Set ? unwrap(state, key) : key);
}

function get(this: object, key: unknown): unknown {
  const state = stateOf(this);
  const source = latest(state) as Map<unknown, unknown>;
  return read(state, key, source.get(key));
}

function set(this: object, key: unknown, value: unknown): object {
  const state = stateOf(this);
  // @ts-expect-error `ImportMeta` has no `env` without the types of Vite. The literal form is what Vite replaces.
  if (import.meta.env?.DEV && host.getDraftState(key)) {
    throw new TypeError(
      'A draft cannot be a key of a Map in $produce. Use the key of the base value instead.',
    );
  }
  const source = latest(state) as Map<unknown, unknown>;
  const child = state.children.get(key);
  // A value that replaces a drafted value drops the changes made through the draft.
  if (
    child
      ? value === child.proxy || (value === child.base && !child.modified)
      : source.has(key) && Object.is(source.get(key), value)
  ) {
    return this;
  }
  (host.prepare(state) as Map<unknown, unknown>).set(key, value);
  state.children.delete(key);
  return this;
}

function add(this: object, value: unknown): object {
  const state = stateOf(this);
  const item = unwrap(state, value);
  if (!latest(state).has(item)) {
    (host.prepare(state) as Set<unknown>).add(item);
  }
  return this;
}

function remove(this: object, key: unknown): boolean {
  const state = stateOf(this);
  const item = state.base instanceof Set ? unwrap(state, key) : key;
  if (!latest(state).has(item)) {
    return false;
  }
  host.prepare(state);
  (state.copy as Collection).delete(item);
  if (state.base instanceof Map) {
    state.children.delete(item);
  }
  return true;
}

function clear(this: object): void {
  const state = stateOf(this);
  if (latest(state).size > 0) {
    (host.prepare(state) as Collection).clear();
    if (state.base instanceof Map) {
      state.children.clear();
    }
  }
}

function* keys(this: object): Generator<unknown> {
  for (const [key] of entriesOf(stateOf(this))) {
    yield key;
  }
}

function* values(this: object): Generator<unknown> {
  for (const [, value] of entriesOf(stateOf(this))) {
    yield value;
  }
}

function entries(this: object): Generator<[unknown, unknown]> {
  return entriesOf(stateOf(this));
}

function forEach(
  this: object,
  callback: (value: unknown, key: unknown, collection: object) => void,
  thisArg?: unknown,
): void {
  for (const [key, value] of entriesOf(stateOf(this))) {
    callback.call(thisArg, value, key, this);
  }
}

const mapMethods: Record<PropertyKey, unknown> = {
  get,
  set,
  has,
  delete: remove,
  clear,
  keys,
  values,
  entries,
  forEach,
  [Symbol.iterator]: entries,
};

const setMethods: Record<PropertyKey, unknown> = {
  add,
  has,
  delete: remove,
  clear,
  keys: values,
  values,
  entries,
  forEach,
  [Symbol.iterator]: values,
};

/** The methods that take another set, run on the latest set. Older engines do not have them. */
for (const name of [
  'union',
  'intersection',
  'difference',
  'symmetricDifference',
  'isSubsetOf',
  'isSupersetOf',
  'isDisjointFrom',
]) {
  const method = (Set.prototype as unknown as Record<string, unknown>)[name];
  if (typeof method === 'function') {
    setMethods[name] = function (this: object, other: unknown): unknown {
      return method.call(latest(stateOf(this)), other);
    };
  }
}

/** The draft of a `Map` or a `Set`. It copies the collection on the first change. */
export function createCollectionDraft(
  base: Collection,
  parent: DraftState | undefined,
  context: Host,
): DraftChild {
  host = context;
  const state = {
    base,
    copy: undefined,
    parent,
    children: new Map(),
    modified: false,
    final: undefined,
  } as DraftChild;
  const methods = base instanceof Map ? mapMethods : setMethods;
  // An empty target of the same type, so `instanceof` works. The traps answer from the state.
  const target = base instanceof Map ? new Map() : new Set();
  state.proxy = new Proxy(target, {
    get(_, key) {
      if (key === host.draft) {
        return state;
      }
      if (key === 'size') {
        return latest(state).size;
      }
      if (Object.hasOwn(methods, key)) {
        return methods[key];
      }
      return Reflect.get(target, key, target);
    },
  });
  return state;
}

/** The final value of a modified map or set: a copy that has the final values of its drafts. */
export function finalizeCollection(state: DraftState): Collection {
  const copy = state.copy as Collection;
  if (copy instanceof Map) {
    for (const [key, child] of state.children) {
      if (copy.get(key) === child.base) {
        copy.set(key, host.finalize(child));
      }
    }
    // A draft can be at another key than the one it came from.
    for (const [key, value] of copy) {
      const draft = host.getDraftState(value);
      if (draft) {
        copy.set(key, host.finalize(draft));
      }
    }
    return copy;
  }
  // The values of a set cannot change in place, so a set is made again in the same order.
  const result = new Set();
  for (const value of copy) {
    const child = host.getDraftState(value) ?? state.children.get(value);
    result.add(child ? host.finalize(child) : value);
  }
  return result;
}

/** Finalizes the drafts inside a map or set that the recipe returned. */
export function resolveCollection(
  value: Collection,
  resolve: (item: unknown) => unknown,
): Collection {
  if (value instanceof Map) {
    for (const [key, item] of value) {
      value.set(key, resolve(item));
    }
    return value;
  }
  const items = [...value];
  let changed = false;
  const resolved: unknown[] = [];
  for (const item of items) {
    const next = resolve(item);
    changed ||= next !== item;
    resolved.push(next);
  }
  if (changed) {
    value.clear();
    for (const item of resolved) {
      value.add(item);
    }
  }
  return value;
}
