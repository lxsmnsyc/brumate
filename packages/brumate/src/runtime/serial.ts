// The seroval plugins of brumate's values. The server writes the page state
// with them as code, and server function calls as JSON, which both sides
// read with them. The core does not import this module: a state record
// is code that makes its values with `stateValues`, so seroval loads in the
// browser only with the first server function call.

import { Feature, createPlugin } from 'seroval';
import {
  AbortSignalPlugin,
  CustomEventPlugin,
  DOMExceptionPlugin,
  EventPlugin,
  FormDataPlugin,
  HeadersPlugin,
  ImageDataPlugin,
  ReadableStreamPlugin,
  RequestPlugin,
  ResponsePlugin,
  URLPlugin,
  URLSearchParamsPlugin,
} from 'seroval-plugins/web';
import type {
  Plugin,
  SerovalNode,
  StreamParsePluginContext,
  SyncParsePluginContext,
} from 'seroval';
import { Internal, isRaw, rawHTML } from './html.ts';
import type { Raw } from './html.ts';
import { functionReferences, isBlob } from './calls.ts';
import { MODIFIERS } from './events.ts';
import {
  CHILDREN_REF,
  ElementReference,
  PARTS,
  isBinding,
  isSlotReference,
  onSerialOptions,
  onValuePlugin,
  stateValues,
} from './shared.ts';
import type { ChildrenReference, MemoError, ScopeId } from './shared.ts';
import type { ValuePlugin } from './values.ts';
import type { Binding, SlotReference } from './shared.ts';
import type { ComponentValue } from './shared.ts';

type ReferenceNode = { a: SerovalNode; b: SerovalNode; c?: SerovalNode; d?: SerovalNode };

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

// In the page state, each value is a call of `stateValues`, which the code of a record gets as `$b`.

// No plugin here matches a plain object, so each one sets skipPlainObjects and seroval
// does not run its test on object literals. Raw HTML is a class instance for this reason.
const ElementPlugin = createPlugin<ElementReference, ReferenceNode>({
  tag: 'brumate/element',
  skipPlainObjects: true,
  test: (value) => value instanceof ElementReference,
  parse: parsers((value) => ({ a: value.scope, b: value.anchor })),
  serialize: (node, ctx) => `$b.e(${ctx.serialize(node.a)},${ctx.serialize(node.b)})`,
  deserialize: (node, ctx) =>
    stateValues.e(ctx.deserialize<number>(node.a), ctx.deserialize<number>(node.b)),
});

const SlotPlugin = createPlugin<SlotReference, ReferenceNode>({
  tag: 'brumate/slot',
  skipPlainObjects: true,
  test: (value) => isSlotReference(value),
  parse: parsers((value) => ({ a: value.scope, b: value.slot })),
  serialize: (node, ctx) => `$b.l(${ctx.serialize(node.a)},${ctx.serialize(node.b)})`,
  deserialize: (node, ctx) =>
    stateValues.l(ctx.deserialize<number>(node.a), ctx.deserialize<number>(node.b)),
});

/** A binding that a rest prop holds: its value, and the scope and the slot it writes. */
const BindingPlugin = createPlugin<Binding, ReferenceNode>({
  tag: 'brumate/binding',
  skipPlainObjects: true,
  test: (value) => isBinding(value),
  parse: parsers((value) => {
    const node: Record<string, unknown> = { a: value.value, b: value.ref.scope, c: value.ref.slot };
    // The setter of `$bind(name, fn)`.
    if (value.set !== undefined) {
      node.d = value.set;
    }
    return node as Record<'a' | 'b' | 'c' | 'd', unknown>;
  }),
  serialize: (node, ctx) =>
    `$b.b(${[node.a, node.b, node.c, node.d]
      .filter((part) => part !== undefined)
      .map((part) => ctx.serialize(part!))
      .join(',')})`,
  deserialize: (node, ctx) =>
    stateValues.b(
      ctx.deserialize(node.a),
      ctx.deserialize<number>(node.b!),
      ctx.deserialize<number>(node.c!),
      node.d === undefined ? undefined : ctx.deserialize(node.d),
    ),
});

