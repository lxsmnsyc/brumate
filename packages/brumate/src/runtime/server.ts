import { toJSONAsync } from 'seroval';
import type { SerovalJSON } from 'seroval';
import { ElementReference, FunctionReference, functionReferences, plugins } from './shared.ts';
import type { PageState, ScopeState } from './shared.ts';

export { ElementReference, FunctionReference };
export type { PageState, ScopeState };

const RAW: unique symbol = Symbol('brumate.raw');

/** HTML that is inserted as it is, such as the output of a template. */
export interface Raw {
  [RAW]: string;
}

export function raw(html: string): Raw {
  return { [RAW]: html };
}

function isRaw(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && RAW in value;
}

/** Tracks the scopes of one render. */
export class Context {
  private nextScope = 0;
  readonly state: PageState = {};

  /** Returns a new scope ID. */
  scope(): number {
    return this.nextScope++;
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

const TEXT_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

export function escape(value: string): string {
  return value.replace(/[&<>]/g, (char) => TEXT_ESCAPES[char]!);
}

export function escapeAttribute(value: string): string {
  return value.replace(/[&<"]/g, (char) => TEXT_ESCAPES[char]!);
}

/** Renders a value inserted in markup. */
export async function insert(value: unknown): Promise<string> {
  const resolved = await value;
  if (isRaw(resolved)) {
    return resolved[RAW];
  }
  if (resolved === null || resolved === undefined || typeof resolved === 'boolean') {
    return '';
  }
  if (Array.isArray(resolved)) {
    const parts = await Promise.all(resolved.map(insert));
    return parts.join('');
  }
  return escape(String(resolved));
}

function toKebabCase(name: string): string {
  return name.startsWith('--') ? name : name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function classValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(classValue).filter(Boolean).join(' ');
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
      .join(' ');
  }
  return value ? String(value) : '';
}

function styleValue(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined && item !== false)
      .map(([name, item]) => `${toKebabCase(name)}:${String(item)}`)
      .join(';');
  }
  return String(value);
}

/** Renders one attribute, with a leading space. */
export function attribute(name: string, value: unknown): string {
  if (value === null || value === undefined || value === false || typeof value === 'function') {
    return '';
  }
  if (value === true) {
    return ` ${name}`;
  }
  let text: string;
  if (name === 'class') {
    text = classValue(value);
    if (text === '') {
      return '';
    }
  } else if (name === 'style') {
    text = styleValue(value);
  } else {
    text = String(value);
  }
  return ` ${name}="${escapeAttribute(text)}"`;
}

/** Renders an object of attributes. */
export function spread(attributes: Record<string, unknown>): string {
  let result = '';
  for (const [name, value] of Object.entries(attributes)) {
    if (name !== 'children' && !/^on[A-Z]/.test(name)) {
      result += attribute(name, value);
    }
  }
  return result;
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

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

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
  return `${open}${children ? children[RAW] : ''}</${tag}>`;
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
