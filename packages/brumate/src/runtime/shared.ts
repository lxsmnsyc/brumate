import { createPlugin } from 'seroval';
import type { Plugin, SerovalNode } from 'seroval';

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

// oxlint-disable-next-line typescript/no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
export const plugins: Plugin<any, any>[] = [ElementPlugin, FunctionPlugin];

/** The state of one scope in the page. */
export interface ScopeState {
  /** Slot values, in the order of the scope's layout. */
  s?: unknown[];
  /** The scope IDs of child components, by anchor index. */
  c?: Record<number, number>;
}

/** The state of a page, by scope ID. */
export type PageState = Record<number, ScopeState>;
