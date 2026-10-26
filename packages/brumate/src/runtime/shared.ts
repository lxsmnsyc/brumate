// Values and types that the server and the browser share. It does not import
// seroval, so the core, which reads the page state without it, stays small.
// The plugins that write and read these values are in `serial.ts`.

import { HAS_BINDINGS, HAS_CHILDREN } from './features.ts';
import { raw } from './html.ts';
import type { Raw } from './html.ts';
import type { SerialEntry, ValuePlugin } from './values.ts';

/** The plugins of values of the app, by tag, which the entry `src/serial.ts` exports. */
const valuePlugins = new Map<string, ValuePlugin>();
const pluginListeners: ((plugin: ValuePlugin) => void)[] = [];
/** The options of the entry, which the serializer reads when it loads. */
let entryOptions: Omit<SerialEntry, 'plugins'> = {};
const optionListeners: ((options: Omit<SerialEntry, 'plugins'>) => void)[] = [];

/**
 * Takes the exports of the serial entry: its plugins and the options that it
 * changes. The server and the loader call it before the first value is
 * written or read.
 */
export function useSerialEntry(entry: SerialEntry): void {
  const { plugins = [], ...options } = entry;
  if (options.disabledFeatures !== undefined || options.depthLimit !== undefined) {
    entryOptions = options;
    for (const listener of optionListeners) {
      listener(options);
    }
  }
  registerValues(plugins);
}

/** Calls `listener` with the options of the entry, now and when they change. */
export function onSerialOptions(listener: (options: Omit<SerialEntry, 'plugins'>) => void): void {
  optionListeners.push(listener);
  listener(entryOptions);
}

/** Adds plugins of values of the app. */
function registerValues(plugins: readonly ValuePlugin[]): void {
  for (const plugin of plugins) {
    if (valuePlugins.get(plugin.tag) === plugin) {
      continue;
    }
    valuePlugins.set(plugin.tag, plugin);
    for (const listener of pluginListeners) {
      listener(plugin);
    }
  }
}

/** Calls `listener` for each plugin of the app, those added so far and those added later. */
export function onValuePlugin(listener: (plugin: ValuePlugin) => void): void {
  pluginListeners.push(listener);
  for (const plugin of valuePlugins.values()) {
    listener(plugin);
  }
}

/**
 * The ID of a scope or of a `#loading` boundary. The rest of the page numbers
 * its scopes from the base of the render, such as `3`. A `#loading` body
 * numbers its own from 0 after the ID of its boundary and a dot, such as
 * `5.0` and `5.1`, so its IDs do not depend on when its data arrives.
 */
export type ScopeId = number | string;

/** Reads a scope or boundary ID from markup. */
export function parseId(text: string): ScopeId {
  return /^-?\d+$/.test(text) ? Number(text) : text;
}

/** Adds a number to an ID. An ID inside a boundary moves with its boundary. */
export function shiftId(id: ScopeId, by: number): ScopeId {
  if (typeof id === 'number') {
    return id + by;
  }
  const dot = id.indexOf('.');
  return `${Number(id.slice(0, dot)) + by}${id.slice(dot)}`;
}

/** An element that the server rendered. The client finds it by its anchor. */
export class ElementReference {
  readonly scope: ScopeId;
  readonly anchor: number;

  constructor(scope: ScopeId, anchor: number) {
    this.scope = scope;
    this.anchor = anchor;
  }
}

/** A client function: an export of a client module, and the scope it reads. */
/** The key of the reference of children on the server, which the page state sends. */
export const CHILDREN_REF: unique symbol = Symbol.for('brumate.children') as never;

/**
 * The children of a component in the page state: the export that renders them in the browser,
 * such as `Page_1a2b#n0`, and the scope that they were written in. Each insert renders them
 * again, with new scopes, as the body of a block does.
 */
export class ChildrenReference {
  readonly ref: string;
  readonly scope: ScopeId;

  constructor(ref: string, scope: ScopeId) {
    this.ref = ref;
    this.scope = scope;
  }
}

export class FunctionReference {
  /** `<component id>#<export name>`. */
  readonly ref: string;
  readonly scope: ScopeId;
  /** The arguments of a handler that `$handler` made, which come before the event. */
  readonly args: unknown[] | undefined;
  /** The modifiers of the wrappers of a handler, such as `prevent`, for the `b-on` of a spread. */
  readonly modifiers: string[] | undefined;

  constructor(ref: string, scope: ScopeId, args?: unknown[] | null, modifiers?: string[]) {
    this.ref = ref;
    this.scope = scope;
    this.args = args ?? undefined;
    this.modifiers = modifiers;
  }
}

// Brands of bindings and slot references, under keys of the registry, so two copies of the
// runtime, such as a component's and the render context's, know each other's.
const BINDING = Symbol.for('brumate.binding');
const SLOT = Symbol.for('brumate.slot');

/** A slot of a scope, which a write of a bound prop goes to. */
export class SlotReference {
  readonly scope: ScopeId;
  readonly slot: number;

