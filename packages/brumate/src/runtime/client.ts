import { fromCrossJSON } from 'seroval';
import {
  VOID_ELEMENTS,
  attributeText,
  insertValue,
  isRaw,
  rawHTML,
  spread as spreadText,
} from './html.ts';
import type { Raw } from './html.ts';
import { ElementReference, FunctionReference, plugins } from './shared.ts';
import type { PageState } from './shared.ts';
import type { Context as ContextValue } from './context.ts';

export { attribute, escape, raw, spread, vars } from './html.ts';
export type { Raw } from './html.ts';
export { produce } from './produce.ts';
export { createContext } from './context.ts';

type Update = [kind: number, name: string];

/** The entry of a compiled client module. */
export interface ClientModule {
  id: string;
  /** Prop names to slot indices. `*` is the slot of a props object. */
  props: Record<string, number>;
  /** Scope kind, then slot, to the updates that read it. */
  g: Record<number, Record<number, Update[]>>;
  /** Imports a part of the module. */
  load: (part: string) => Promise<Part>;
}

/** A part of a client module: one client root, or the updates. */
export type Part = Record<string, unknown>;

/** The part that holds an export: `h<n>` and `c<n>` have their own, the rest are in `update`. */
function partOf(name: string): string {
  return /^[hc]\d/.test(name) ? name : 'update';
}

/** The instance of a scope in the page. */
export interface Scope {
  id: number;
  /** The scope's ID in the compiled component. */
  k: number;
  p?: Scope;
  /** The component ID, for a component's root scope. */
  m?: string;
  s: unknown[];
  /** The item of a list item scope. */
  i?: unknown;
  c?: Record<number, number>;
  /** The scope that rendered a component's root scope. */
  o?: Scope;
  /** The values that the scope provides, by context key. */
  v?: Record<string, unknown>;
  /** The slots that hold the contexts that the scope reads, by context key. */
  x?: Record<string, number>;
  children: Set<Scope>;
  cleanups?: Map<string, () => void>;
  keys?: Map<number, unknown>;
}

export interface CoreOptions {
  load: (id: string) => Promise<ClientModule>;
  /** Adds event listeners for the `data-on` attributes in new markup. */
  listen: (root: ParentNode) => void;
  /** The URL prefix of server function calls. Defaults to `/_brumate`. */
  rpc?: string;
}

let options: CoreOptions;
const scopes = new Map<number, Scope>();
const modules = new Map<string, ClientModule>();
const loading = new Map<string, Promise<ClientModule>>();
const parts = new Map<string, Promise<Part>>();
const loadedParts = new Map<string, Part>();
const comments = new Map<string, Comment>();
const elements = new Map<string, Element>();
// Scopes that the client creates get negative IDs, so they never match IDs
// from state records that the server streams later.
let nextId = -1;

// Records share references through this map, so a later record can settle a promise of an earlier one.
let refs: Map<number, unknown> | undefined;
const read = new WeakSet<Element>();

/**
 * Reads a state record. The first record holds the page state, and later
 * records settle the promises in it.
 */
function readRecord(script: Element): void {
  if (read.has(script)) {
    return;
  }
  read.add(script);
  refs ??= new Map();
  const value = fromCrossJSON<PageState>(JSON.parse(script.textContent!), { plugins, refs });
  // Records with scopes: the page state, and the state of each `#loading` body.
  if (script.hasAttribute('data-scopes')) {
    const added = addScopes(value);
    if (writes > 0) {
      refresh(added);
    }
  }
}

/**
 * Updates scopes that the server rendered before values changed on the
 * client, such as the body of a `#loading` block that streams in after an
 * event. Effects do not run: they run only when a value changes.
 */
function refresh(added: Scope[]): void {
  for (const scope of added) {
    const id = rootOf(scope).m;
    if (!id) {
      continue;
    }
    void loadModule(id).then(async (module) => {
      const names = new Set<string>();
      for (const slots of Object.values(module.g)) {
        for (const entries of Object.values(slots)) {
          for (const [kind, name] of entries) {
            if (kind === scope.k && name[0] !== 'e') {
              names.add(name);
            }
          }
        }
      }
      if (names.size === 0) {
        return;
      }
      const updates = await loadPart(module, 'update');
      // Memos first, so the other updates read their new values.
      for (const name of [...names].toSorted(
        (a, b) => Number(b[0] === 'm') - Number(a[0] === 'm'),
      )) {
        if (scopes.has(scope.id)) {
          (updates[name] as (scope: Scope) => void)(scope);
        }
      }
    });
  }
}

