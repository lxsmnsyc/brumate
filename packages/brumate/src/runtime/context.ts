/** A value that a component provides to the components inside it. */
export interface Context<T> {
  /** The same on the server and the client, so the page state can name the context. */
  readonly key: string;
  /** Only for the type: a context holds no value, and a component reads the value that a provider gave. */
  readonly __type?: T;
}

/**
 * Creates a context. `key` names it in the page state, so it must be unique
 * in the app and the same on the server and the client.
 */
export function createContext<T>(key: string): Context<T> {
  return { key };
}

/** The error of a read of a context that no provider above the reader set. */
export function missingContext(key: string): Error {
  return new Error(
    `The context "${key}" has no provider above this component. Provide it with $setContext, or in a parent that does`,
  );
}

/** The route of the page, for `$route`. */
export interface Route<P = Record<string, string>> {
  /** The URL of the page. */
  url: URL;
  /** The query string of the page, as `url.searchParams`. */
  search: URLSearchParams;
  /** The params of the route, such as `{ id: '3' }` for `/issues/[id]`. */
  params: P;
}

/** The navigation that loads, for `$navigation`. */
export interface NavigationState {
  /** True while a page loads without a full page load. */
  pending: boolean;
  /** The URL of the page that is left, while one loads. */
  from?: string;
  /** The URL of the page that loads. */
  to?: string;
}

/** The key of the context of `$route`. The server and the loader write it. */
export const ROUTE_KEY = 'brumate.route';
/** The key of the context of `$navigation`. The loader writes it. */
export const NAVIGATION_KEY = 'brumate.navigation';

/** The context that `$route` reads. Its value comes from the request on the server, and from `location` in the browser. */
export const routeContext: Context<Route> = createContext(ROUTE_KEY);

/** The context that `$navigation` reads. The loader writes it while a page loads. */
export const navigationContext: Context<NavigationState> = createContext(NAVIGATION_KEY);
