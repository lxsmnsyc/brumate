import {
  createCollectionDraft,
  finalizeCollection,
  resolveCollection,
  type Host,
} from './produce-collections.ts';

const DRAFT = Symbol('brumate.draft');

type Plain = Record<PropertyKey, unknown>;

export interface DraftState {
  /** A plain object, an array, a `Map` or a `Set`. */
  base: object;
  /** A shallow copy, made on the first change. */
  copy: object | undefined;
  parent: DraftState | undefined;
  /** Drafts of the values inside, by key. A set has its values as keys. */
  children: Map<unknown, DraftChild>;
  modified: boolean;
  /** The value that `finalize` returned, so a draft that was moved is finalized once. */
  final: unknown;
}

export type DraftChild = DraftState & { proxy: object };

/**
 * Plain objects, arrays, maps and sets can be drafted. Other values, such as
 * instances of a class, are used as they are.
 */
export function isDraftable(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  const prototype = Object.getPrototypeOf(value);
  return (
    prototype === Object.prototype ||
    prototype === null ||
    prototype === Map.prototype ||
    prototype === Set.prototype
  );
}

function latest(state: DraftState): Plain {
  return (state.copy ?? state.base) as Plain;
}

/** Copies a value and its parents on the first change. */
export function prepare(state: DraftState): object {
  for (
    let current: DraftState | undefined = state;
    current && !current.modified;
    current = current.parent
  ) {
    current.modified = true;
    const base = current.base;
    if (Array.isArray(base)) {
      current.copy = [...base];
    } else if (base instanceof Map) {
      current.copy = new Map(base);
    } else if (base instanceof Set) {
      current.copy = new Set(base);
    } else {
      current.copy = { ...base };
    }
  }
  return state.copy!;
}

export function getDraftState(value: unknown): DraftState | undefined {
  return typeof value === 'object' && value !== null
    ? ((value as Plain)[DRAFT] as DraftState | undefined)
    : undefined;
}

/** The draft of a value that `isDraftable` accepts. */
export function createDraftOf(base: object, parent: DraftState | undefined): DraftChild {
  return base instanceof Map || base instanceof Set
    ? createCollectionDraft(base, parent, HOST)
    : createDraft(base, parent);
}

const HOST: Host = { draft: DRAFT, createDraftOf, finalize, getDraftState, isDraftable, prepare };

function createDraft(base: object, parent: DraftState | undefined): DraftChild {
  const state = {
    base,
    copy: undefined,
    parent,
    children: new Map(),
    modified: false,
    final: undefined,
  } as DraftChild;
  // An empty target, so the draft can report the keys of the copy.
  const target = Array.isArray(base) ? [] : Object.create(Object.getPrototypeOf(base));
  state.proxy = new Proxy(target, {
    get(_, key) {
      if (key === DRAFT) {
        return state;
      }
      const source = latest(state);
      const value = source[key];
      if (
        !Object.hasOwn(source, key) ||
        !isDraftable(value) ||
        value !== (state.base as Plain)[key]
      ) {
        return value;
      }
      let child = state.children.get(key);
      if (!child) {
        child = createDraftOf(value, state);
        state.children.set(key, child);
      }
      return child.proxy;
    },
    set(_, key, value) {
      const source = latest(state);
      const child = state.children.get(key);
      if (
        child
          ? value === child.proxy || (value === child.base && !child.modified)
          : Object.is(source[key], value) && Object.hasOwn(source, key)
      ) {
        return true;
      }
      (prepare(state) as Plain)[key] = value;
      state.children.delete(key);
      return true;
    },
    deleteProperty(_, key) {
      if (Object.hasOwn(latest(state), key)) {
        delete (prepare(state) as Plain)[key];
        state.children.delete(key);
      }
      return true;
    },
    has(_, key) {
      return key in latest(state);
    },
    ownKeys() {
      return Reflect.ownKeys(latest(state));
    },
    getOwnPropertyDescriptor(_, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(latest(state), key);
      if (descriptor && key !== 'length') {
        descriptor.configurable = true;
        descriptor.writable = true;
      }
      return descriptor;
    },
    defineProperty(_, key, descriptor) {
      prepare(state);
      return Reflect.defineProperty(state.copy!, key, descriptor);
    },
  });
  return state;
}

/** Returns the final value of a draft: the base if nothing changed, or a new object that shares what did not. */
export function finalize(state: DraftState): unknown {
  if (state.final !== undefined) {
    return state.final;
  }
  if (!state.modified) {
    // A child can change without its parent being copied yet.
    for (const child of state.children.values()) {
      if (child.modified) {
        prepare(state);
        break;
      }
    }
    if (!state.modified) {
      return state.base;
    }
  }
  if (state.base instanceof Map || state.base instanceof Set) {
    state.final = finalizeCollection(state);
    return state.final;
  }
  const copy = state.copy as Plain;
  state.final = copy;
  for (const [key, child] of state.children) {
    if (copy[key as PropertyKey] === child.base) {
      copy[key as PropertyKey] = finalize(child);
    }
  }
  // Drafts can also be assigned to other keys, such as when an array is reordered.
  for (const key of Reflect.ownKeys(copy)) {
    const draft = getDraftState(copy[key]);
    if (draft) {
      copy[key] = finalize(draft);
    }
  }
  return copy;
}

/** The signals that `warnUndrafted` has already named. */
const warned = new Set<string>();

/** In dev, tells that an object the recipe could not draft cannot update anything. */
function warnUndrafted(base: unknown, name: string | undefined): void {
  // @ts-expect-error `ImportMeta` has no `env` without the types of Vite. The literal form is what Vite replaces.
  if (!import.meta.env?.DEV) {
    return;
  }
  if (typeof base !== 'object' || base === null) {
    return;
  }
  const key = name ?? '';
  if (warned.has(key)) {
    return;
  }
  warned.add(key);
  const kind = (base as object).constructor?.name ?? 'object';
  const target = name ?? 'value';
  console.warn(
    `$produce${name === undefined ? '' : `(${name})`} changed a ${kind} and returned nothing. Nothing updates. Return a new value, such as new ${kind}(${target}).`,
  );
}

/**
 * Returns a changed copy of a value. The recipe changes a draft as if it
 * were the value. Objects that it does not change keep their identity, and
 * if it changes nothing, the value itself is returned. A recipe can also
 * return a new value. Plain objects, arrays, maps and sets are drafted.
 */
export function produce<T>(base: T, recipe: (draft: T) => T | void, name?: string): T {
  if (!isDraftable(base)) {
    const result = recipe(base);
    if (result === undefined) {
      warnUndrafted(base, name);
      return base;
    }
    return result;
  }
  const state = createDraftOf(base, undefined);
  const result = recipe(state.proxy as T);
  if (result !== undefined && result !== state.proxy) {
    return resolve(result, new Set()) as T;
  }
  return finalize(state) as T;
}

/** Replaces the drafts in a value that a recipe returns, such as the result of `draft.filter(…)`. */
function resolve(value: unknown, seen: Set<unknown>): unknown {
  const draft = getDraftState(value);
  if (draft) {
    return finalize(draft);
  }
  if (!isDraftable(value) || seen.has(value)) {
    return value;
  }
  seen.add(value);
  if (value instanceof Map || value instanceof Set) {
    return resolveCollection(value, (item) => resolve(item, seen));
  }
  for (const key of Reflect.ownKeys(value)) {
    (value as Plain)[key] = resolve((value as Plain)[key], seen);
  }
  return value;
}
