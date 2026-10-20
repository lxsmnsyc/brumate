import type { Component } from './server.ts';

/** Imports the module of a route file. */
export type Loader = () => Promise<{ default: Component }>;

/** A folder of routes, as `virtual:brumate/routes` describes it. */
export interface RouteNode {
  /** `_layout.brm`. */
  layout?: Loader;
  /** `index.brm`, or the file of a segment, such as `about.brm`. */
  page?: Loader;
  /** `_default.brm`: what a slot renders when its routes do not match. */
  fallback?: Loader;
  /** Folders and files with a fixed segment. */
  static?: Record<string, RouteNode>;
  /** `[name]`: one segment, read as `params.name`. */
  dynamic?: { name: string; node: RouteNode };
  /** `[...name]`: the rest of the path, read as `params.name`. */
  rest?: { name: string; node: RouteNode };
  /** `@name` folders: routes that render in the `name` slot of the layout. */
  slots?: Record<string, RouteNode>;
}

/** A matched route: the component to render, and what renders in its slots. */
export interface RouteView {
  load: Loader;
  /**
   * The file and the params that the view depends on, such as
   * `/todos/[id]/_layout {"id":"3"}`. Two pages with the same key for a
   * layout render the same layout, so the client can keep it.
   */
  key: string;
  /** `children` and the named slots of a layout. */
  slots: Record<string, RouteView>;
}

export interface RouteMatch {
  view: RouteView;
  params: Record<string, string>;
}

function key(path: string, file: string, params: Record<string, string>): string {
  return `${path}/${file} ${JSON.stringify(params)}`;
}

/** `path` is the folders of `node` in the route files, such as `/todos/[id]`. */
function matchNode(
  node: RouteNode,
  segments: string[],
  params: Record<string, string>,
  path = '',
): RouteMatch | undefined {
  let inner: RouteMatch | undefined;
  if (segments.length === 0) {
    if (node.page) {
      inner = { view: { load: node.page, key: key(path, 'index', params), slots: {} }, params };
    }
  } else {
    const [first, ...rest] = segments as [string, ...string[]];
    const fixed = node.static?.[first];
    inner = fixed && matchNode(fixed, rest, params, `${path}/${first}`);
    if (!inner && node.dynamic) {
      const { name } = node.dynamic;
      inner = matchNode(node.dynamic.node, rest, { ...params, [name]: first }, `${path}/[${name}]`);
    }
    if (!inner && node.rest) {
      const { name } = node.rest;
      inner = matchNode(
        node.rest.node,
        [],
        { ...params, [name]: segments.join('/') },
        `${path}/[...${name}]`,
      );
    }
  }
  if (!inner || !node.layout) {
    return inner;
  }
  // A layout renders the matched route as `children`, and each slot matched against the same path.
  const slots: Record<string, RouteView> = { children: inner.view };
  for (const [name, slot] of Object.entries(node.slots ?? {})) {
    const match = matchNode(slot, segments, params, `${path}/@${name}`);
    if (match) {
      slots[name] = match.view;
    } else if (slot.fallback) {
      slots[name] = {
        load: slot.fallback,
        key: key(`${path}/@${name}`, '_default', params),
        slots: {},
      };
    }
  }
  return {
    view: { load: node.layout, key: key(path, '_layout', params), slots },
    params: inner.params,
  };
}

/** Finds the route for a path. */
export function matchRoute(tree: RouteNode, pathname: string): RouteMatch | undefined {
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  return matchNode(tree, segments, {});
}
