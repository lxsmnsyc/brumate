// Child components that the browser renders, dynamic tags, and the slots and items that a render
// sets.

import { VOID_ELEMENTS, onAttribute, ownValue } from '../html.ts';
import type { Raw } from '../html.ts';
import { ElementReference, MemoError, addEntryHandlers, isAsyncIterable } from '../shared.ts';
import type { ComponentValue, ScopeId } from '../shared.ts';
import { insert } from './children.ts';
import type { Children } from './children.ts';
import { callable, spread } from './handlers.ts';
import { holdPlace, markCloned, parseHTML } from './insert.ts';
import { afterInsert, nextId, resolveScope, setOwner } from './scopes.ts';
import { loadingValues, loads, scopes, valueRenders } from './state.ts';
import type { Scope } from './state.ts';
import { setContent } from './templates.ts';
import { asyncMemo, isThenable, noop, set } from './updates.ts';

/** A component's client render function, from its `?brumate-render` module. */
// oxlint-disable-next-line typescript/no-explicit-any -- Components take any props.
export type Component<P = any> = (props: P) => string | DocumentFragment;

/** Puts a child component that a clone renders in the place of its comment. */
export function place(at: Comment, out: string | Node): void {
  if (typeof out === 'string') {
    // A component that renders HTML: its markup, which the insert of the clone indexes.
    at.replaceWith(parseHTML(out, at));
    markCloned();
  } else {
    at.replaceWith(out);
  }
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
    setOwner(parent);
  }
  return holdPlace(Child(props));
}

/** Renders a child component for a clone: its markup as HTML, or the clone that it made. */
export function componentNodes<P>(
  Child: Component<P>,
  props: P,
  _ctx?: unknown,
  scope?: Scope | number,
  anchor?: number,
): string | DocumentFragment {
  const parent = resolveScope(scope);
  if (parent && anchor !== undefined) {
    parent.c ??= {};
    parent.c[anchor] = nextId;
  }
  if (parent) {
    setOwner(parent);
  }
  return Child(props);
}

/** The attributes of a dynamic element, with one `b-on` for its own handlers and those of its props. */
function startAttributes(attributes: Record<string, unknown>): string {
  const on: string[] = [];
  return spread(attributes, on) + onAttribute(on, '');
}

/**
 * Renders a dynamic tag for a clone: the element, with its attributes and content, or what a
 * component renders.
 */
export function dynamicNodes(
  tag: unknown,
  attributes: Record<string, unknown>,
  inner: Raw | Children | undefined,
  _ctx?: unknown,
  scope?: Scope | number,
  ref?: unknown,
  foreign?: string,
): string | Node {
  if (typeof tag === 'function') {
    // The anchor links the component to the tag, so updates reach its props. It is no prop.
    const {
      'b-b': bound,
      'b-on': entries,
      ...props
    } = ref === undefined ? attributes : { ...attributes, ref };
    // Its handlers reach the component as props, as the server passes them.
    addEntryHandlers(
      props,
      entries,
      typeof scope === 'object' ? scope.id : scope,
      (reference) => callable(reference, new Set()) as (...args: unknown[]) => unknown,
    );
    if (inner) {
      props.children = inner;
    }
    return componentNodes(
      valueRenders[(tag as ComponentValue).brumateId] ?? (tag as Component),
      props,
      undefined,
      scope,
      bound ? Number((ownValue('b-b', bound) as string).split(':')[1]) : undefined,
    );
  }
  const name = String(tag);
  // The start tag as HTML, so the attributes are written as `dynamic` writes them.
  const element = parseHTML(`<${name}${startAttributes(attributes)}>`, undefined, foreign)
    .firstChild as Element;
  const bound = element.getAttribute('b-b');
  if (bound) {
    const [id, anchor] = bound.split(':');
    const kept = scopes.get(Number(id));
    if (kept) {
      (kept.n ??= [])[Number(anchor)] = element;
    }
  }
  if (element.hasAttribute('b-on')) {
    // The insert of the clone listens to the events of the handlers.
    markCloned();
  }
  if (inner && !VOID_ELEMENTS.has(name)) {
    setContent(element, inner, scope);
  }
  return element;
}