function addScopes(state: PageState): Scope[] {
  const added: Scope[] = [];
  for (const [key, record] of Object.entries(state)) {
    const id = Number(key);
    const scope: Scope = {
      id,
      k: record.k ?? 0,
      m: record.m,
      s: record.s ?? [],
      i: record.i,
      c: record.c,
      v: record.v,
      x: record.x,
      children: new Set(),
    };
    scopes.set(id, scope);
    added.push(scope);
  }
  for (const [key, record] of Object.entries(state)) {
    const scope = scopes.get(Number(key))!;
    if (record.p !== undefined) {
      scope.p = scopes.get(record.p);
      scope.p?.children.add(scope);
    }
    if (record.o !== undefined) {
      scope.o = scopes.get(record.o);
    }
  }
  const seen = new Set<object>();
  for (const scope of added) {
    for (let i = 0; i < scope.s.length; i++) {
      const value = callable(scope.s[i], seen);
      scope.s[i] = value;
      // A value that a later state record settles replaces its promise.
      if (value instanceof Promise) {
        void value.then((result) => {
          if (scope.s[i] === value) {
            set(scope, i, result);
          }
        });
      }
    }
  }
  return added;
}

const STATE = 'script[type="brumate/state"]';
let observer: MutationObserver | undefined;

/** Stops reading state records that arrive later. */
export function dispose(): void {
  observer?.disconnect();
  observer = undefined;
}

/** Reads the page state. The loader calls it once, before the first handler. */
export function init(value: CoreOptions): void {
  options = value;
  for (const script of document.querySelectorAll(STATE)) {
    readRecord(script);
  }
  // Records that are still streaming settle their promises when they arrive.
  observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1 && (node as Element).matches(STATE)) {
          readRecord(node as Element);
        }
      }
    }
  });
  observer.observe(document, { childList: true, subtree: true });
  // The whole document, because `#head` content is in the head.
  indexMarkers(document.documentElement);
}

/** Replaces function references with functions that call them. */
function callable(value: unknown, seen: Set<object>): unknown {
  if (value instanceof FunctionReference) {
    return (...args: unknown[]) => call(value.ref, scopes.get(value.scope), args);
  }
  if (typeof value === 'object' && value !== null && !seen.has(value)) {
    seen.add(value);
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value) || prototype === Object.prototype || prototype === null) {
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        record[key] = callable(record[key], seen);
      }
    }
  }
  return value;
}

export function loadModule(id: string): Promise<ClientModule> {
  let promise = loading.get(id);
  if (!promise) {
    promise = options.load(id).then((module) => {
      modules.set(id, module);
      return module;
    });
    loading.set(id, promise);
  }
  return promise;
}

function loadPart(module: ClientModule, name: string): Promise<Part> {
  const key = `${module.id}:${name}`;
  let promise = parts.get(key);
  if (!promise) {
    promise = module.load(name).then((part) => {
      loadedParts.set(key, part);
      return part;
    });
    parts.set(key, promise);
  }
  return promise;
}

type Handler = (scope: Scope | undefined, ...args: unknown[]) => unknown;

async function resolve(ref: string): Promise<Handler> {
  const [id, name] = ref.split('#') as [string, string];
  const module = await loadModule(id);
  const part = await loadPart(module, partOf(name));
  return part[name] as Handler;
}

async function call(ref: string, scope: Scope | undefined, args: unknown[]): Promise<unknown> {
  return (await resolve(ref))(scope, ...args);
}

// The handler of the previous event, once it has started.
let lastHandler: Promise<unknown> = Promise.resolve();

/**
 * Keeps `currentTarget` on an event. The handler runs after the event has
 * finished dispatching, when the browser has already cleared it.
 */
