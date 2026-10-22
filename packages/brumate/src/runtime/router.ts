import type { Component } from './server.ts';

/** Imports the module of a route file. */
export type Loader = () => Promise<{ default: Component }>;

/** Answers a request at the path of an endpoint, for one method. */
export type Handler = (
  request: Request,
  params: Record<string, string>,
) => Response | Promise<Response>;

/**
 * Runs before the routes of a folder. It answers the request itself, or
 * calls `next` for the answer of the route and returns it, changed or not.
 */
export type Middleware = (
  request: Request,
  next: () => Promise<Response>,
) => Response | Promise<Response>;

/** Imports `_middleware.ts`. */
export type MiddlewareLoader = () => Promise<{ middleware: Middleware }>;

/** Imports an endpoint: a module that exports a handler for each method, such as `GET`. */
export type EndpointLoader = () => Promise<Partial<Record<string, Handler>>>;

/** A folder of routes, as `virtual:brumate/routes` describes it. */
export interface RouteNode {
  /** `_layout.brm`. */
  layout?: Loader;
  /** `index.brm`, or the file of a segment, such as `about.brm`. */
  page?: Loader;
  /** `_default.brm`: what a slot renders when its routes do not match. */
  fallback?: Loader;
  /** `_error.brm`: renders when a route of the folder throws, or when no route matches. */
  error?: Loader;
  /** `_loading.brm`: shows while a route of the folder streams in. */
  loading?: Loader;
  /** `_middleware.ts`: runs before the routes of the folder. */
  middleware?: MiddlewareLoader;
  /** A `.ts` file at this path, such as `api/todos.ts`. */
  endpoint?: EndpointLoader;
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
  /** `_loading.brm` of the folder: the view streams in, and this shows until then. */
  loading?: Loader;
}

export interface RouteMatch {
  view: RouteView;
  params: Record<string, string>;
  /** The pattern of the route files that matched, such as `/todos/[id]`, or `/` for the root. */
  route: string;
  /** The endpoint at the path, if the folder has one. */
  endpoint?: EndpointLoader;
  /** The middleware of the folders on the path, from the outside in. */
  middleware: MiddlewareLoader[];
  /**
   * Views that show an error in place of the route, from the innermost
   * `_error.brm` to the outermost. Each renders inside the layouts above it.
   */
  errors: RouteView[];
}

/** A layout and the slots that it renders around a view. */
interface Wrapper {
  layout: Loader;
  key: string;
  slots: Record<string, RouteView>;
}

function key(path: string, file: string, params: Record<string, string>): string {
  return `${path}/${file} ${JSON.stringify(params)}`;
}

/** Puts a view in the children slot of a layout, with its other slots. */
function wrap(view: RouteView, wrapper: Wrapper | undefined): RouteView {
  return wrapper
    ? { load: wrapper.layout, key: wrapper.key, slots: { ...wrapper.slots, children: view } }
    : view;
}

/** The layout of a folder, or undefined when it has none. */
function wrapperOf(
  node: RouteNode,
  segments: string[],
  index: number,
  params: Record<string, string>,
  path: string,
): Wrapper | undefined {
  return node.layout
    ? {
        layout: node.layout,
        key: key(path, '_layout', params),
        slots: namedSlots(node, segments, index, params, path),
      }
    : undefined;
}

/** The `_error.brm` of a folder, inside its layout. */
function errorIn(
  error: Loader,
  wrapper: Wrapper | undefined,
  params: Record<string, string>,
  path: string,
): RouteView {
  return wrap({ load: error, key: key(path, ERROR_VIEW, params), slots: {} }, wrapper);
}

/** The slots of a layout other than `children`, each matched against the same path. */
function namedSlots(
  node: RouteNode,
  segments: string[],
  index: number,
  params: Record<string, string>,
  path: string,
): Record<string, RouteView> {
  const slots: Record<string, RouteView> = {};
  for (const [name, slot] of Object.entries(node.slots ?? {})) {
    const match = matchNode(slot, segments, index, params, `${path}/@${name}`);
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
  return slots;
}

/** The view of an `_error.brm`. Its component gets the error as a prop. */
const ERROR_VIEW = '_error';

/**
 * Matches the segments from `index` on. `path` is the folders of `node` in
 * the route files, such as `/todos/[id]`.
 */
function matchNode(
  node: RouteNode,
  segments: string[],
  index: number,
  params: Record<string, string>,
  path = '',
): RouteMatch | undefined {
  let inner: RouteMatch | undefined;
  if (index === segments.length) {
    if (node.page || node.endpoint) {
      inner = {
        view: { load: node.page ?? missingPage, key: key(path, 'index', params), slots: {} },
        params,
        route: path || '/',
        endpoint: node.endpoint,
        middleware: [],
        errors: [],
      };
    }
  } else {
    const first = segments[index]!;
    const fixed = node.static?.[first];
    inner = fixed && matchNode(fixed, segments, index + 1, params, `${path}/${first}`);
    if (!inner && node.dynamic) {
      const { name } = node.dynamic;
      inner = matchNode(
        node.dynamic.node,
        segments,
        index + 1,
        { ...params, [name]: first },
        `${path}/[${name}]`,
      );
    }
    if (!inner && node.rest) {
      const { name } = node.rest;
      inner = matchNode(
        node.rest.node,
        segments,
        segments.length,
        { ...params, [name]: segments.slice(index).join('/') },
        `${path}/[...${name}]`,
      );
    }
  }
  if (!inner) {
    return undefined;
  }
  // The route of the folder streams in after its layout, with the loading file until then.
  const content: RouteView = node.loading ? { ...inner.view, loading: node.loading } : inner.view;
  const wrapper = wrapperOf(node, segments, index, params, path);
  const errors = wrapper ? inner.errors.map((view) => wrap(view, wrapper)) : inner.errors;
  if (node.error) {
    errors.push(errorIn(node.error, wrapper, params, path));
  }
  return {
    view: wrap(content, wrapper),
    params: inner.params,
    route: inner.route,
    endpoint: inner.endpoint,
    middleware: node.middleware ? [node.middleware, ...inner.middleware] : inner.middleware,
    errors,
  };
}

/** An endpoint without a page: a GET that it does not answer has no page either. */
export const missingPage: Loader = () => {
  throw new Error('This path has an endpoint and no page');
};

/** Finds the route for a path. A path with a malformed escape, such as `/%E0`, matches none. */
export function matchRoute(tree: RouteNode, pathname: string): RouteMatch | undefined {
  let segments: string[];
  try {
    segments = pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return undefined;
  }
  return matchNode(tree, segments, 0, {});
}

/**
 * The views for a path that no route matches: the `_error.brm` of the
 * root, inside the root layout, and the root middleware.
 */
export function notFound(tree: RouteNode): Pick<RouteMatch, 'errors' | 'middleware'> {
  return {
    errors: tree.error ? [errorIn(tree.error, wrapperOf(tree, [], 0, {}, ''), {}, '')] : [],
    middleware: tree.middleware ? [tree.middleware] : [],
  };
}
