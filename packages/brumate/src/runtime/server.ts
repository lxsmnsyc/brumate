import { fromJSON, toCrossJSONStream, toJSONAsync } from 'seroval';
import type { SerovalJSON, SerovalNode } from 'seroval';
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
      onParse: (record) => onRecord(record),
      onError: reject,
      onDone: resolve,
    });
  });
}

export interface RenderResult {
  html: string;
  /** The first state record. It holds the page state. */
  state: SerovalNode;
  /**
   * The records that settle promises in the state, as they are ready. Write
   * each one with `stateScript` after the page, so the client can read it.
   */
  pending: AsyncIterable<SerovalNode>;
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
            // oxlint-disable-next-line no-await-in-loop -- Each wait is for the next record.
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
 * Renders a component. It returns as soon as the markup is rendered, with
 * the first state record. Promises in the state do not hold it up: their
 * records come later, from `pending`.
 */
export async function renderToString<P>(Root: Component<P>, props: P): Promise<RenderResult> {
  const ctx = new Context();
  const html = await Root(props, ctx);
  const queue = createQueue<SerovalNode>();
  let state: SerovalNode | undefined;
  toCrossJSONStream(ctx.state, {
    plugins,
    onParse(record, initial) {
      if (initial) {
        state = record;
      } else {
        queue.push(record);
      }
    },
    onError: queue.fail,
    onDone: queue.close,
  });
  // The stream parser writes the first record before it returns.
  return { html, state: state!, pending: queue.iterable };
}

export interface StreamOptions {
  /** Markup before the component, such as the start of the document. */
  start?: string;
  /**
   * Markup right after the first state record, such as the client entry.
   * Make module scripts `async`, so they run before the stream ends.
   */
  scripts?: string;
  /** Markup after the component and its state, such as the end of the document. */
  end?: string;
}

/**
 * Renders a component as a stream: the markup and the first state record,
 * then a script for each state record as its promise settles.
 */
export function renderToStream<P>(
  Root: Component<P>,
  props: P,
  options: StreamOptions = {},
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      try {
        const { html, state, pending } = await renderToString(Root, props);
        controller.enqueue(
          `${options.start ?? ''}${html}${stateScript(state)}${options.scripts ?? ''}`,
        );
        for await (const record of pending) {
          controller.enqueue(stateScript(record));
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

/** Returns the script for one state record. */
export function stateScript(record: SerovalNode): string {
  const json = JSON.stringify(record).replace(/</g, '\\u003c');
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

/**
 * Answers a server function call from `brumate/client`. Returns undefined
 * when the request is not a call, so other handlers can answer it.
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
  const result = await handleRPC(functions, id, await request.json());
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
}
