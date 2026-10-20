import { fromJSON, toJSONAsync } from 'seroval';
import type { SerovalJSON } from 'seroval';
import { VOID_ELEMENTS, insertValue, isRaw, rawHTML, spread } from './html.ts';
import type { Raw } from './html.ts';
import { ElementReference, FunctionReference, functionReferences, plugins } from './shared.ts';
import type { PageState, ScopeState } from './shared.ts';

export { attribute, escape, escapeAttribute, raw, spread } from './html.ts';
export type { Raw } from './html.ts';
export { ElementReference, FunctionReference };
export type { PageState, ScopeState };

/** Tracks the scopes of one render. */
export class Context {
  private nextScope = 0;
  readonly state: PageState = {};

  /**
   * Returns a new scope ID. `kind` is the scope's ID in the compiled
   * component, `parent` is the scope that contains it, and `module` is the
   * component ID of a component's root scope.
   */
  scope(kind: number, parent?: number, module?: string): number {
    const id = this.nextScope++;
    const record = this.record(id);
    record.k = kind;
    if (parent !== undefined) {
      record.p = parent;
    }
    if (module !== undefined) {
      record.m = module;
    }
    return id;
  }

  /** The ID that the next call to `scope()` returns. */
  peek(): number {
    return this.nextScope;
  }

  private record(scope: number): ScopeState {
    this.state[scope] ??= {};
    return this.state[scope];
  }

  slots(scope: number, values: unknown[]): void {
    this.record(scope).s = values;
  }

  /** Records the item of a list that can change on the client. */
  item(scope: number, value: unknown): void {
    this.record(scope).i = value;
  }

  /** Records the scope of a child component at an anchor of its parent. */
  link(scope: number, anchor: number, child: number): void {
    const record = this.record(scope);
    record.c ??= {};
    record.c[anchor] = child;
  }

  /** Returns the reference that a `ref` signal holds on the server. */
  element(scope: number, anchor: number): ElementReference {
    return new ElementReference(scope, anchor);
  }

  /** Marks a function as a client function, so it serializes as a reference. */
  fn<T>(value: T, ref: string, scope: number): T {
    if (typeof value === 'function') {
      functionReferences.set(value, new FunctionReference(ref, scope));
    }
    return value;
  }
}

/** Renders a value inserted in markup. */
export async function insert(value: unknown): Promise<string> {
  const resolved = await value;
  if (Array.isArray(resolved)) {
    const parts = await Promise.all(resolved.map(insert));
    return parts.join('');
  }
  return insertValue(resolved);
}

// oxlint-disable-next-line typescript/no-explicit-any -- Components take any props.
export type Component<P = any> = (props: P, ctx: Context) => Promise<string>;

/**
 * Renders a child component. With `scope` and `anchor`, records the child's
 * scope so the parent can update its props on the client.
 */
export async function component<P>(
  Child: Component<P>,
  props: P,
  ctx: Context,
  scope?: number,
  anchor?: number,
): Promise<string> {
  if (scope !== undefined && anchor !== undefined) {
    ctx.link(scope, anchor, ctx.peek());
  }
  return Child(props, ctx);
}

/** Renders a dynamic tag, which can be an element name or a component. */
export async function dynamic(
  tag: string | Component,
  attributes: Record<string, unknown>,
  children: Raw | undefined,
  ctx: Context,
): Promise<string> {
  if (typeof tag === 'function') {
    return component(tag, children ? { ...attributes, children } : attributes, ctx);
  }
  const open = `<${tag}${spread(attributes)}>`;
  if (VOID_ELEMENTS.has(tag)) {
    return open;
  }
  return `${open}${children && isRaw(children) ? rawHTML(children) : ''}</${tag}>`;
}

export interface RenderResult {
  html: string;
  state: SerovalJSON;
}

/** Renders a component and collects the state of its scopes. */
export async function renderToString<P>(Root: Component<P>, props: P): Promise<RenderResult> {
  const ctx = new Context();
  const html = await Root(props, ctx);
  const state = await toJSONAsync(ctx.state, { plugins });
  return { html, state };
}

/** Returns the script that holds the page state. */
export function stateScript(state: SerovalJSON): string {
  const json = JSON.stringify(state).replace(/</g, '\\u003c');
  return `<script type="brumate/state">${json}</script>`;
}

/**
 * Calls a server function for a request from `rpc` in `brumate/client`.
 * `functions` maps server function IDs to the functions, from the `rpc`
 * exports of server modules.
 */
export async function handleRPC(
  // oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
  functions: Record<string, (...args: any[]) => unknown>,
  id: string,
  body: SerovalJSON,
): Promise<SerovalJSON> {
  const fn = functions[id];
  if (!fn) {
    throw new Error(`Unknown server function "${id}"`);
  }
  const args = fromJSON<unknown[]>(body, { plugins });
  return toJSONAsync(await fn(...args), { plugins });
}
