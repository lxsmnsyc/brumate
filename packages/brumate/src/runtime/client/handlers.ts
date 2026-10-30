// Handlers of events: the handler of an element, the handlers that one event merges from spreads
// and props, and the calls of server functions from forms and `rpc`.

import { HAS_BINDINGS, HAS_CHILDREN, HAS_TEMPLATES } from '../features.ts';
import {
  actionAttributes,
  bindEntry,
  handlerEntry,
  ownValue,
  spread as spreadText,
} from '../html.ts';
import {
  ChildrenReference,
  FunctionReference,
  PARTS,
  isBinding,
  mergeHandlers,
  parseId,
} from '../shared.ts';
import type { ScopeId } from '../shared.ts';
import { RenderedChildren, childrenReady, templateReference } from './children.ts';
import { codeReady, isTemplate, loadedFunction } from './code.ts';
import { fail } from './errors.ts';
import { track } from './guesses.ts';
import { call, resolve } from './references.ts';
import { resolveScope } from './scopes.ts';
import { DEV, build, devtools, hiding, rpcPrefix, scopes } from './state.ts';
import type { Scope } from './state.ts';
import { memoSignal, pass, set, updateReady } from './updates.ts';

/**
 * The handlers that the core makes from references, with their references,
 * so a spread in markup that the browser renders passes them on in `b-on`,
 * as a spread on the server does.
 */
const handlerReferences = new WeakMap<object, FunctionReference>();

/** The modifiers that the wrappers of `brumate/events` put on a handler. */
const MODIFIERS = Symbol.for('brumate.modifiers');

/**
 * Renders an object of attributes. With `on`, a handler in it that the core
 * made from a reference goes into `on` as a `b-on` entry, with the scope and
 * the arguments of its reference and the modifiers of its wrappers.
 */
export function spread(
  attributes: Record<string, unknown>,
  on?: string[],
  names?: boolean,
): string {
  if (on) {
    on.push(...spreadEntries(attributes));
    // The `b-on` of a dynamic tag that names a component is in `on`, not written as an attribute.
    return spreadText({ ...attributes, 'b-on': undefined }, names);
  }
  return spreadText(attributes, names);
}

/** The `b-on` entries of the handlers and bindings of an object of attributes. */
export function spreadEntries(attributes: Record<string, unknown>): string[] {
  const on: string[] = [];
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'b-on' && ownValue(name, value)) {
      on.unshift(ownValue(name, value) as string);
    }
    // A merged handler writes one entry for each of its parts.
    const parts =
      /^on[A-Z]/.test(name) && typeof value === 'function'
        ? ((value as { [PARTS]?: object[] })[PARTS] ?? [value])
        : [];
    for (const part of parts) {
      const reference = handlerReferences.get(part);
      if (reference) {
        on.push(
          handlerEntry(name, reference.ref, reference.scope, reference.modifiers, reference.args),
        );
      }
    }
    // A binding that a rest prop passed on writes its slot, or calls its setter.
    if ((name === 'value' || name === 'checked') && HAS_BINDINGS && isBinding(value)) {
      on.push(bindEntry(name, value.ref, setterReference(value.set)));
    }
  }
  return on;
}

/** The reference of the setter of a binding: as the state has it, or of a handler that the core made. */
function setterReference(setter: unknown): FunctionReference | undefined {
  if (setter instanceof FunctionReference) {
    return setter;
  }
  return typeof setter === 'function' ? handlerReferences.get(setter) : undefined;
}

/** Replaces function references with functions that call them. */
export function callable(value: unknown, seen: Set<object>): unknown {
  if (HAS_CHILDREN && value instanceof ChildrenReference) {
    // The scope can come later in the state, such as of a page that navigation loads.
    return new RenderedChildren(value.scope, value.ref, value.at, value.anchor);
  }
  if (value instanceof FunctionReference) {
    if (HAS_TEMPLATES && isTemplate(value.ref)) {
      return templateReference(value.ref, scopes.get(value.scope));
    }
    // The code of the components on the page loads with the page, and handlers and updates wait
    // for it. So the function runs at once and returns its result, as on the server.
    // An arrow, to keep the narrowing of `value`.
    const handler = (...args: unknown[]): unknown => {
      const fn = loadedFunction(value.ref);
      const all = [...(value.args ?? []), ...args];
      return fn
        ? fn(scopes.get(value.scope), ...all)
        : call(value.ref, scopes.get(value.scope), all);
    };
    handlerReferences.set(handler, value);
    return handler;
  }
  if (typeof value === 'object' && value !== null && !seen.has(value)) {
    seen.add(value);
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value) || prototype === Object.prototype || prototype === null) {
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        record[key] = callable(record[key], seen);
      }
      // The parts of a merged handler.
      if (PARTS in record) {
        return mergeHandlers(value as ((...args: unknown[]) => unknown)[]);
      }
    }
  }
  return value;
}

// The handler of the previous event, once it has started.
export let lastHandler: Promise<unknown> = Promise.resolve();

/** Forgets the handler of the previous event, for a new page. */
export function resetHandler(): void {
  lastHandler = Promise.resolve();
}

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

/** Whether an input is a checkbox or a radio, which a binding reads by `checked`. */
export function isBox(field: HTMLInputElement): boolean {
  return /^(checkbox|radio)$/i.test(field.type);
}

/** The value a binding writes: of a field of a part, whether a box is checked, or the value. */
function fieldValue(element: Element, typed?: { value: unknown }): unknown {
  const field = element as HTMLInputElement;
  if (typed) {
    return typed.value;
  }
  return isBox(field) ? field.checked : field.value;
}

