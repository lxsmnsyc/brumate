import { Feature, createPlugin } from 'seroval';
import type {
  Plugin,
  SerovalNode,
  StreamParsePluginContext,
  SyncParsePluginContext,
} from 'seroval';
import { isRaw, raw, rawHTML } from './html.ts';
import type { Raw } from './html.ts';

/** An element that the server rendered. The client finds it by its anchor. */
export class ElementReference {
  readonly scope: number;
  readonly anchor: number;

  constructor(scope: number, anchor: number) {
    this.scope = scope;
    this.anchor = anchor;
  }
}

/** A client function: an export of a client module, and the scope it reads. */
export class FunctionReference {
  /** `<component id>#<export name>`. */
  readonly ref: string;
  readonly scope: number;

  constructor(ref: string, scope: number) {
    this.ref = ref;
    this.scope = scope;
  }
}

/** Server functions that are passed to the client, with their references. */
export const functionReferences: WeakMap<object, FunctionReference> = new WeakMap();

type ReferenceNode = { a: SerovalNode; b: SerovalNode };

/**
 * Returns the parse functions of a plugin. `read` returns the values of the
 * node by key, and each mode parses them in that order, so the nodes match.
 */
function parsers<T, K extends string>(
  read: (value: T) => Record<K, unknown>,
): Plugin<T, Record<K, SerovalNode>>['parse'] {
  type N = Record<K, SerovalNode>;
  const parse = (value: T, ctx: SyncParsePluginContext | StreamParsePluginContext): N => {
    const node = read(value) as Record<string, unknown>;
    for (const key in node) {
      node[key] = ctx.parse(node[key]);
    }
    return node as N;
  };
  return {
    sync: parse,
    stream: parse,
    async: async (value, ctx) => {
      const node = read(value) as Record<string, unknown>;
      for (const key in node) {
        // oxlint-disable-next-line no-await-in-loop -- In order, as the other modes parse, so the IDs match.
        node[key] = await ctx.parse(node[key]);
      }
      return node as N;
    },
  };
}

const ElementPlugin = createPlugin<ElementReference, ReferenceNode>({
  tag: 'brumate/element',
  test: (value) => value instanceof ElementReference,
  parse: parsers((value) => ({ a: value.scope, b: value.anchor })),
  serialize: (node, ctx) => `{s:${ctx.serialize(node.a)},a:${ctx.serialize(node.b)}}`,
  deserialize: (node, ctx) =>
    new ElementReference(ctx.deserialize<number>(node.a), ctx.deserialize<number>(node.b)),
});

const FunctionPlugin = createPlugin<object, ReferenceNode>({
  tag: 'brumate/function',
  test: (value) => typeof value === 'function' && functionReferences.has(value),
  parse: parsers((value) => {
    const reference = functionReferences.get(value)!;
    return { a: reference.ref, b: reference.scope };
  }),
  serialize: (node, ctx) => `{r:${ctx.serialize(node.a)},s:${ctx.serialize(node.b)}}`,
  deserialize: (node, ctx) =>
    new FunctionReference(ctx.deserialize<string>(node.a), ctx.deserialize<number>(node.b)),
});

/** HTML, such as the `children` of a component, so the client can insert it again. */
const RawPlugin = createPlugin<Raw, { h: SerovalNode }>({
  tag: 'brumate/raw',
  test: isRaw,
  parse: parsers((value) => ({ h: rawHTML(value) })),
  serialize: (node, ctx) => ctx.serialize(node.h),
  deserialize: (node, ctx) => raw(ctx.deserialize<string>(node.h)),
});

/** A component, which the compiler marks with its ID. */
type ComponentValue = ((...args: never[]) => unknown) & { brumateId: string };

/**
 * A component in the page state, such as the value of a dynamic tag. The
 * client gets a function with the same ID that renders nothing. The client
 * code that changes the value uses the component's render module instead.
 */