function withTarget(event: Event, element: Element): Event {
  return new Proxy(event, {
    get(target, key) {
      if (key === 'currentTarget') {
        return element;
      }
      const value: unknown = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** Runs the handler `ref` for an element with a `data-b` anchor. */
export function handle(element: Element, ref: string, event?: Event): Promise<unknown> {
  const anchor = element.getAttribute('data-b');
  const scope = anchor ? scopes.get(Number(anchor.split(':')[0])) : undefined;
  const args = event ? [withTarget(event, element)] : [];
  // Parts load in parallel, but handlers start in the order of their events,
  // so an input handler runs before the submit handler of a later event.
  const loaded = resolve(ref);
  const started = lastHandler
    .then(() => loaded)
    .then((handler) => ({ value: handler(scope, ...args) }));
  lastHandler = started.catch(() => {});
  return started.then((result) => result.value);
}

/** Returns the instance of a scope by its ID. */
export function scopeOf(id: number): Scope | undefined {
  return scopes.get(id);
}

// Slots

// oxlint-disable-next-line typescript/no-explicit-any -- Slots hold any value.
export function get(scope: Scope, slot: number): any {
  const value = scope.s[slot];
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
let writes = 0;

export function set<T>(scope: Scope, slot: number, value: T): T {
  if (!Object.is(scope.s[slot], value)) {
    writes++;
    scope.s[slot] = value;
    trigger(scope, slot);
  }
  return value;
}

// The latest load of each async memo, by `<scope>:<slot>`, so older results are dropped.
const loads = new Map<string, number>();
const loadingSlots = new Set<string>();

/**
 * Writes the result of an async memo when it arrives. Until then the slot
 * keeps its value, and `pending` is true. Only the latest load is written.
 */
export function asyncMemo(scope: Scope, slot: number, promise: Promise<unknown>): void {
  const key = `${scope.id}:${slot}`;
  const load = (loads.get(key) ?? 0) + 1;
  loads.set(key, load);
  if (!loadingSlots.has(key)) {
    loadingSlots.add(key);
    // Readers of the memo update, so `$isPending` becomes true.
    trigger(scope, slot);
  }
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
  promise.then(
    (value) => settle(value),
    (error: unknown) => {
      console.error(error);
      settle(undefined, true);
    },
  );
}

/** Writes a new value of a memo. A promise is loaded with `asyncMemo`. */
export function memo(scope: Scope, slot: number, value: unknown): void {
  if (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  ) {
    asyncMemo(scope, slot, Promise.resolve(value));
  } else {
    set(scope, slot, value);
  }
}

/** True while a new value of an async memo is loading. */
export function pending(scope: Scope, slot: number): boolean {
  return loadingSlots.has(`${scope.id}:${slot}`);
}

/** `x++`, `x--`, `++x` and `--x`. */
export function update(scope: Scope, slot: number, delta: number, prefix: boolean): number {
  const previous = get(scope, slot) as number;
  set(scope, slot, previous + delta);
  return prefix ? previous + delta : previous;
}

function rootOf(scope: Scope): Scope {
  let current = scope;
  while (current.p) {
    current = current.p;
  }
  return current;
}

function trigger(scope: Scope, slot: number): void {
  const id = rootOf(scope).m!;
  const module = modules.get(id);
  const updates = loadedParts.get(`${id}:update`);
  if (module && updates) {
    run(module, updates, scope, slot);
    return;
  }
  // The first write to a component loads its update code. Later writes wait in order.
  void loadModule(id).then(async (loaded) => {
    if (loaded.g[scope.k]?.[slot]) {
      run(loaded, await loadPart(loaded, 'update'), scope, slot);
    }
  });
}

function run(module: ClientModule, updates: Part, scope: Scope, slot: number): void {
  for (const [kind, name] of module.g[scope.k]?.[slot] ?? []) {
    const fn = updates[name] as (scope: Scope) => void;
    if (kind === scope.k) {
      fn(scope);
    } else {
      for (const target of descendants(scope, kind)) {
        fn(target);
      }
    }
  }
}

function descendants(scope: Scope, kind: number, result: Scope[] = []): Scope[] {
  for (const child of scope.children) {
    if (child.k === kind) {
      result.push(child);
    }
    descendants(child, kind, result);
  }
  return result;
}

function destroy(scope: Scope): void {
  for (const child of Array.from(scope.children)) {
    destroy(child);
  }
  // The content of a `#portal` is elsewhere in the page, so it is removed by its markers.
  const start = comments.get(`P${scope.id}`);
  if (start?.isConnected) {
    const end = rangeEnd(start);
    clear(start, end);
    start.remove();
    end.remove();
  }
  for (const cleanup of scope.cleanups?.values() ?? []) {
    cleanup();
  }
  scopes.delete(scope.id);
  scope.p?.children.delete(scope);
}

function disposeKinds(scope: Scope, kinds: number[]): void {
  for (const child of Array.from(scope.children)) {
    if (kinds.includes(child.k)) {
      destroy(child);
    }
  }
}

// DOM

const MARKER = /^[btilP]-?\d/;

function markerKey(data: string): string {
  return data[0] === 'b' ? data.split(':').slice(0, 2).join(':') : data;
}

function indexMarkers(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Comment).data;
    if (MARKER.test(data)) {
      comments.set(markerKey(data), node as Comment);
    }
  }
}

function findComment(key: string): Comment {
  let comment = comments.get(key);
  if (!comment?.isConnected) {
    indexMarkers(document.documentElement);
    comment = comments.get(key);
  }
  if (!comment) {
    throw new Error(`Missing marker <!--${key}-->`);
  }
  return comment;
}

function findElement(scope: number, anchor: number): Element | null {
  const key = `${scope}:${anchor}`;
  let element = elements.get(key);
  if (!element?.isConnected) {
    element = document.querySelector(`[data-b="${key}"]`) ?? undefined;
    if (element) {
      elements.set(key, element);
    }
  }
  return element ?? null;
}

/** Returns the marker that ends the range that `start` opens. */
function rangeEnd(start: Comment): Comment {
  let depth = 0;
  for (let node = start.nextSibling; node; node = node.nextSibling) {
    if (node.nodeType === 8) {
      const data = (node as Comment).data;
      if (data[0] === '/') {
        if (depth === 0) {
          return node as Comment;
        }
        depth--;
      } else if (MARKER.test(data)) {
        depth++;
      }
    }
  }
  throw new Error(`Missing end marker for <!--${start.data}-->`);
}

function clear(start: Node, end: Node): void {
  while (start.nextSibling && start.nextSibling !== end) {
    start.nextSibling.remove();
  }
}

/**
 * Inserts rendered HTML before a node, or at the end of a parent, and runs
 * the work that waits for it.
 */
function insertHTML(before: Node | { parent: ParentNode }, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content;
  indexMarkers(fragment);
  options.listen(fragment);
  if ('parent' in before) {
    before.parent.append(fragment);
  } else {
    before.parentNode!.insertBefore(fragment, before);
  }
  for (const fn of context.after.splice(0)) {
    fn();
  }
}

/** Renders a `#portal` body into its target, between markers with its scope ID. */
export function portal(scope: Scope, target: unknown, render: Render): void {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(element instanceof Element)) {
    return;
  }
  // The body's scope is the first scope that the render creates.
  const id = nextId;
  insertHTML({ parent: element }, `<!--P${id}-->${render(scope)}<!--/P-->`);
}

export function text(scope: Scope, anchor: number, value: unknown): void {
  const start = findComment(`t${scope.id}:${anchor}`);
  const end = rangeEnd(start);
  const node = start.nextSibling;
  if (
    (typeof value === 'string' || typeof value === 'number') &&
    node?.nodeType === 3 &&
    node.nextSibling === end
  ) {
    (node as Text).data = String(value);
    return;
  }
  clear(start, end);
  if (isRaw(value)) {
    insertHTML(end, rawHTML(value));
  } else if (typeof value === 'string' || typeof value === 'number') {
    end.parentNode!.insertBefore(document.createTextNode(String(value)), end);
  } else {
    insertHTML(end, insertValue(value));
  }
}

function setAttribute(element: Element, name: string, value: unknown): void {
  if (name === 'value' || name === 'checked') {
    (element as unknown as Record<string, unknown>)[name] =
      name === 'checked' ? Boolean(value) : (value ?? '');
  }
  const content = attributeText(name, value);
  if (content === undefined) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, content);
  }
}

