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
    return rest
      ? String(value).split('/').map(encodeURIComponent).join('/')
      : encodeURIComponent(String(value));
  });
}