/**
 * Runs the handler `ref` for an element. The scope comes from the element's
 * `b-b` anchor, or from the nearest element around it that has one, which
 * the compiler checks is in the same scope.
 */
export function handle(
  element: Element,
  entry: string,
  event?: Event,
  typed?: { value: unknown },
): Promise<unknown> {
  // A handler that a spread passed on, such as `Parent#h1@3`, runs in the scope of its owner.
  // A handler that `$handler` made has its arguments after another `@`.
  const [ref, owner, encoded] = entry.split('@') as [string, string | undefined, string?];
  const bound = encoded ? (JSON.parse(decodeURIComponent(encoded)) as unknown[]) : [];
  const anchor = owner ?? element.closest('[b-b]')?.getAttribute('b-b')?.split(':')[0];
  const scope = anchor ? scopes.get(parseId(anchor)) : undefined;
  // A callback that the browser runs later, such as a `$client` callback for when the page is
  // idle, does not run once its element and its scope are gone, such as after the block or the
  // page that held it was removed.
  if (anchor && !scope && !element.isConnected) {
    return Promise.resolve();
  }
  // A `<window>` or `<document>` listener in a hidden `#offscreen` body does not run.
  if (scope && hiding?.hidden(scope) && element.hasAttribute('b-listen')) {
    return Promise.resolve();
  }
  // `value=$bind(name)` on an element: the core writes the slot of the name, `hops` parents up
  // from the element's scope, from the value of the element, or whether a box is checked.
  // `value=$bind(name, fn)`: the setter takes the value of the element. A ref names its scope
  // after `@`, so the prefix is `$set:`.
  // `typed` is a value that `readFields` took from a field of a part, in place of the element's own.
  if (ref.startsWith('$set:')) {
    return call(ref.slice(5), scope, [fieldValue(element, typed)]);
  }
  if (ref.startsWith('$bind#')) {
    const [hopsText, slotText] = ref.slice(6).split('.');
    const hops = Number(hopsText ?? 0);
    const slot = Number(slotText ?? 0);
    let target = scope;
    for (let hop = 0; hop < hops; hop++) {
      target = target?.p;
    }
    if (target) {
      set(target, slot, fieldValue(element, typed));
    }
    return Promise.resolve();
  }
  const args = event ? [...bound, withTarget(event, element)] : bound;
  const begun = DEV ? performance.now() : 0;
  if (DEV) {
    devtools()?.handler?.(ref, element, event);
  }
  // Parts load in parallel, but handlers start in the order of their events,
  // so an input handler runs before the submit handler of a later event.
  // The code of the children that the handler can insert loads with it.
  // So does the code of the page, which the handler can call.
  // So does the update code of the scopes that it can write, so its writes run before it returns.
  const children = childrenReady(scope);
  const code = codeReady();
  const loaded = Promise.all([resolve(ref), children, code, updateReady(scope, ref)]).then(
    ([handler]) => handler,
  );
  const started = lastHandler
    .then(() => loaded)
    .then((handler) => {
      if (!DEV) {
        return { value: pass(() => handler(scope, ...args)) };
      }
      const ready = performance.now();
      const value = pass(() => handler(scope, ...args));
      devtools()?.handled?.({
        ref,
        element,
        event: event?.type,
        begun,
        ready,
        end: performance.now(),
        result: value,
      });
      return { value };
    });
  lastHandler = started.catch(() => {});
  // An error of the handler, or of the promise that an async one returns, goes to the nearest
  // `#try` around its scope.
  return started
    .then((result) => result.value)
    .catch((error: unknown) => {
      fail(scope, error);
    });
}

/** Renders the attributes of a form or button that posts to a server function. */
export function action(name: string, id: string, method?: string, result?: string): string {
  return actionAttributes(rpcPrefix, name, id, method, result, build);
}

/**
 * Sends a form of an `$action`. The code is in `rpc.ts`, which every server
 * call loads, so the core holds only this.
 */
export function submitAction(form: HTMLFormElement, submitter: HTMLElement | null): void {
  void import('../rpc.ts').then((module) => module.sendAction(form, submitter));
}

/** Calls a server function. */
export async function rpc(id: string, args: unknown[]): Promise<unknown> {
  // Read before the import, while the memo that calls it computes.
  const signal = memoSignal();
  return track(import('../rpc.ts').then((module) => module.call(rpcPrefix, id, args, signal)));
}

/** A function prop rendered on the client calls the parent's exported handler. */
export function handlerProp(
  value: unknown,
  ref: string,
  scope: Scope | number,
  bound: unknown[] = [],
  modifiers?: string[],
): unknown {
  // A template renders at once, and the client has its code already.
  if (typeof value !== 'function' || isTemplate(ref)) {
    return value;
  }
  const instance = resolveScope(scope);
  // The function runs at once and returns its result, as a reference in the page state does.
  // Its export reads the current values of its scope. Before the code of its component loads,
  // such as while the browser renders the component for the first time, the function of the
  // render runs.
  function handler(...args: unknown[]): unknown {
    const fn = loadedFunction(ref);
    const all = [...bound, ...args];
    return fn ? fn(instance, ...all) : (value as (...rest: unknown[]) => unknown)(...all);
  }
  // A spread of markup that the browser renders passes it on, with the modifiers of its wrappers.
  // A scope that is not in the page yet has its ID in `scope`.
  handlerReferences.set(
    handler,
    new FunctionReference(
      ref,
      instance?.id ?? (scope as ScopeId),
      bound.length > 0 ? bound : undefined,
      modifiers ?? (value as { [MODIFIERS]?: string[] })[MODIFIERS],
    ),
  );
  return handler;
}