const ComponentPlugin = createPlugin<ComponentValue, { c: SerovalNode }>({
  tag: 'brumate/component',
  test: (value) =>
    typeof value === 'function' && typeof (value as Partial<ComponentValue>).brumateId === 'string',
  parse: parsers((value) => ({ c: value.brumateId })),
  serialize: (node, ctx) => ctx.serialize(node.c),
  deserialize: (node, ctx) =>
    Object.assign(() => '', { brumateId: ctx.deserialize<string>(node.c) }),
});

/** A value that its string makes again, such as a `URL` from its `href`. */
function stringPlugin<T extends { toString(): string }>(
  tag: string,
  type: new (text: string) => T,
): Plugin<T, { v: SerovalNode }> {
  return createPlugin<T, { v: SerovalNode }>({
    tag,
    test: (value) => value instanceof type,
    parse: parsers((value) => ({ v: value.toString() })),
    serialize: (node, ctx) => `new ${type.name}(${ctx.serialize(node.v)})`,
    deserialize: (node, ctx) => new type(ctx.deserialize<string>(node.v)),
  });
}

const URLPlugin = stringPlugin('brumate/url', URL);
const SearchParamsPlugin = stringPlugin('brumate/search-params', URLSearchParams);

/**
 * A file or a blob in the arguments of a server function call. The call
 * sends it as a part of multipart form data, named `file<index>`, instead
 * of in the JSON of the arguments.
 */
export class Upload {
  readonly index: number;

  constructor(index: number) {
    this.index = index;
  }
}

const UploadPlugin = createPlugin<Upload, { i: SerovalNode }>({
  tag: 'brumate/upload',
  test: (value) => value instanceof Upload,
  parse: parsers((value) => ({ i: value.index })),
  serialize: (node, ctx) => `{u:${ctx.serialize(node.i)}}`,
  deserialize: (node, ctx) => new Upload(ctx.deserialize<number>(node.i)),
});

/**
 * Replaces each value in arrays and plain objects that `replace` returns a
 * value for. Returns a copy, or the value itself when nothing changed.
 */
export function replaceDeep(value: unknown, replace: (value: unknown) => unknown): unknown {
  const replaced = replace(value);
  if (replaced !== undefined) {
    return replaced;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceDeep(item, replace));
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceDeep(item, replace)]),
    );
  }
  return value;
}

/** True for a value that `for await` reads, such as the result of an async generator. */
export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function'
  );
}

// oxlint-disable-next-line typescript/no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
export const plugins: Plugin<any, any>[] = [
  ElementPlugin,
  FunctionPlugin,
  RawPlugin,
  ComponentPlugin,
  UploadPlugin,
  URLPlugin,
  SearchParamsPlugin,
];

/**
 * Features that are off in both directions:
 *
 * - Errors keep their name and message only. A stack trace would show the
 *   server's files and code to the browser.
 * - Regular expressions are not sent. A pattern from a client could take
 *   the server a long time to match, and reading one is refused as well.
 */
export const disabledFeatures: number = Feature.ErrorPrototypeStack | Feature.RegExp;

/** The state of one scope in the page. */
export interface ScopeState {
  /** The scope's ID in the compiled component. */
  k?: number;
  /** The ID of the scope that contains this one. Component root scopes have none. */
  p?: number;
  /** The component ID of a component's root scope. */
  m?: string;
  /** The item of a list item scope. */
  i?: unknown;
  /** The scope that rendered a component's root scope, for finding contexts. */
  o?: number;
  /** The values that the scope provides, by context key. */
  v?: Record<string, unknown>;
  /** The slots that hold the contexts that the scope reads, by context key. */
  x?: Record<string, number>;
  /** Slot values, in the order of the scope's layout. */
  s?: unknown[];
  /** The scope IDs of child components, by anchor index. */
  c?: Record<number, number>;
}

/** The state of a page, by scope ID. */
export type PageState = Record<number, ScopeState>;
