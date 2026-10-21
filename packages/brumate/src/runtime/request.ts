import { AsyncLocalStorage } from 'node:async_hooks';

/** What the server sets on the response while it handles a request. */
export interface ResponseParts {
  /** Headers to add to the response, such as `set-cookie`. */
  headers: Headers;
  /** The status that `setStatus` set. */
  status?: number;
  /** Server functions that `refresh` named, whose memos the client loads again. */
  refreshed?: Set<unknown>;
}

interface RequestContext {
  request: Request;
  response: ResponseParts;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs a callback with a request, so `getRequest` can read it. */
export function withRequest<T>(request: Request, response: ResponseParts, callback: () => T): T {
  return storage.run({ request, response }, callback);
}

function current(name: string): RequestContext {
  const context = storage.getStore();
  if (!context) {
    throw new Error(
      `${name}() works only in server functions, and while rendering with the request option`,
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
  response.refreshed.add(fn);
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
