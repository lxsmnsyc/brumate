import { fromJSON, toCrossJSONStream, toJSONAsync } from 'seroval';
import type { SerovalJSON, SerovalNode } from 'seroval';
import {
  VOID_ELEMENTS,
  escape,
  escapeAttribute,
  insertValue,
  isRaw,
  rawHTML,
  spread,
  styleElement,
} from './html.ts';
import type { Raw } from './html.ts';
import {
  ElementReference,
  FunctionReference,
  disabledFeatures,
  functionReferences,
  plugins,
} from './shared.ts';
import type { PageState, ScopeState } from './shared.ts';
import { Redirect, ServerError, withRequest } from './request.ts';
import type { Context as ContextValue } from './context.ts';

export { attribute, escape, escapeAttribute, raw, spread, vars } from './html.ts';
export type { Raw } from './html.ts';
export { produce } from './produce.ts';
export { createContext } from './context.ts';
export { ServerError, getRequest, getResponseHeaders, isRedirect, redirect } from './request.ts';
export type { Redirect } from './request.ts';
export { ElementReference, FunctionReference };
export type { PageState, ScopeState };

/** A `#loading` body that renders after the rest of the page. */
interface Boundary {
  id: number;
  /** Resolves to the body's markup, and its scopes in `ctx.state`. */
  render: Promise<{ html: string; ctx: Context }>;
}

/**
 * Tracks the scopes of one render. A `#loading` body renders in a child
 * context, so its scopes are written with its markup.
 */
export class Context {
  readonly state: PageState = {};
  private readonly root: Context;
  private nextScope = 0;
  private nextBoundary = 0;
  private readonly boundaries: Boundary[] = [];
  private readonly styles = new Set<string>();
  /** Markup of `#portal` blocks, written at the end of the page. */
  readonly portals: string[] = [];
  /** Markup of `#head` blocks. */
  private readonly heads: string[] = [];
  private pageTitle: string | undefined;
  private onBoundary: ((boundary: Boundary) => void) | undefined;
  /** The scope tree of the whole page, for finding contexts across `#loading` bodies. */
  private readonly tree = new Map<number, { parent?: number; values?: Map<string, unknown> }>();
  /** The scope that renders the next component, which becomes its owner. */
  private owner: number | undefined;

  constructor(root?: Context) {
    this.root = root ?? this;
  }

  /**
   * Returns a new scope ID. `kind` is the scope's ID in the compiled
   * component, `parent` is the scope that contains it, and `module` is the
   * component ID of a component's root scope.
   */
  scope(kind: number, parent?: number, module?: string): number {
    const root = this.root;
    const id = root.nextScope++;
    const record = this.record(id);
    record.k = kind;
    if (parent !== undefined) {
      record.p = parent;
    }
    let up = parent;
    if (module !== undefined) {
      record.m = module;
      // A component's root scope links to the scope that rendered it.
      if (root.owner !== undefined) {
        record.o = root.owner;
        up = root.owner;
        root.owner = undefined;
      }
    }
    root.tree.set(id, { parent: up });
    return id;
  }

  /** The ID that `$id()` makes: the scope's ID and the position of the call. */
  id(scope: number, index: number): string {
    return `b${scope}-${index}`;
  }

  /** Sets the owner of the next component's root scope. */
  own(scope: number): void {
    this.root.owner = scope;
  }

  /** Provides a value of a context to the scopes inside `scope`. */
  provide<T>(context: ContextValue<T>, value: T, scope: number): void {
    const node = this.root.tree.get(scope)!;
    node.values ??= new Map();
    node.values.set(context.key, value);
    const record = this.record(scope);
    record.v ??= {};
    record.v[context.key] = value;
  }

  /**
   * Reads a context from the nearest scope that provides it, starting at
   * `scope`. With `slot`, records which slot holds it, so the client can
   * update it when the provided value changes.
   */
  consume<T>(context: ContextValue<T>, scope: number, slot?: number): T {
    if (slot !== undefined) {
      const record = this.record(scope);
      record.x ??= {};
      record.x[context.key] = slot;
    }
    for (let id: number | undefined = scope; id !== undefined;) {
      const node = this.root.tree.get(id);
      if (node?.values?.has(context.key)) {
        return node.values.get(context.key) as T;
      }
      id = node?.parent;
    }
    return context.defaultValue;
  }

