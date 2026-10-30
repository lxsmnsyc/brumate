const DRAFT = Symbol('brumate.draft');

interface DraftState {
  base: Record<PropertyKey, unknown>;
  /** A shallow copy, made on the first change. */
  copy: Record<PropertyKey, unknown> | undefined;
  parent: DraftState | undefined;
  /** Drafts of the objects inside, by key. */
  children: Map<PropertyKey, DraftState & { proxy: object }>;
  modified: boolean;
}

/** Plain objects and arrays can be drafted. Other values, such as `Map`, are used as they are. */
function isDraftable(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function latest(state: DraftState): Record<PropertyKey, unknown> {
  return state.copy ?? state.base;
}

/** Copies an object and its parents on the first change. */
function prepare(state: DraftState): Record<PropertyKey, unknown> {
  for (
    let current: DraftState | undefined = state;
    current && !current.modified;
    current = current.parent
  ) {
    current.modified = true;
    current.copy = (
      Array.isArray(current.base) ? [...current.base] : { ...current.base }
    ) as Record<PropertyKey, unknown>;
  }
  return state.copy!;
}

function getDraftState(value: unknown): DraftState | undefined {
  return typeof value === 'object' && value !== null
    ? ((value as Record<PropertyKey, unknown>)[DRAFT] as DraftState | undefined)
    : undefined;
}

function createDraft(
  base: Record<PropertyKey, unknown>,
  parent: DraftState | undefined,
): DraftState & { proxy: object } {
  const state = {
    base,
    copy: undefined,
    parent,
    children: new Map(),
    modified: false,
  } as DraftState & {
    proxy: object;
  };
  // An empty target, so the draft can report the keys of the copy.
  const target = Array.isArray(base) ? [] : Object.create(Object.getPrototypeOf(base));
  state.proxy = new Proxy(target, {
    get(_, key) {
      if (key === DRAFT) {
        return state;
      }
      const source = latest(state);
      const value = source[key];
      if (!Object.hasOwn(source, key) || !isDraftable(value) || value !== state.base[key]) {
        return value;
      }
      let child = state.children.get(key);
      if (!child) {
        child = createDraft(value, state);
        state.children.set(key, child);
      }
      return child.proxy;
    },
    set(_, key, value) {
      const source = latest(state);
      if (Object.is(source[key], value) && Object.hasOwn(source, key)) {
        return true;
      }
      prepare(state)[key] = value;
      state.children.delete(key);
      return true;
    },
    deleteProperty(_, key) {
      if (Object.hasOwn(latest(state), key)) {
        delete prepare(state)[key];
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
function finalize(state: DraftState): unknown {
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
  const copy = state.copy!;
  for (const [key, child] of state.children) {
    if (copy[key] === child.base) {
      copy[key] = finalize(child);
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

/**
 * Returns a changed copy of a value. The recipe changes a draft as if it
 * were the value. Objects that it does not change keep their identity, and
 * if it changes nothing, the value itself is returned. A recipe can also
 * return a new value. Only plain objects and arrays are drafted.
 */
export function produce<T>(base: T, recipe: (draft: T) => T | void): T {
  if (!isDraftable(base)) {
    const result = recipe(base);
    return result === undefined ? base : result;
  }
  const state = createDraft(base, undefined);
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
  for (const key of Reflect.ownKeys(value)) {
    value[key] = resolve(value[key], seen);
  }
  return value;
}
