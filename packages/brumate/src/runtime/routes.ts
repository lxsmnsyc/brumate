// Links to routes, checked against the route files. The Vite plugin writes
// the paths into `Routes` in a declaration file, such as
// `src/brumate-routes.d.ts`.

/**
 * The paths of the routes, with their params, such as
 * `'/todos/[id]': { id: string }`. The Vite plugin adds them.
 */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- Declaration files add the routes.
export interface Routes {}

/** A route path, such as `/todos/[id]`. Any string while no routes are declared. */
export type RoutePath = [keyof Routes] extends [never] ? string : keyof Routes & string;

/** The params of a route path, such as `{ id: string }` for `/todos/[id]`. */
export type RouteParams<P extends RoutePath> = P extends keyof Routes
  ? Routes[P]
  : Record<string, string>;

/** The arguments after the path: none for a path without params. */
type ParamsArgument<P extends RoutePath> = [keyof RouteParams<P>] extends [never]
  ? [params?: RouteParams<P>]
  : [params: RouteParams<P>];

/**
 * The URL of a route, with its params in place:
 * `href('/todos/[id]', { id: '3' })` is `/todos/3`. A rest param, such as
 * `[...path]`, keeps its slashes.
 */
export function href<P extends RoutePath>(path: P, ...[params]: ParamsArgument<P>): string {
  const values = (params ?? {}) as Record<string, string>;
  return path.replace(/\[(\.\.\.)?([^\]]+)\]/g, (_, rest: string | undefined, name: string) => {
    const value = values[name];
    if (value === undefined || value === '') {
      throw new Error(`The param ${name} of ${path} is missing`);
    }
    if (!rest) {
      return encodeURIComponent(String(value));
    }
    const parts: string[] = [];
    for (const part of String(value).split('/')) {
      parts.push(encodeURIComponent(part));
    }
    return parts.join('/');
  });
}

export interface NavigateOptions {
  /** Replaces the current entry of the history instead of adding one. */
  replace?: boolean;
  /** Scrolls to the top of the new page, or to its hash. Defaults to true. False keeps the place. */
  scroll?: boolean;
}

/**
 * Loads a page as a link does: the layouts that stay keep their state. It
 * returns when the page shows. A URL of another origin, or a page without
 * the loader, loads in full.
 *
 * ```ts
 * await navigate(href('/issues/[id]', { id: issue.id }));
 * navigate(`?q=${query}`, { replace: true });
 * ```
 */
export function navigate(to: string, options: NavigateOptions = {}): Promise<void> {
  const url = new URL(to, location.href);
  // A `javascript:` URL would run its script, so only web pages load.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return Promise.reject(new TypeError(`navigate loads http and https URLs, not ${url.protocol}`));
  }
  if (url.origin !== location.origin) {
    location.assign(url.href);
    return new Promise(() => {});
  }
  return new Promise((resolve) => {
    const event = new CustomEvent('brumate:navigate', {
      cancelable: true,
      detail: {
        url: url.href,
        replace: options.replace === true,
        scroll: options.scroll !== false,
        done: resolve,
      },
    });
    // The loader answers the event. Without it, the page loads in full.
    if (document.dispatchEvent(event)) {
      location.assign(url.href);
    }
  });
}