export function attr(scope: Scope, anchor: number, name: string, value: unknown): void {
  const element = findElement(scope.id, anchor);
  if (element) {
    setAttribute(element, name, value);
  }
}

export function attrs(scope: Scope, anchor: number, values: Record<string, unknown>): void {
  const element = findElement(scope.id, anchor);
  if (element) {
    for (const [name, value] of Object.entries(values)) {
      if (name !== 'children' && !/^on[A-Z]/.test(name)) {
        setAttribute(element, name, value);
      }
    }
  }
}

type Render = (parent: Scope, item?: unknown, index?: number) => string;

/** Shows the branch at `index` of `#if` or `#switch`, or nothing for -1. */
export function branch(
  scope: Scope,
  anchor: number,
  index: number,
  renders: (Render | undefined)[],
  kinds: number[],
): void {
  const start = findComment(`b${scope.id}:${anchor}`);
  if (Number(start.data.split(':')[2]) === index) {
    return;
  }
  const end = rangeEnd(start);
  disposeKinds(scope, kinds);
  clear(start, end);
  start.data = `b${scope.id}:${anchor}:${index}`;
  const render = renders[index];
  if (render) {
    insertHTML(end, render(scope));
  }
}

/** Renders the body of `#key` again when its value changes. */
export function rekey(
  scope: Scope,
  anchor: number,
  value: unknown,
  render: Render,
  kinds: number[],
): void {
  scope.keys ??= new Map();
  if (scope.keys.has(anchor) && Object.is(scope.keys.get(anchor), value)) {
    return;
  }
  scope.keys.set(anchor, value);
  const start = findComment(`b${scope.id}:${anchor}`);
  const end = rangeEnd(start);
  disposeKinds(scope, kinds);
  clear(start, end);
  insertHTML(end, render(scope));
}