const FunctionPlugin = createPlugin<object, ReferenceNode>({
  tag: 'brumate/function',
  skipPlainObjects: true,
  test: (value) => typeof value === 'function' && functionReferences.has(value),
  parse: parsers((value) => {
    const reference = functionReferences.get(value)!;
    // The arguments of a handler that `$handler` made go with it.
    const node: Record<string, unknown> = { a: reference.ref, b: reference.scope };
    // The modifiers of its wrappers, so a spread in markup that the browser renders writes them.
    const modifiers = (value as { [MODIFIERS]?: string[] })[MODIFIERS];
    if (reference.args !== undefined || modifiers) {
      node.c = reference.args ?? null;
    }
    if (modifiers) {
      node.d = modifiers;
    }
    return node as Record<'a' | 'b' | 'c' | 'd', unknown>;
  }),
  serialize: (node, ctx) =>
    `$b.f(${[node.a, node.b, node.c, node.d]
      .filter((part) => part !== undefined)
      .map((part) => ctx.serialize(part!))
      .join(',')})`,
  deserialize: (node, ctx) =>
    stateValues.f(
      ctx.deserialize<string>(node.a),
      ctx.deserialize<number>(node.b),
      node.c === undefined ? undefined : ctx.deserialize<unknown[] | null>(node.c),
      node.d === undefined ? undefined : ctx.deserialize<string[]>(node.d),
    ),
});

/** A handler that merges the handlers of one event, as the parts that refer to client functions. */
const MergedPlugin = createPlugin<object, { a: SerovalNode }>({
  tag: 'brumate/merged',
  skipPlainObjects: true,
  test: (value) => typeof value === 'function' && PARTS in value,
  parse: parsers((value) => {
    const parts: object[] = [];
    for (const part of (value as { [PARTS]: object[] })[PARTS]) {
      if (functionReferences.has(part)) {
        parts.push(part);
      }
    }
    return { a: parts };
  }),
  serialize: (node, ctx) => `$b.m(${ctx.serialize(node.a)})`,
  deserialize: (node, ctx) => stateValues.m(ctx.deserialize(node.a)),
});

/**
 * A value of an attribute that brumate writes, which a live rest prop can hold. The ones that
 * reach the page state are the scoped style attribute and `b-v`. The error "holds a Internal"
 * no longer catches any other, so a new one needs a check of its own.
 */
const InternalPlugin = createPlugin<Internal, { a: SerovalNode }>({
  tag: 'brumate/internal',
  skipPlainObjects: true,
  test: (value) => value instanceof Internal,
  parse: parsers((value) => ({ a: value.value })),
  serialize: (node, ctx) => `$b.i(${ctx.serialize(node.a)})`,
  deserialize: (node, ctx) => stateValues.i(ctx.deserialize(node.a)),
});

/** Children of a component, as the export that renders them in the browser. */
const ChildrenPlugin = createPlugin<object, ReferenceNode>({
  tag: 'brumate/children',
  skipPlainObjects: true,
  test: (value) => typeof value === 'object' && value !== null && CHILDREN_REF in value,
  parse: parsers((value) => {
    const reference = (value as { [CHILDREN_REF]: ChildrenReference })[CHILDREN_REF];
    const node: Record<string, unknown> = { a: reference.ref, b: reference.scope };
    // The scope and the anchor of the insert where the server rendered them.
    if (reference.at !== undefined) {
      node.c = reference.at;
      node.d = reference.anchor;
    }
    return node as Record<'a' | 'b' | 'c' | 'd', unknown>;
  }),
  serialize: (node, ctx) =>
    `$b.n(${[node.a, node.b, node.c, node.d]
      .filter((part) => part !== undefined)
      .map((part) => ctx.serialize(part!))
      .join(',')})`,
  deserialize: (node, ctx) =>
    stateValues.n(
      ctx.deserialize<string>(node.a),
      ctx.deserialize<ScopeId>(node.b!),
      node.c === undefined ? undefined : ctx.deserialize<ScopeId>(node.c),
      node.d === undefined ? undefined : ctx.deserialize<number>(node.d),
    ),
});

/**
 * A memo that failed on the server. The page state holds its error, so a read in the browser
 * throws it, as a memo that failed there. The server writes the error that is safe to send. See
 * `stateValue`.
 */
const MemoErrorPlugin = createPlugin<MemoError, { e: SerovalNode }>({
  tag: 'brumate/memo-error',
  skipPlainObjects: true,
  // The server marks the errors it holds, so the copies of the runtime agree on them.
  test: (value) =>
    typeof value === 'object' && value !== null && Symbol.for('brumate.held') in value,
  parse: parsers((value) => ({ e: value.error })),
  serialize: (node, ctx) => `$b.x(${ctx.serialize(node.e)})`,
  deserialize: (node, ctx) => stateValues.x(ctx.deserialize(node.e)),
});

