import { Feature, createPlugin } from 'seroval';
import type { Plugin, SerovalNode } from 'seroval';
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

const ElementPlugin = createPlugin<ElementReference, ReferenceNode>({
  tag: 'brumate/element',
  test: (value) => value instanceof ElementReference,
  parse: {
    sync: (value, ctx) => ({ a: ctx.parse(value.scope), b: ctx.parse(value.anchor) }),
    async: async (value, ctx) => ({
      a: await ctx.parse(value.scope),
      b: await ctx.parse(value.anchor),
    }),
    stream: (value, ctx) => ({ a: ctx.parse(value.scope), b: ctx.parse(value.anchor) }),
  },
  serialize: (node, ctx) => `{s:${ctx.serialize(node.a)},a:${ctx.serialize(node.b)}}`,
  deserialize: (node, ctx) =>
    new ElementReference(ctx.deserialize<number>(node.a), ctx.deserialize<number>(node.b)),
});

const FunctionPlugin = createPlugin<object, ReferenceNode>({
  tag: 'brumate/function',
  test: (value) => typeof value === 'function' && functionReferences.has(value),
  parse: {
    sync: (value, ctx) => {
      const reference = functionReferences.get(value)!;
      return { a: ctx.parse(reference.ref), b: ctx.parse(reference.scope) };
    },
    async: async (value, ctx) => {
      const reference = functionReferences.get(value)!;
      return { a: await ctx.parse(reference.ref), b: await ctx.parse(reference.scope) };
    },
    stream: (value, ctx) => {
      const reference = functionReferences.get(value)!;
      return { a: ctx.parse(reference.ref), b: ctx.parse(reference.scope) };
    },
  },
  serialize: (node, ctx) => `{r:${ctx.serialize(node.a)},s:${ctx.serialize(node.b)}}`,
  deserialize: (node, ctx) =>
    new FunctionReference(ctx.deserialize<string>(node.a), ctx.deserialize<number>(node.b)),
});

/** HTML, such as the `children` of a component, so the client can insert it again. */
const RawPlugin = createPlugin<Raw, { h: SerovalNode }>({
  tag: 'brumate/raw',
  test: isRaw,
  parse: {
    sync: (value, ctx) => ({ h: ctx.parse(rawHTML(value)) }),
    async: async (value, ctx) => ({ h: await ctx.parse(rawHTML(value)) }),
    stream: (value, ctx) => ({ h: ctx.parse(rawHTML(value)) }),
  },
  serialize: (node, ctx) => ctx.serialize(node.h),
  deserialize: (node, ctx) => raw(ctx.deserialize<string>(node.h)),
});

// oxlint-disable-next-line typescript/no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
export const plugins: Plugin<any, any>[] = [ElementPlugin, FunctionPlugin, RawPlugin];

/**
 * Errors keep their name and message only. A stack trace would show the
 * server's files and code to the browser.
 */
export const disabledFeatures: number = Feature.ErrorPrototypeStack;

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