/**
 * Renders the body of a `#try` block again, for its `reset` function. If the
 * body throws, the fallback renders again with the error.
 */
export async function reset(
  scope: Scope,
  anchor: number,
  id: string,
  body: string,
  fallback: string,
  kinds: number[],
): Promise<void> {
  const updates = await loadPart(await loadModule(id), 'update');
  const start = findComment(`b${scope.id}:${anchor}`);
  const end = rangeEnd(start);
  disposeKinds(scope, kinds);
  clear(start, end);
  let html: string;
  try {
    html = (updates[body] as Render)(scope);
  } catch (error) {
    // Scopes that the body created before it threw.
    disposeKinds(scope, kinds);
    context.after.length = 0;
    html = (updates[fallback] as (parent: Scope, error: unknown) => string)(scope, error);
  }
  insertHTML(end, html);
}

/** Renders the body of a `#client` block once. */
export function fill(scope: Scope, anchor: number, render: Render): void {
  const start = findComment(`b${scope.id}:${anchor}`);
  const end = rangeEnd(start);
  if (start.nextSibling === end) {
    insertHTML(end, render(scope));
  }
}

interface Item {
  scope: Scope;
  nodes: Node[];
}

/** Updates the items of `#for` or `#repeat`, keeping the elements of items whose keys stay. */
export function list(
  scope: Scope,
  anchor: number,
  items: unknown[],
  key: (item: unknown, index: number) => unknown,
  render: Render,
  assign: (scope: Scope, item: unknown, index: number) => void,
  fallback: Render | undefined,
  fallbackKinds: number[],
): void {
  const start = findComment(`b${scope.id}:${anchor}`);
  const end = rangeEnd(start);
  const previous = new Map<unknown, Item>();
  const others: Node[] = [];
  let position = 0;
  for (let node = start.nextSibling; node && node !== end;) {
    if (node.nodeType === 8 && /^i-?\d+$/.test((node as Comment).data)) {
      const itemEnd = rangeEnd(node as Comment);
      const nodes: Node[] = [];
      for (let current: Node | null = node; current; current = current.nextSibling) {
        nodes.push(current);
        if (current === itemEnd) {
          break;
        }
      }
      const item = scopes.get(Number((node as Comment).data.slice(1)))!;
      previous.set(key(item.i, position++), { scope: item, nodes });
      node = itemEnd.nextSibling;
    } else {
      others.push(node);
      node = node.nextSibling;
    }
  }

  if (items.length === 0) {
    if (previous.size === 0 && others.length > 0) {
      return;
    }
    for (const item of previous.values()) {
      destroy(item.scope);
    }
    clear(start, end);
    if (fallback) {
      insertHTML(end, fallback(scope));
    }
    return;
  }

  disposeKinds(scope, fallbackKinds);
  for (const node of others) {
    node.parentNode?.removeChild(node);
  }
  const parent = end.parentNode!;
  items.forEach((value, index) => {
    const id = key(value, index);
    const item = previous.get(id);
    if (item) {
      previous.delete(id);
      // Slots that keep their values do not trigger updates.
      assign(item.scope, value, index);
      for (const node of item.nodes) {
        parent.insertBefore(node, end);
      }
    } else {
      insertHTML(end, render(scope, value, index));
    }
  });
  for (const item of previous.values()) {
    destroy(item.scope);
    for (const node of item.nodes) {
      node.parentNode?.removeChild(node);
    }
  }
}