/** HTML, such as the `children` of a component, so the client can insert it again. */
const RawPlugin = createPlugin<Raw, { h: SerovalNode }>({
  tag: 'brumate/raw',
  skipPlainObjects: true,
  test: isRaw,
  parse: parsers((value) => ({ h: rawHTML(value) })),
  serialize: (node, ctx) => `$b.r(${ctx.serialize(node.h)})`,
  deserialize: (node, ctx) => stateValues.r(ctx.deserialize<string>(node.h)),
});

/** A component in the page state, such as the value of a dynamic tag. See `stateValues.c`. */
const ComponentPlugin = createPlugin<ComponentValue, { c: SerovalNode }>({
  tag: 'brumate/component',
  skipPlainObjects: true,
  test: (value) =>
    typeof value === 'function' && typeof (value as Partial<ComponentValue>).brumateId === 'string',
  parse: parsers((value) => ({ c: value.brumateId })),
  serialize: (node, ctx) => `$b.c(${ctx.serialize(node.c)})`,
  deserialize: (node, ctx) => stateValues.c(ctx.deserialize<string>(node.c)),
});

/**
 * Files and blobs, which go only in the arguments of a call, as parts of
 * multipart form data named `file<index>`. The node holds the index. The
 * call passes `sent`, which gets each blob, and the server passes the form
 * that it `received`, whose files the indexes read. Without them, as in the
 * page state and in the answer of a call, a blob throws.
 */
export function uploadPlugin(sent?: Blob[], received?: FormData): Plugin<Blob, { i: SerovalNode }> {
  return createPlugin<Blob, { i: SerovalNode }>({
    tag: 'brumate/upload',
    skipPlainObjects: true,
    test: isBlob,
    parse: parsers((value) => {
      if (!sent) {
        throw new Error('A file or a blob can only be sent in the arguments of a server function');
      }
      return { i: sent.push(value) - 1 };
    }),
    serialize: () => {
      throw new Error('A file or a blob can only be sent in the arguments of a server function');
    },
    deserialize: (node, ctx) => {
      const file = received?.get(`file${ctx.deserialize<number>(node.i)}`);
      if (!(file instanceof Blob)) {
        throw new TypeError('A file of the call is missing');
      }
      return file;
    },
  });
}

/**
 * The plugin of `AbortSignal` from seroval-plugins, which sends whether the
 * signal aborted and its reason. The one of seroval-plugins waits for a live
 * signal to abort, so a call with one would not be sent, and a page or an
 * answer with one would not end.
 */
const SignalPlugin: typeof AbortSignalPlugin = {
  ...AbortSignalPlugin,
  parse: {
    sync: AbortSignalPlugin.parse.sync,
    stream: AbortSignalPlugin.parse.sync,
    async: async (value, ctx) => (value.aborted ? { reason: await ctx.parse(value.reason) } : {}),
  },
};

/**
 * The plugin of `Request` from seroval-plugins, whose body streams in the
 * stream mode. A request with a stream body needs `duplex: 'half'`, or its
 * constructor throws, so the plugin adds it.
 */
const BodyRequestPlugin: typeof RequestPlugin = {
  ...RequestPlugin,
  serialize: (node, ctx) =>
    `new Request(${ctx.serialize(node.url)},Object.assign(${ctx.serialize(node.options)},{duplex:"half"}))`,
  deserialize: (node, ctx) =>
    new Request(
      ctx.deserialize(node.url) as string,
      {
        ...(ctx.deserialize(node.options) as RequestInit),
        duplex: 'half',
      } as RequestInit,
    ),
};

/** The plugins after the plugin of uploads, which a call makes for its files. */
// oxlint-disable-next-line typescript/no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
const valuePlugins: Plugin<any, any>[] = [
  ElementPlugin,
  SlotPlugin,
  BindingPlugin,
  FunctionPlugin,
  MergedPlugin,
  InternalPlugin,
  MemoErrorPlugin,
  ChildrenPlugin,
  RawPlugin,
  ComponentPlugin,
  // The web values of seroval-plugins. Requests and responses need the async or stream modes,
  // so a page state or a call result that holds one streams. The plugin of uploads takes files
  // and blobs, so those of seroval-plugins, which would put their bytes in the JSON, are left out.
  SignalPlugin,
  CustomEventPlugin,
  DOMExceptionPlugin,
  EventPlugin,
  FormDataPlugin,
  HeadersPlugin,
  ImageDataPlugin,
  ReadableStreamPlugin,
  BodyRequestPlugin,
  ResponsePlugin,
  URLPlugin,
  URLSearchParamsPlugin,
];