/** `dynamicNodes` for a dynamic tag inside SVG or MathML, `svg` or `math`. */
export function foreignNodes(
  foreign: string,
  tag: unknown,
  attributes: Record<string, unknown>,
  inner: Raw | Children | undefined,
  ctx?: unknown,
  scope?: Scope | number,
  ref?: unknown,
): string | Node {
  return dynamicNodes(tag, attributes, inner, ctx, scope, ref, foreign);
}

export function dynamic(
  tag: unknown,
  attributes: Record<string, unknown>,
  inner: Raw | Children | undefined,
  _ctx?: unknown,
  scope?: Scope | number,
  ref?: unknown,
): string {
  if (typeof tag === 'function') {
    return holdPlace(
      dynamicNodes(tag, attributes, inner, _ctx, scope, ref) as string | DocumentFragment,
    );
  }
  const name = String(tag);
  const open = `<${name}${startAttributes(attributes)}>`;
  return VOID_ELEMENTS.has(name)
    ? open
    : `${open}${inner ? insert(inner, undefined, scope) : ''}</${name}>`;
}

/** The promises and streams that `renderMemo` made, which `setSlots` loads as memos. */
const memoLoads = new WeakMap<object, number>();

/**
 * Marks the value of a memo of a render that cannot hold an error: a promise or a stream is
 * loaded by `setSlots` once the scope is in the page.
 */
export function memoNow(value: unknown): unknown {
  if (isThenable(value) || isAsyncIterable(value)) {
    memoLoads.set(value as object, (memoLoads.get(value as object) ?? 0) + 1);
  }
  return value;
}

/**
 * Computes a memo of a render. A throw is held in a `MemoError`, as the server holds the error
 * of a memo until a read.
 */
export function renderMemo(compute: () => unknown): unknown {
  try {
    return memoNow(compute());
  } catch (error) {
    return new MemoError(error);
  }
}

/** Reads a memo of a render: the error that a throw held is thrown at the read. */
export function readMemo(value: unknown): unknown {
  if (value instanceof MemoError) {
    throw value.error;
  }
  return value;
}

export function setSlots(id: ScopeId, values: unknown[]): void {
  const own = scopes.get(id)!;
  own.s = values;
  // The occurrences of each promise that a memo made, so memos that return one promise each load.
  const counted = new Map<unknown, number>();
  // A render function computes a memo that loads as a promise, which the first compute of the
  // memo takes. Its failure is the memo's to report, not an unhandled rejection.
  for (let slot = 0; slot < values.length; slot++) {
    const value = values[slot];
    const made = memoLoads.get(value as object);
    let loading = false;
    // A promise that a parent passed as a prop stays a promise. A memo of the prop holds the same
    // promise in a later slot, which loads.
    if (value instanceof Promise && own.props?.includes(value) && values.indexOf(value) === slot) {
      (own.plain ??= new Set()).add(slot);
      // Nothing handles its rejection unless the child reads it.
      value.catch(noop);
      // The slot of a memo of the prop is the only one.
      loading = made !== undefined && values.lastIndexOf(value) === slot;
    } else if (made !== undefined) {
      loading = (counted.get(value) ?? 0) < made;
      counted.set(value, (counted.get(value) ?? 0) + 1);
    }
    const key = `${id}:${slot}`;
    // The load that the memo starts once the insert has put its scope in the page.
    let started: number | undefined;
    if (loading) {
      afterInsert.push(() => {
        if (scopes.get(id) === own) {
          started = asyncMemo(own, slot, Promise.resolve(value));
        }
      });
    }
    if (isThenable(value) && !own.plain?.has(slot)) {
      loadingValues.add(value);
      // The value is written when the promise settles, before the writes of a later load.
      Promise.resolve(value).then((result) => {
        const scope = scopes.get(id);
        if (scope?.s[slot] === value && (!loads.has(key) || loads.get(key) === started)) {
          set(scope, slot, result);
        }
      }, noop);
    }
  }
  own.props = undefined;
}

export function setItem(id: ScopeId, value: unknown): void {
  scopes.get(id)!.i = value;
}

export function elementAt(scope: ScopeId, anchor: number): ElementReference {
  return new ElementReference(scope, anchor);
}