/** Sets a style variable on the top-level elements of a component instance. */
export function setVar(scope: Scope, name: string, value: unknown): void {
  const content = value === null || value === undefined || value === false ? '' : String(value);
  for (const element of document.querySelectorAll<HTMLElement>(`[data-v="${scope.id}"]`)) {
    element.style.setProperty(name, content);
  }
}

/** The scope that provides a context to `scope`: itself or the nearest one above it. */
function findProvider(scope: Scope, key: string): Scope | undefined {
  for (let current: Scope | undefined = scope; current; current = current.p ?? current.o) {
    if (current.v && key in current.v) {
      return current;
    }
  }
  return undefined;
}

/** Writes a provided value, and the slot of every scope that reads it from this provider. */
export function provide(scope: Scope, context: ContextValue<unknown>, value: unknown): void {
  scope.v ??= {};
  scope.v[context.key] = value;
  for (const target of scopes.values()) {
    const slot = target.x?.[context.key];
    if (slot !== undefined && findProvider(target, context.key) === scope) {
      set(target, slot, value);
    }
  }
}

/** Sets the title of the page. */
export function title(value: unknown): void {
  document.title = value === null || value === undefined ? '' : String(value);
}

/** Writes a prop of a child component. */
export function prop(scope: Scope, anchor: number, name: string, value: unknown): void {
  const id = scope.c?.[anchor];
  const child = id === undefined ? undefined : scopes.get(id);
  if (!child?.m) {
    return;
  }
  const apply = (module: ClientModule): void => {
    const slot = module.props[name];
    if (slot !== undefined) {
      set(child, slot, value);
      return;
    }
    const all = module.props['*'];
    if (all !== undefined) {
      set(child, all, { ...(get(child, all) as object), [name]: value });
    }
  };
  const module = modules.get(child.m);
  if (module) {
    apply(module);
  } else {
    void loadModule(child.m).then(apply);
  }
}

/** Runs an effect or a `$client` callback, after the cleanup of its previous run. */
export function effect(scope: Scope, name: string, callback: () => unknown): void {
  scope.cleanups ??= new Map();
  scope.cleanups.get(name)?.();
  const cleanup = callback();
  if (typeof cleanup === 'function') {
    scope.cleanups.set(name, cleanup as () => void);
  } else {
    scope.cleanups.delete(name);
  }
}

/** Calls a server function. */
export async function rpc(id: string, args: unknown[]): Promise<unknown> {
  const { call: callServer } = await import('./rpc.ts');
  return callServer(options.rpc ?? '/_brumate', id, args);
}

// Rendering on the client

/** Renders a value inserted in markup. */
export function insert(value: unknown): string {
  return insertValue(value);
}

/** A component's client render function, from its `?brumate-render` module. */
// oxlint-disable-next-line typescript/no-explicit-any -- Components take any props.
export type Component<P = any> = (props: P) => string;

function resolveScope(scope: Scope | number | undefined): Scope | undefined {
  return typeof scope === 'number' ? scopes.get(scope) : scope;
}