/**
 * The plugins of a call with files: `sent` gets the files that the call
 * sends, and `received` is the form that the server got them in.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
export function callPlugins(sent?: Blob[], received?: FormData): Plugin<any, any>[] {
  return [uploadPlugin(sent, received), ...valuePlugins];
}

/** The plugins of the page state, of answers and of calls without files. */
// oxlint-disable-next-line typescript/no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
export const plugins: Plugin<any, any>[] = callPlugins();

/**
 * Stops a sync mode at a value that only streams: an async iterable, such
 * as a `ReadableStream`. seroval writes one in a sync mode as a stream that
 * never gets its values, without an error.
 */
const StreamGuardPlugin = createPlugin<object, Record<string, never>>({
  tag: 'brumate/stream-guard',
  test: (value) =>
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) ||
    (typeof value === 'object' && value !== null && Symbol.asyncIterator in value),
  parse: {
    sync: () => {
      throw new Error('A stream needs the async or stream mode');
    },
  },
  serialize: () => '',
  deserialize: () => ({}),
});

/**
 * The plugins for the sync modes, which must throw for a value that only
 * streams, so the page state streams instead, and a call with a stream in
 * its arguments is not shared with another. The guard comes first, so it
 * takes a `ReadableStream` before the plugin of `ReadableStream`, which the
 * plugins of `Request` and `Response` bring in.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
export const syncPlugins: Plugin<any, any>[] = [StreamGuardPlugin, ...plugins];

/**
 * The seroval plugin of a plugin of the app. The page state writes its value
 * as `$b.u(tag, data)`, so the record does not need the class in scope.
 */
function appPlugin(plugin: ValuePlugin): Plugin<unknown, { d: SerovalNode }> {
  return createPlugin<unknown, { d: SerovalNode }>({
    tag: `app:${plugin.tag}`,
    test: plugin.test,
    parse: parsers((value) => ({ d: plugin.toData(value) })),
    serialize: (node, ctx) => `$b.u(${JSON.stringify(plugin.tag)},${ctx.serialize(node.d)})`,
    deserialize: (node, ctx) => plugin.fromData(ctx.deserialize(node.d)),
  });
}

// The plugins of the app come before brumate's, in each list, as the entry adds them. The
// plugin of uploads stays first in a call, and the guard of streams first in the sync modes.
onValuePlugin((plugin) => {
  const added = appPlugin(plugin);
  valuePlugins.unshift(added);
  plugins.splice(1, 0, added);
  syncPlugins.splice(2, 0, added);
});

/**
 * Features that are off in both directions:
 *
 * - Errors keep their name and message only. A stack trace would show the
 *   server's files and code to the browser.
 * - Regular expressions are not sent. A pattern from a client could take
 *   the server a long time to match, and reading one is refused as well.
 */
const BRUMATE_DISABLED = Feature.ErrorPrototypeStack | Feature.RegExp;

export let disabledFeatures: number = BRUMATE_DISABLED;
let depthLimit: number | undefined;

/** The options of every call of seroval: the features that are off, and the depth limit of the entry. */
export function serialOptions(): { disabledFeatures: number; depthLimit?: number } {
  return depthLimit === undefined ? { disabledFeatures } : { disabledFeatures, depthLimit };
}

onSerialOptions((options) => {
  disabledFeatures = options.disabledFeatures ?? BRUMATE_DISABLED;
  depthLimit = options.depthLimit;
  // oxlint-disable-next-line no-bitwise -- The features are flags.
  const enabled = BRUMATE_DISABLED & ~disabledFeatures;
  if (enabled !== 0) {
    console.warn(
      `The serial entry turns on ${enabled & Feature.RegExp ? 'RegExp' : 'ErrorPrototypeStack'}, which brumate turns off: ${enabled & Feature.RegExp ? 'a pattern from a client can take the server a long time to match' : 'a stack shows the files and code of the server to the browser'}.`,
    );
  }
});