  /** The ID that the next call to `scope()` returns. */
  peek(): number {
    return this.root.nextScope;
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

  /** Returns a component's stylesheet the first time the page renders the component. */
  style(id: string, css: string): string {
    if (this.root.styles.has(id)) {
      return '';
    }
    this.root.styles.add(id);
    return styleElement(id, css);
  }

  /** Adds the markup of a `#head` block. */
  head(html: string): void {
    this.root.heads.push(html);
  }

  /** Sets the title of the page. The last call wins. */
  title(value: unknown): void {
    this.root.pageTitle = value === null || value === undefined ? '' : String(value);
  }

  /** The markup for the document's head: the title and the `#head` blocks. */
  headHTML(): string {
    const title =
      this.root.pageTitle === undefined ? '' : `<title>${escape(this.root.pageTitle)}</title>`;
    return title + this.root.heads.join('');
  }

  /** Adds the markup of a `#portal` block, which goes after the rest of the page. */
  portal(html: string): void {
    this.portals.push(html);
  }

  /** Returns the ID of a new `#loading` boundary. */
  boundary(): number {
    return this.root.nextBoundary++;
  }

  /** Renders a `#loading` body after the rest of the page, in its own context. */
  defer(id: number, render: (ctx: Context) => Promise<string>): void {
    const child = new Context(this.root);
    const boundary: Boundary = { id, render: render(child).then((html) => ({ html, ctx: child })) };
    // The page does not wait for it, so a failure must not be unhandled.
    boundary.render.catch(() => {});
    const root = this.root;
    if (root.onBoundary) {
      root.onBoundary(boundary);
    } else {
      root.boundaries.push(boundary);
    }
  }

  /** Receives every boundary, including those registered before this call. */
  watch(onBoundary: (boundary: Boundary) => void): void {
    this.onBoundary = onBoundary;
    for (const boundary of this.boundaries.splice(0)) {
      onBoundary(boundary);
    }
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
  if (scope !== undefined) {
    ctx.own(scope);
  }
  return Child(props, ctx);
}

/** Renders a dynamic tag, which can be an element name or a component. */
export async function dynamic(
  tag: string | Component,
  attributes: Record<string, unknown>,
  children: Raw | undefined,
  ctx: Context,
  scope?: number,
): Promise<string> {
  if (typeof tag === 'function') {
    return component(tag, children ? { ...attributes, children } : attributes, ctx, scope);
  }
  const open = `<${tag}${spread(attributes)}>`;
  if (VOID_ELEMENTS.has(tag)) {
    return open;
  }
  return `${open}${children && isRaw(children) ? rawHTML(children) : ''}</${tag}>`;
}

/**
 * Serializes the page state as seroval cross-reference JSON records. The
 * first record holds the state, and each later record settles a promise in
 * it. `onRecord` receives each record as soon as it is ready. The promise
 * resolves when every promise in the state has settled.
 */
export function streamState(
  state: PageState,
  onRecord: (record: SerovalNode) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    toCrossJSONStream(state, {
      plugins,
      disabledFeatures,
      onParse: (record) => onRecord(record),
      onError: reject,
      onDone: resolve,
    });
  });
}

/**
 * Returns the script for one state record. `scopes` marks a record that
 * holds scopes, as opposed to one that settles a promise.
 */
export function stateScript(record: SerovalNode, scopes = false): string {
  const json = JSON.stringify(record).replace(/</g, '\\u003c');
  return `<script type="brumate/state"${scopes ? ' data-scopes' : ''}>${json}</script>`;
}

// Moves a `#loading` body from its <template> into the page, in place of the fallback.
const SWAP = `function $bS(i){var t=document.querySelector('template[data-l="'+i+'"]'),w=document.createTreeWalker(document.body,128),s,n,d=0;while(n=w.nextNode())if(n.data==='l'+i){s=n;break}if(!s||!t)return;var p=s.parentNode;for(n=s.nextSibling;n;){if(n.nodeType===8){if(n.data==='/l'){if(!d)break;d--}else if(/^l\\d/.test(n.data))d++}var x=n.nextSibling;p.removeChild(n);n=x}p.insertBefore(t.content,s);p.removeChild(s);n&&p.removeChild(n);t.remove()}`;

export interface RenderResult {
  /** The markup. A `#loading` body that is not ready shows its fallback. */
  html: string;
  /** The script that holds the page state. */
  state: string;
  /**
   * Markup to write after the page, as it is ready: the bodies of
   * `#loading` blocks, and the state records that settle promises.
   */
  pending: AsyncIterable<string>;
  /** Headers that server functions set while the page rendered, with `getResponseHeaders`. */
  headers: Headers;
  /** Markup for the document's head: the `$title` and the `#head` blocks. */
  head: string;
}

/** An async iterable that a producer pushes into. */
function createQueue<T>(): {
  push: (item: T) => void;
  close: () => void;
  fail: (error: unknown) => void;
  iterable: AsyncIterable<T>;
} {
  const items: T[] = [];
  let wake: (() => void) | undefined;
  let closed = false;
  let failure: { error: unknown } | undefined;
  const notify = (): void => {
    wake?.();
    wake = undefined;
  };
  return {
    push(item) {
      items.push(item);
      notify();
    },
    close() {
      closed = true;
      notify();
    },
    fail(error) {
      failure = { error };
      notify();
    },
    iterable: {
      async *[Symbol.asyncIterator]() {
        for (;;) {
          if (items.length > 0) {
            yield items.shift()!;
          } else if (failure) {
            throw failure.error;
          } else if (closed) {
            return;
          } else {
            // oxlint-disable-next-line no-await-in-loop -- Each wait is for the next item.
            await new Promise<void>((resolve) => {
              wake = resolve;
            });
          }
        }
      },
    },
  };
}

