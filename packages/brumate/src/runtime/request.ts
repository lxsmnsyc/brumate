import { AsyncLocalStorage } from 'node:async_hooks';
import { toJSON } from 'seroval';
import { disabledFeatures, plugins } from './shared.ts';

/** What the server sets on the response while it handles a request. */
export interface ResponseParts {
  /** Headers to add to the response, such as `set-cookie`. */
  headers: Headers;
  /** The status that `setStatus` set. */
  status?: number;
  /** Server functions that `refresh` named, whose memos the client loads again. */
  refreshed?: Set<unknown>;
  /** Cookies that this request set, or deleted with undefined, so later reads see them. */
  cookies?: Map<string, string | undefined>;
}

interface RequestContext {
  request: Request;
  response: ResponseParts;
}

const storage = new AsyncLocalStorage<RequestContext>();
/** The results of server function calls while a page renders, by function and arguments. */
const calls = new AsyncLocalStorage<Map<string, unknown>>();

/**
 * Runs a render, so calls of the same server function with the same
 * arguments share one result, such as two components that load one user.
 */
export function withCallCache<T>(callback: () => T): T {
  return calls.run(new Map(), callback);
}

/**
 * Wraps a server function, so its calls while a page renders share a result
 * when their arguments are the same. Calls from the browser, which are
 * requests of their own, always run, so a function that changes something
 * runs each time.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
export function dedupe<F extends (...args: any[]) => unknown>(fn: F, id: string): F {
  const wrapper = ((...args: unknown[]) => {
    const cache = calls.getStore();
    if (!cache) {
      return fn(...args);
    }
    let key: string;
    try {
      key = `${id} ${JSON.stringify(toJSON(args, { plugins, disabledFeatures }))}`;
    } catch {
      // Arguments that cannot be compared, such as a promise.
      return fn(...args);
    }
    if (!cache.has(key)) {
      cache.set(key, fn(...args));
    }
    return cache.get(key);
  }) as F;
  Object.defineProperty(wrapper, ORIGINAL, { value: fn });
  return wrapper;
}

/**
 * The function that `dedupe` wrapped, on its wrapper. A symbol of the
 * registry, so two copies of the runtime agree on it.
 */
const ORIGINAL = Symbol.for('brumate.original');

/**
 * The server function itself, for a wrapper that `dedupe` made. `refresh`
 * and `$action` compare server functions, and the registry holds them unwrapped.
 */
export function unwrap<T>(fn: T): T {
  return ((fn as Record<symbol, T | undefined> | null)?.[ORIGINAL] ?? fn) as T;
}

/** Runs a callback with a request, so `getRequest` can read it. */
export function withRequest<T>(request: Request, response: ResponseParts, callback: () => T): T {
  return storage.run({ request, response }, callback);
}

/** The request and the response of the request being handled. */
export function currentRequest(name: string): RequestContext {
  return current(name);
}

function current(name: string): RequestContext {
  const context = storage.getStore();
  if (!context) {
    throw new Error(
      `${name}() works only in server functions, middleware, endpoints, and while rendering with the request option`,
    );
  }
  return context;
}

/** Returns the request of the server function call or the page being rendered. */
export function getRequest(): Request {
  return current('getRequest').request;
}

/** Returns the headers to add to the response, such as `set-cookie`. */
export function getResponseHeaders(): Headers {
  return current('getResponseHeaders').response.headers;
}

/**
 * Asks the client to load again the memos that call a server function, such
 * as a list after a server function adds to it. Call it in a server
 * function. The compiler gives those memos client code, so they can load.
 */
export function refresh(fn: (...args: never[]) => unknown): void {
  const response = current('refresh').response;
  response.refreshed ??= new Set();
  response.refreshed.add(unwrap(fn));
}

/**
 * Sets the status of the page response, such as 404 for a page that shows
 * that nothing was found. It works while the first render of a page runs.
 * Markup that streams later, such as a `#loading` body, cannot change it,
 * because the response has started by then.
 */
export function setStatus(status: number): void {
  current('setStatus').response.status = status;
}

/**
 * An error whose message reaches the client. A server function call that
 * throws it rejects with the message, and the response has its status.
 * Other errors reach the client as a generic message, so server details stay
 * on the server.
 */
export class ServerError extends Error {
  readonly status: number;

  constructor(message: string, options: { status?: number } = {}) {
    super(message);
    this.name = 'ServerError';
    this.status = options.status ?? 400;
  }
}

/** Thrown by `redirect`. */
export class Redirect extends Error {
  readonly location: string;
  readonly status: number;

  constructor(location: string, status: number) {
    super(`Redirect to ${location}`);
    this.name = 'Redirect';
    this.location = location;
    this.status = status;
  }
}

/**
 * Stops a server function and sends the browser to another page. While a
 * page renders, the error reaches the caller of `render`, which can
 * answer with a redirect.
 */
export function redirect(location: string, status = 303): never {
  throw new Redirect(location, status);
}

export function isRedirect(error: unknown): error is Redirect {
  return error instanceof Redirect;
}