/**
 * Renders a child component on the client. With `scope` and `anchor`,
 * records the child's scope so the parent can update its props.
 */
export function component<P>(
  Child: Component<P>,
  props: P,
  _ctx?: unknown,
  scope?: Scope | number,
  anchor?: number,
): string {
  const parent = resolveScope(scope);
  if (parent && anchor !== undefined) {
    parent.c ??= {};
    parent.c[anchor] = nextId;
  }
  if (parent) {
    context.own(parent);
  }
  return Child(props);
}

export function dynamic(
  tag: unknown,
  attributes: Record<string, unknown>,
  children: Raw | undefined,
  _ctx?: unknown,
  scope?: Scope | number,
): string {
  if (typeof tag === 'function') {
    return component(
      tag as Component,
      children ? { ...attributes, children } : attributes,
      undefined,
      scope,
    );
  }
  const name = String(tag);
  const open = `<${name}${spreadText(attributes)}>`;
  return VOID_ELEMENTS.has(name) ? open : `${open}${children ? rawHTML(children) : ''}</${name}>`;
}

class ClientContext {
  /** Work that waits until rendered markup is in the page. */
  readonly after: (() => void)[] = [];

  /** The scope that renders the next component, which becomes its owner. */
  private owner: Scope | undefined;

  scope(kind: number, parent?: Scope | number, module?: string): number {
    const id = nextId--;
    const parentScope = resolveScope(parent);
    const scope: Scope = { id, k: kind, p: parentScope, m: module, s: [], children: new Set() };
    if (module !== undefined && this.owner) {
      scope.o = this.owner;
      this.owner = undefined;
    }
    parentScope?.children.add(scope);
    scopes.set(id, scope);
    return id;
  }

  /** The ID that `$id()` makes. Client scope IDs are negative, so they differ from the server's. */
  id(scope: Scope | number, index: number): string {
    return `b${resolveScope(scope)!.id}-${index}`;
  }

  /** Sets the owner of the next component's root scope. */
  own(scope: Scope | number): void {
    this.owner = resolveScope(scope);
  }

  /** Provides a value of a context to the scopes inside `scope`. */
  provide<T>(context: ContextValue<T>, value: T, scope: Scope | number): void {
    const target = resolveScope(scope)!;
    target.v ??= {};
    target.v[context.key] = value;
  }

  /** Reads a context, and records its slot so that changes to the provided value reach it. */
  consume<T>(context: ContextValue<T>, scope: Scope | number, slot?: number): T {
    const target = resolveScope(scope)!;
    if (slot !== undefined) {
      target.x ??= {};
      target.x[context.key] = slot;
    }
    const provider = findProvider(target, context.key);
    return provider ? (provider.v![context.key] as T) : context.defaultValue;
  }

  slots(id: number, values: unknown[]): void {
    scopes.get(id)!.s = values;
  }

  item(id: number, value: unknown): void {
    scopes.get(id)!.i = value;
  }

  element(scope: number, anchor: number): ElementReference {
    return new ElementReference(scope, anchor);
  }

  /** Adds the markup of a `#head` block to the document's head. */
  head(html: string): void {
    this.after.push(() => insertHTML({ parent: document.head }, html));
  }

  /** Sets the title of the page, for a component that the client renders. */
  title(value: unknown): void {
    title(value);
  }

  /** Adds the markup of a `#portal` block at the end of the page, after the markup around it. */
  portal(html: string): void {
    this.after.push(() => insertHTML({ parent: document.body }, html));
  }

  /** Adds a component's stylesheet to the page, if the server did not. */
  style(id: string, css: string): string {
    if (!document.querySelector(`style[data-brm="${id}"]`)) {
      const style = document.createElement('style');
      style.dataset.brm = id;
      style.textContent = css;
      document.head.append(style);
    }
    return '';
  }

  /** A function prop rendered on the client calls the parent's exported handler. */
  fn(value: unknown, ref: string, scope: Scope | number): unknown {
    if (typeof value !== 'function') {
      return value;
    }
    const instance = resolveScope(scope);
    return (...args: unknown[]) => call(ref, instance, args);
  }
}

export const context: ClientContext = new ClientContext();