/**
 * Renders a component. It returns as soon as the markup is rendered.
 * `#loading` bodies and promises in the state do not hold it up: they come
 * later, from `pending`.
 */
export interface RenderOptions {
  /**
   * The request of the page. Server functions that run while the page
   * renders can read it with `getRequest`, and set headers with
   * `getResponseHeaders`, which `renderToString` returns.
   */
  request?: Request;
  /**
   * A Content Security Policy nonce for the inline scripts that swap in
   * `#loading` bodies. State scripts need none, because they do not run.
   */
  nonce?: string;
}

export async function renderToString<P>(
  Root: Component<P>,
  props: P,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const scriptTag =
    options.nonce === undefined ? '<script>' : `<script nonce="${escapeAttribute(options.nonce)}">`;
  const ctx = new Context();
  const headers = new Headers();
  const render = (): Promise<string> => Root(props, ctx);
  const rendered = options.request
    ? await withRequest(options.request, headers, render)
    : await render();
  const html = rendered + ctx.portals.join('');
  const queue = createQueue<string>();
  // Records share references, so later records can point into earlier ones.
  const refs = new Map<unknown, number>();
  let open = 0;
  let swap = false;
  const finish = (): void => {
    open--;
    if (open === 0) {
      queue.close();
    }
  };
  const serialize = (state: PageState, onScopes: (script: string) => void): void => {
    open++;
    toCrossJSONStream(state, {
      plugins,
      disabledFeatures,
      refs,
      onParse(record, initial) {
        if (initial) {
          onScopes(stateScript(record, true));
        } else {
          queue.push(stateScript(record));
        }
      },
      onError: queue.fail,
      onDone: finish,
    });
  };

  ctx.watch((boundary) => {
    open++;
    boundary.render.then(
      (result) => {
        serialize(result.ctx.state, (script) => {
          const call = `${swap ? '' : SWAP}$bS(${boundary.id})`;
          swap = true;
          queue.push(
            `<template data-l="${boundary.id}">${result.html}</template>${result.ctx.portals.join('')}${script}${scriptTag}${call}</script>`,
          );
        });
        finish();
      },
      (error: unknown) => {
        // The fallback stays in the page.
        console.error(error);
        finish();
      },
    );
  });

  let state = '';
  serialize(ctx.state, (script) => {
    state = script;
  });
  return { html, state, pending: queue.iterable, headers, head: ctx.headHTML() };
}

export interface StreamOptions extends RenderOptions {
  /**
   * Markup before the component, such as the start of the document. A
   * function receives the markup for the document's head, which is only known
   * after the component renders.
   */
  start?: string | ((head: string) => string);
  /**
   * Markup right after the page state, such as the client entry. Make
   * module scripts `async`, so they run before the stream ends.
   */
  scripts?: string;
  /** Markup after everything else, such as the end of the document. */
  end?: string;
}

/**
 * Renders a component as a stream: the markup and the page state, then each
 * `#loading` body and state record as it is ready.
 */
export function renderToStream<P>(
  Root: Component<P>,
  props: P,
  options: StreamOptions = {},
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      try {
        const { html, state, pending, head } = await renderToString(Root, props, options);
        const start =
          typeof options.start === 'function' ? options.start(head) : (options.start ?? '');
        controller.enqueue(`${start}${html}${state}${options.scripts ?? ''}`);
        for await (const chunk of pending) {
          controller.enqueue(chunk);
        }
        if (options.end) {
          controller.enqueue(options.end);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
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
  return toJSONAsync(await fn(...args), { plugins, disabledFeatures });
}

/**
 * Answers a server function call from `brumate/client`. Returns undefined
 * when the request is not a call, so other handlers can answer it. Server
 * functions can read the request with `getRequest`.
 */
export async function handleRequest(
  // oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
  functions: Record<string, (...args: any[]) => unknown>,
  request: Request,
  prefix = '/_brumate',
): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (request.method !== 'POST' || !url.pathname.startsWith(`${prefix}/`)) {
    return undefined;
  }
  const id = decodeURIComponent(url.pathname.slice(prefix.length + 1));
  if (!functions[id]) {
    return new Response(`Unknown server function "${id}"`, { status: 404 });
  }
  const body = await request.json();
  const headers = new Headers();
  return withRequest(request, headers, async () => {
    try {
      const result = await handleRPC(functions, id, body);
      headers.set('content-type', 'application/json');
      return new Response(JSON.stringify(result), { headers });
    } catch (error) {
      if (error instanceof Redirect) {
        headers.set('x-brumate-redirect', error.location);
        return new Response(null, { status: 204, headers });
      }
      const known = error instanceof ServerError;
      if (!known) {
        console.error(error);
      }
      headers.set('content-type', 'application/json');
      const message = known ? error.message : 'The server function failed';
      return new Response(JSON.stringify({ error: message }), {
        status: known ? error.status : 500,
        headers,
      });
    }
  });
}