  constructor(scope: ScopeId, slot: number) {
    this.scope = scope;
    this.slot = slot;
  }
}

(SlotReference.prototype as unknown as Record<symbol, boolean>)[SLOT] = true;

/** True for a slot reference of any copy of the runtime. */
export function isSlotReference(value: unknown): value is SlotReference {
  return typeof value === 'object' && value !== null && SLOT in value;
}

/** True for a binding of any copy of the runtime. */
export function isBinding(value: unknown): value is Binding {
  return typeof value === 'object' && value !== null && BINDING in value;
}

/**
 * What `$bind(name)` passes a child: the value of the name, and its slot,
 * which the child's writes of the prop go to.
 */
export class Binding<T = unknown> {
  readonly value: T;
  readonly ref: SlotReference;
  /** The function of `$bind(name, fn)`, which a write calls in place of writing the slot. */
  readonly set: unknown;

  constructor(value: T, ref: SlotReference, set?: unknown) {
    this.value = value;
    this.ref = ref;
    this.set = set;
  }

  /** What a write of the bound prop goes to: the setter, or else the slot. */
  get target(): unknown {
    return this.set ?? this.ref;
  }
}

(Binding.prototype as unknown as Record<symbol, boolean>)[BINDING] = true;

/**
 * The props that a component destructures, with the values of their
 * bindings. `names` are the props that it destructures by name: the others,
 * which a rest prop holds, keep their bindings, so a spread passes them on.
 * Without `names`, every binding gives its value. `omit` are props that a rest
 * leaves out, because another `$props()` call of the component names them.
 */
export function unbind(
  props: Record<string, unknown>,
  names?: readonly string[],
  omit?: readonly string[],
): Record<string, unknown> {
  let result: Record<string, unknown> | undefined;
  // The props that another `$props()` call of the component names, which a rest leaves out.
  if (omit) {
    result = { ...props };
    for (const key of omit) {
      delete result[key];
    }
    props = result;
  }
  for (const key of names ?? Object.keys(props)) {
    const value = props[key];
    if (isBinding(value)) {
      result ??= { ...props };
      result[key] = value.value;
    }
  }
  return result ?? props;
}

/** A component, which the compiler marks with its ID. */
export type ComponentValue = ((...args: never[]) => unknown) & { brumateId: string };

/** The value of a feature that the build turned off, which no page state of it holds. */
function unused(): never {
  throw new Error('The page state holds a value of a feature that no component of the build uses');
}

/**
 * Makes the values of brumate's plugins. A state record calls them as `$b`,
 * with one letter each, and the plugins read nodes of server function calls
 * with them too, so both give the same values.
 */
export const stateValues: {
  /** An element that the server rendered, by its scope and anchor. */
  e: (scope: ScopeId, anchor: number) => ElementReference;
  /** A client function, by its reference and scope. */
  f: (
    ref: string,
    scope: ScopeId,
    args?: unknown[] | null,
    modifiers?: string[],
  ) => FunctionReference;
  /** HTML that the client may insert again. */
  r: (html: string) => Raw;
  /** Children, by the export that renders them and their scope. */
  n: (ref: string, scope: ScopeId) => ChildrenReference;
  /**
   * A component, such as the value of a dynamic tag. The client gets a
   * function with the same ID that renders nothing. The client code that
   * changes the value uses the component's render module instead.
   */
  c: (id: string) => ComponentValue;
  /** A slot of a scope, which a bound prop writes. */
  l: (scope: ScopeId, slot: number) => SlotReference;
  /** A binding that a rest prop holds, with its value and its slot. */
  b: (value: unknown, scope: ScopeId, slot: number, set?: unknown) => Binding;
  /** A value of the app, which a plugin of the entry makes from its data. */
  u: (tag: string, data: unknown) => unknown;
} = {
  e: (scope, anchor) => new ElementReference(scope, anchor),
  f: (ref, scope, args, modifiers) => new FunctionReference(ref, scope, args, modifiers),
  r: raw,
  n: HAS_CHILDREN ? (ref, scope) => new ChildrenReference(ref, scope) : unused,
  c: (id) => Object.assign(() => '', { brumateId: id }),
  l: (scope, slot) => new SlotReference(scope, slot),
  b: HAS_BINDINGS
    ? (value, scope, slot, set) => new Binding(value, new SlotReference(scope, slot), set)
    : unused,
  u: (tag, data) => {
    const plugin = valuePlugins.get(tag);
    if (!plugin) {
      throw new Error(
        `No plugin reads the value "${tag}". Export it in the plugins of the serial entry, src/serial.ts`,
      );
    }
    return plugin.fromData(data);
  },
};

/** True for a value that `for await` reads, such as the result of an async generator. */
export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function'
  );
}

