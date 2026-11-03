// `$searchParam`: the value of a parameter of the query string. The server and the browser read
// it the same way, and the browser writes it back with `client/search.ts`.
import type { SearchParamOptions } from './signals.ts';
import { routeContext } from './context.ts';
import type { Context } from './context.ts';

/** The value of a parameter in a query string: its text parsed, or the default when it is absent. */
export function readParam(
  search: URLSearchParams,
  name: string,
  options?: SearchParamOptions<unknown>,
): unknown {
  const text = search.get(name);
  if (text === null) {
    return options?.default ?? null;
  }
  return options?.parse ? options.parse(text) : text;
}

/** The text of a value in the URL, or null for the default, which leaves the parameter out. */
export function writeParam(value: unknown, options?: SearchParamOptions<unknown>): string | null {
  const own = textOf(value, options);
  return own === textOf(options?.default, options) ? null : own;
}

function textOf(value: unknown, options?: SearchParamOptions<unknown>): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return options?.serialize ? options.serialize(value) : String(value);
}

/** `$searchParam` on the server: the parameter of the request's URL. */
export function searchParam(
  context: { consume<T>(context: Context<T>, scope: number): T },
  name: string,
  options?: SearchParamOptions<unknown>,
): unknown {
  return readParam(context.consume(routeContext, 0).search, name, options);
}
