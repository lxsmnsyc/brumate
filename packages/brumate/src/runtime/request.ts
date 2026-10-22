import { toJSON } from 'seroval';
import { deleteCookie, getCookies, setCookie } from './cookies.ts';
import type { CookieOptions } from './cookies.ts';
import { disabledFeatures, plugins } from './serial.ts';

/**
 * What a request is for. A form post to a server function is a call, and a
 * form post to a page with `?__action=<id>` is a page.
 */
export type RequestKind = 'page' | 'endpoint' | 'call' | 'defer';

/**
 * Values that middleware hands to the components, server functions and
 * endpoints of a request, such as the user. An app adds fields to it:
 *
 * ```ts
 * declare module 'brumate/server' {
 *   interface Locals {
 *     user?: { id: string; name: string };
 *   }
 * }
 * ```
 */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- Apps add the fields.
export interface Locals {}

/** The server function that a request calls, with its arguments as they were read. */
export interface RequestCall {
  id: string;
  args: unknown[];
}

export interface RequestEventOptions {
  kind?: RequestKind;
  /**
   * Keeps work going after the response ends, such as the `waitUntil` of
   * Cloudflare Workers. Without it, the promise runs on its own and its
   * error is logged.
   */
  waitUntil?: (promise: Promise<unknown>) => void;
}

/**
 * A request that the server handles: a server function call, a form post,
 * a page render, or a call of middleware or an endpoint. Its methods read
 * the request and change the response. Get it with `getEvent()`.
 */
export class RequestEvent {
  readonly request: Request;
  /** What the request is for. */
  readonly kind: RequestKind;
  /** For a call, and a page that a form posted to, the server function and its arguments. */
  call?: RequestCall;
  /** Values for this request, which middleware writes and the rest of the request reads. */
  readonly locals: Locals = {};
  /** Headers to add to the response, such as `cache-control`. */
  readonly headers: Headers = new Headers();
  /** The status that `setStatus` set. */
  status?: number;
  /** Server functions that `refresh` named, whose memos the client loads again. */
  refreshed?: Set<unknown>;
  /** Cookies that this request set, or deleted with undefined, so later reads see them. */
  cookies?: Map<string, string | undefined>;
  private readonly keepGoing?: (promise: Promise<unknown>) => void;

  constructor(request: Request, options: RequestEventOptions = {}) {
    this.request = request;
    this.kind = options.kind ?? 'page';
    this.keepGoing = options.waitUntil;
  }

  /**
   * Keeps work going after the response ends, such as a log line or
   * analytics. On a host that stops a function when its response ends, the
   * server passes the promise to the host, through the `waitUntil` option.
   * Elsewhere the promise runs on its own, and its error is logged.
   */
  waitUntil(promise: Promise<unknown>): void {
    if (this.keepGoing) {
      this.keepGoing(promise);
    } else {
      promise.catch((error: unknown) => console.error(error));
    }
  }

  /**
   * Sets the status of the page response, such as 404 for a page that shows
   * that nothing was found. It works while the first render of a page runs.
   * Markup that streams later, such as a `#loading` body, cannot change it,
   * because the response has started by then.
   */
  setStatus(status: number): void {
    this.status = status;
  }

  /**
   * Asks the client to load again the memos that call a server function, such
   * as a list after a server function adds to it. The compiler gives those
   * memos client code, so they can load.
   */
  refresh(fn: (...args: never[]) => unknown): void {
    this.refreshed ??= new Set();
    this.refreshed.add(unwrap(fn));
  }

  /** The cookies of the request, with the ones that this request set or deleted. */
  getCookies(): Record<string, string> {
    return getCookies(this);
  }

  /** A cookie of the request, or the value that this request set. */
  getCookie(name: string): string | undefined {
    return getCookies(this)[name];
  }

  /**
   * Sets a cookie on the response. It is `HttpOnly`, `SameSite=Lax` and on
   * the path `/` unless the options say otherwise, and `Secure` on HTTPS.
   * Markup that streams later, such as a `#loading` body, cannot set cookies,
   * because the response has started.
   */
  setCookie(name: string, value: string, options: CookieOptions = {}): void {
    setCookie(this, name, value, options);
  }

  /** Deletes a cookie. Pass the `path` and `domain` that it was set with, if they were not the defaults. */
  deleteCookie(name: string, options: Pick<CookieOptions, 'path' | 'domain'> = {}): void {
    deleteCookie(this, name, options);
  }
}

/**
 * The event of the code that runs now. The runtime sets it while it calls a
 * server function, middleware, an endpoint or a memo, and clears it as soon
 * as the call returns, which is at its first `await`. One request at a time
 * runs until an `await`, so it is never the event of another request.
 */
let current: RequestEvent | undefined;
/** The results of server function calls of the render that runs now, by function and arguments. */
let currentCalls: Map<string, unknown> | undefined;

/**
 * Runs a callback with an event, so `getEvent()` in its code before its first
 * `await` returns it. Returns what the callback returns, such as its promise.
 * `calls`, while a page renders, lets calls with the same arguments share a result.
 */
export function withEvent<T>(
  event: RequestEvent | undefined,
  callback: () => T,
  calls?: Map<string, unknown>,
): T {
  const outer = current;
  const outerCalls = currentCalls;
  current = event;
  currentCalls = calls;
  try {
    return callback();
  } finally {
    current = outer;
    currentCalls = outerCalls;
  }
}

/**
 * Returns the event of the request that the server handles: in a server
 * function, middleware or an endpoint, or while a component renders.
 *
 * Call it before the first `await` of the function, and keep it in a
 * variable. After an `await`, other requests may have run, so it throws.
 *
 * ```ts
 * async function save(todo: Todo) {
 *   'use server';
 *   const event = getEvent();
 *   await db.save(todo);
 *   event.setCookie('saved', todo.id);
 * }
 * ```
 */
export function getEvent(): RequestEvent {
  if (!current) {
    throw new Error(
      'getEvent() works in server functions, middleware and endpoints before their first await, and while a component renders. Call it at the start of the function, keep the event in a variable, and pass it to helpers',
    );
  }
  return current;
}

/**
 * Middleware that runs for every request of the app: pages, endpoints,
 * server function calls, form posts and the requests for `#defer` bodies.
 * It answers the request itself, or calls `next` for the answer and returns
 * it, changed or not. `event.kind` says what the request is for.
 */
export type EntryMiddleware = (
  event: RequestEvent,
  next: () => Promise<Response>,
) => Response | Promise<Response>;

/**
 * Types the middleware of the entry file, `src/middleware.ts`, which the
 * Vite plugin runs for every request:
 *
 * ```ts
 * export default defineMiddleware(async (event, next) => {
 *   event.locals.user = await readUser(event);
 *   return next();
 * });
 * ```
 */
export function defineMiddleware(middleware: EntryMiddleware): EntryMiddleware {
  return middleware;
}

/**
 * Runs the middleware of the entry, when there is one, around an answer.
 * `getEvent()` works in the middleware before its first `await`.
 */
export function runEntry(
  middleware: EntryMiddleware | undefined,
  event: RequestEvent,
  answer: () => Promise<Response>,
): Promise<Response> {
  if (!middleware) {
    return answer();
  }
  return Promise.resolve(withEvent(event, () => middleware(event, answer)));
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
    const cache = currentCalls;
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