/** The state of one scope in the page. */
export interface ScopeState {
  /** The scope's ID in the compiled component. */
  k?: number;
  /** The ID of the scope that contains this one. Component root scopes have none. */
  p?: ScopeId;
  /** The component ID of a component's root scope. */
  m?: string;
  /** The item of a list item scope. */
  i?: unknown;
  /** The scope that rendered a component's root scope, for finding contexts. */
  o?: ScopeId;
  /**
   * For a scope of children that a component inserted, the scope where they
   * are, which contexts are found from in place of `p` and `o`.
   */
  t?: ScopeId;
  /** For a component that passes its children on, the scope where they are finally inserted. */
  f?: ScopeId;
  /** The values that the scope provides, by context key. */
  v?: Record<string, unknown>;
  /** The slots that hold the contexts that the scope reads, by context key. */
  x?: Record<string, number>;
  /** Slot values, in the order of the scope's layout. */
  s?: unknown[];
  /** The scope IDs of child components, by anchor index. */
  c?: Record<number, ScopeId>;
  /**
   * What the bound props of a component write, by the slot of the prop: a
   * slot of a parent, or the function of `$bind(name, fn)`.
   */
  b?: Record<number, unknown>;
}

/** The state of a page, by scope ID. */
export type PageState = Record<ScopeId, ScopeState>;

/**
 * The flags of a group of scope records in `PackedState`:
 * - `ITEM_SLOT`: the item of each scope is its first slot.
 * - `ITEM`: each scope has its item after its slots.
 * - `CHILDREN`: each scope has its child components after that.
 * - `OWNER`: the scopes are component root scopes. `base` is the distance from the scope that
 *   rendered each one, `o`, to the scope, and the first gap is from 0. Otherwise `base` is the
 *   parent, `p`, of every scope.
 * - `MODULE`: the group has the component ID of its scopes after its header.
 * - `SOURCE`: the scopes are the items of a list whose list is a slot of an enclosing scope.
 *   The header then has that scope's ID and the slot's index, and the items are not written:
 *   the item of the scope at position `n` in the group is the value at `n` of the list, or of
 *   `Array.from` of a Set. With `ITEM_SLOT`, each scope writes its slots after the first.
 * - `PREFIX`: the scopes are inside a `#loading` body. The header ends with the prefix of
 *   their IDs, such as `5.`, and the gaps count the numbers after it.
 */
export const ITEM_SLOT = 1;
export const ITEM = 2;
export const CHILDREN = 4;
export const OWNER = 8;
export const MODULE = 16;
export const SOURCE = 32;
export const PREFIX = 64;

/**
 * The page state as the server writes it. Records of scopes that share their
 * kind, their parent or owner, and their shape are in one group of `g`,
 * such as the items of a list, instead of one object each. A group is a flat
 * array: `[kind, base, flags, slotCount, module?, source?, sourceSlot?, prefix?, ...scopes]`, and each scope
 * is its ID as the gap from the one before it (the first from `base`), its
 * slots, and then its item and its child components, as `flags` says.
 */
export type PackedState = PageState & { g?: unknown[][] };

/**
 * How a field of a state record holds scope IDs:
 * - `none`: no ID.
 * - `id`: the value is an ID.
 * - `ids`: an object whose values are IDs.
 * - `value`: a value that may hold references, such as an item.
 * - `values`: an array of such values.
 * - `map`: an object whose values are such values.
 */
export type FieldKind = 'none' | 'id' | 'ids' | 'value' | 'values' | 'map';

/** A reference class that holds a scope ID, and how it makes a copy with its IDs moved. */
export type ScopeReference = readonly [
  type: abstract new (...args: never[]) => object,
  shift: (value: never, by: number) => object,
];

/**
 * Every place that holds a scope ID, in one table: the fields of a state record
 * and the references in its values. Code that walks the IDs reads this table,
 * so a place that is added here is handled everywhere. A new field of
 * `ScopeState` fails to compile until it is in `fields`, and
 * `scope-ids.test.ts` fails for a new reference class that is not in `references`.
 */
export const SCOPE_IDS: {
  fields: Record<keyof ScopeState, FieldKind>;
  references: readonly ScopeReference[];
} = {
  fields: {
    k: 'none',
    p: 'id',
    m: 'none',
    i: 'value',
    o: 'id',
    t: 'id',
    f: 'id',
    v: 'map',
    x: 'none',
    s: 'values',
    c: 'ids',
    b: 'map',
  },
  references: [
    [
      ElementReference,
      (ref: ElementReference, by: number) =>
        new ElementReference(shiftId(ref.scope, by), ref.anchor),
    ],
    [
      FunctionReference,
      (ref: FunctionReference, by: number) =>
        new FunctionReference(ref.ref, shiftId(ref.scope, by), ref.args, ref.modifiers),
    ],
    // Children name the scope that wrote them, where they find their contexts.
    [
      ChildrenReference,
      (ref: ChildrenReference, by: number) =>
        new ChildrenReference(ref.ref, shiftId(ref.scope, by)),
    ],
    // The slot of a parent that a bound prop writes.
    [
      SlotReference,
      (ref: SlotReference, by: number) => new SlotReference(shiftId(ref.scope, by), ref.slot),
    ],
  ],
};
