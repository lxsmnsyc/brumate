// Renders a component on the server and resumes it in the DOM of a test, as
// a page does: the HTML and the state first, then the loader, which loads
// client code when an event fires. `visit` does the same for a route, with
// the requests of the page answered by the routes of the app.

import type { ClientModule } from './client.ts';
import { start } from './loader.ts';
import { wholeNodes } from './nodes.ts';
import { handleRequest, render } from './server.ts';
import type { Component, EntryMiddleware, RenderOptions } from './server.ts';

/** The middleware of files of server functions, by function ID. */
type FileMiddleware = Record<string, EntryMiddleware>;

export interface TestingOptions {
  /** Imports the client module of a component, by component ID. */
  load: (id: string) => Promise<ClientModule>;
  /** The URL prefix of server function calls. */
  rpc?: string;
}

/** What a test does with the page, as a user does. */
export interface Actions {
  /** The first element that matches a selector. Throws if none does. */
  get: (selector: string) => HTMLElement;
  /** The text of the first element that matches a selector. */
  text: (selector: string) => string;
  /** Clicks an element. */
  click: (selector: string) => void;
  /** Types a value into a field, and fires `input`. */
  input: (selector: string, value: string) => void;
  /** Submits a form, as its submit button does. */
  submit: (selector: string) => void;
  /**
   * Retries an assertion until it passes. The first event of a test loads
   * client code, so its effects arrive a moment later.
   */
  waitFor: (assertion: () => void, timeout?: number) => Promise<void>;
}

export interface Mounted extends Actions {
  /** The element that holds the component. */
  container: HTMLElement;
  /** Stops the loader and removes the component. */
  unmount: () => void;
}

/** The actions on the elements inside `root`. */
function actions(root: ParentNode): Actions {
  const get = (selector: string): HTMLElement => {
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) {
      throw new Error(`No element matches ${selector}`);
    }
    return element;
  };
  return {
    get,
    text: (selector) => get(selector).textContent ?? '',
    click: (selector) => get(selector).click(),
    input: (selector, value) => {
      const field = get(selector) as HTMLInputElement;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    },
    submit: (selector) => {
      get(selector).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    },
    waitFor: async (assertion, timeout = 2000) => {
      const until = Date.now() + timeout;
      for (;;) {
        try {
          assertion();
          return;
        } catch (error) {
          if (Date.now() > until) {
            throw error;
          }
          // oxlint-disable-next-line no-await-in-loop -- It waits between tries.
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    },
  };
}

/**
 * Runs an inline script, as a browser does when it adds one. The DOM of a
 * test does not run scripts. The script is `document.currentScript` while it
 * runs, so a state record hands its script to the core.
 */
function run(script: Element): void {
  Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
  try {
    // oxlint-disable-next-line no-eval -- The script is a state record or the swap code from the server.
    (0, eval)(script.textContent!);
  } finally {
    delete (document as { currentScript?: unknown }).currentScript;
  }
}

/**
 * Appends markup that streams in later, such as a `#loading` body, and runs
 * its inline scripts in order.
 */
function append(container: HTMLElement, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  // A copy, because appending moves nodes out of the live list.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const node of [...template.content.childNodes]) {
    container.append(node);
    if (node.nodeName === 'SCRIPT' && !(node as Element).hasAttribute('type')) {
      run(node as Element);
    }
  }
}

/** Renders a component on the server and resumes it in the document of a test. */
export type Mount = <P>(
  component: Component<P>,
  props: P,
  renderOptions?: RenderOptions,
) => Promise<Mounted>;

/** Mounts so far, so each starts its scope IDs at a number of its own. */
let mounts = 0;
/** The loader that the mounts of the document share, and how many mounts use it. */
let loader: { stop: () => void; users: number } | undefined;

/** Returns `mount`, which loads client modules with `options.load`. */
export function createMount(options: TestingOptions): Mount {
  /**
   * Renders a component on the server, puts it in the document with its
   * state, and starts the loader. Markup that streams in later is added as
   * it arrives.
   */
  return async function mount<P>(
    component: Component<P>,
    props: P,
    renderOptions: RenderOptions = {},
  ): Promise<Mounted> {
    // IDs of their own, so two mounts in a file do not share scopes or state references.
    const base = renderOptions.base ?? ++mounts * 1_000_000;
    const { html, state, pending } = await render(component, props, { ...renderOptions, base });
    const container = document.createElement('div');
    container.innerHTML = html + state;
    document.body.append(container);
    // The page state, which waits for the core.
    container.querySelectorAll('script[b-state]').forEach(run);
    // One loader for the document, as a page has, however many mounts are in it.
    loader ??= {
      stop: start({ load: options.load, rpc: options.rpc, navigate: false, preload: false }),
      users: 0,
    };
    loader.users++;
    let mounted = true;
    const stop = (): void => {
      if (!mounted || !loader) {
        return;
      }
      mounted = false;
      if (--loader.users === 0) {
        loader.stop();
        loader = undefined;
      }
    };
    void (async () => {
      for await (const chunk of pending) {
        append(container, chunk);
      }
    })();
    return {
      container,
      ...actions(container),
      unmount: () => {
        stop();
        container.remove();
        // The core forgets the scopes of this mount, so a refresh later does not load its memos.
        void import('./client.ts').then((core) => core.removeRoot(String(base)));
      },
    };
  };
}

/** Server functions by ID, as `functions` of `virtual:brumate/server` has them. */
// oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
export type ServerFunctions = Record<string, (...args: any[]) => unknown>;

export interface AnswerOptions {
  /** The URL prefix of server function calls. Defaults to `/_brumate`. */
  rpc?: string;
  /** Called with the ID of each call, such as `issues_1a2b#toggleStar`, before it runs. */
  onCall?: (id: string) => void;
  /** The middleware of the entry, which runs before each call. `virtual:brumate/testing` passes the app's. */
  middleware?: EntryMiddleware;
  /**
   * The middleware of each `'use server'` file, by function ID, or a
   * function that imports them. `virtual:brumate/testing` passes them.
   */
  fileMiddleware?: FileMiddleware | (() => Promise<FileMiddleware>);
}

/** What `run` of `AsyncLocalStorage` looks like, the part that `answerCalls` uses. */
interface Storage {
  run: <T>(store: string, callback: () => T) => T;
  getStore: () => string | undefined;
}

let storage: Promise<Storage | undefined> | undefined;

/**
 * Tells the calls that a server function makes while it is answered. Node
 * has `AsyncLocalStorage`. Elsewhere, such as in a browser, there is none,
 * and nested calls are not told apart.
 */
function callStorage(): Promise<Storage | undefined> {
  storage ??= import('node:async_hooks').then(
    ({ AsyncLocalStorage }) => new AsyncLocalStorage<string>() as Storage,
    () => undefined,
  );
  return storage;
}

/**
 * Answers the server function calls of the page in the test, with
 * `functions`, through the same request and answer as a server. Calls go
 * through `fetch`, so it replaces `fetch` until the returned function
 * restores it. Other requests go to the `fetch` from before.
 *
 * `functions` can be a function that returns them, so they are imported on
 * the first call. A server function that calls a server function through
 * `fetch`, as a browser stub does, throws: it would call itself without end.
 */
export function answerCalls(
  functions: ServerFunctions | (() => Promise<ServerFunctions>),
  options: AnswerOptions = {},
): () => void {
  const prefix = options.rpc ?? '/_brumate';
  const original = globalThis.fetch;
  let loaded: Promise<ServerFunctions> | undefined;
  /** The error of a call that a server function made through `fetch`. */
  let failure: Error | undefined;
  const answer = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const base = globalThis.location?.href ?? 'http://localhost/';
    const url = new URL(input instanceof Request ? input.url : String(input), base);
    if (!url.pathname.startsWith(`${prefix}/`)) {
      return original(input, init);
    }
    const id = decodeURIComponent(url.pathname.slice(prefix.length + 1));
    const calls = await callStorage();
    const caller = calls?.getStore();
    if (caller !== undefined) {
      // The outer call answers with a generic error, so the error goes to its caller too.
      failure ??= new Error(
        `The server function "${caller}" called "${id}" through fetch, as a browser stub does. In a test, server code imports the server code of a 'use server' file: import components with ?brumate-server, and answer calls with the functions of virtual:brumate/server`,
      );
      throw failure;
    }
    options.onCall?.(id);
    loaded ??= Promise.resolve(typeof functions === 'function' ? functions() : functions);
    const registry = await loaded;
    const request = input instanceof Request ? new Request(input, init) : new Request(url, init);
    const guards = options.fileMiddleware;
    const fileMiddleware = typeof guards === 'function' ? await guards() : guards;
    const handle = (): Promise<Response | undefined> =>
      handleRequest(registry, request, prefix, { middleware: options.middleware, fileMiddleware });
    const response = await (calls ? calls.run(id, handle) : handle());
    if (failure) {
      const error = failure;
      failure = undefined;
      throw error;
    }
    return response ?? original(input, init);
  };
  globalThis.fetch = answer as typeof fetch;
  return () => {
    // A later `answerCalls` or stub keeps its own `fetch`.
    if (globalThis.fetch === answer) {
      globalThis.fetch = original;
    }
  };
}

/** Answers a request as the server of the app does, or undefined when nothing does. */
export type RequestHandler = (request: Request) => Promise<Response | undefined>;

export interface VisitorOptions extends TestingOptions {
  /** Answers the requests for pages, forms without scripts, `#defer` bodies and endpoints. */
  routes: () => Promise<RequestHandler>;
  /** Answers server function calls. */
  calls: () => Promise<RequestHandler>;
}

export interface VisitOptions {
  /** Cookies that the browser has before the first request, by name. */
  cookies?: Record<string, string>;
  /** Headers of every request, such as `accept-language`. */
  headers?: HeadersInit;
}

export interface Visited extends Actions {
  /** The path and the query of the page, such as `/issues?q=bug`. It changes with client navigation. */
  readonly url: string;
  /** The status of the first page. */
  status: number;
  /** The cookies that the browser has now, by name. */
  readonly cookies: Record<string, string>;
  /** Stops the loader, puts `fetch` back and empties the document. */
  close: () => void;
}

/** Visits a path of the app, as a browser that runs scripts does. */
export type Visit = (path: string, options?: VisitOptions) => Promise<Visited>;

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** Reads the `set-cookie` headers of a response into the cookies of the browser. */
function storeCookies(jar: Map<string, string>, response: Response): void {
  for (const header of response.headers.getSetCookie()) {
    const [pair = '', ...attributes] = header.split(';');
    const equals = pair.indexOf('=');
    const name = pair.slice(0, equals).trim();
    if (equals < 1) {
      continue;
    }
    const gone = attributes.some((attribute) => {
      const [key = '', value = ''] = attribute.trim().split('=');
      const lower = key.toLowerCase();
      return (
        (lower === 'max-age' && Number(value) <= 0) ||
        (lower === 'expires' && Date.parse(value) <= Date.now())
      );
    });
    if (gone) {
      jar.delete(name);
    } else {
      jar.set(name, pair.slice(equals + 1).trim());
    }
  }
}

/** The page that a visit holds, so a new visit closes the one before. */
let visited: Visited | undefined;

/** Returns `visit`, which answers the requests of the page with the routes of the app. */
export function createVisit(options: VisitorOptions): Visit {
  const prefix = options.rpc ?? '/_brumate';
  /**
   * Answers the path with the routes of the app, puts the page in the
   * document, and starts the loader with client navigation. Links, forms,
   * server function calls and `#defer` requests of the page go to the same
   * routes, without a server, with the cookies that the answers set.
   */
  return async function visit(path, visitOptions = {}) {
    visited?.close();
    const jar = new Map(Object.entries(visitOptions.cookies ?? {}));
    const original = globalThis.fetch;
    const origin = location.origin;
    history.replaceState(null, '', new URL(path, origin));

    // A browser follows redirects, sends its cookies, and keeps the ones that the answers set.
    const answer = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (url.origin !== origin) {
        return original(input, init);
      }
      let method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      let body = init?.body ?? undefined;
      const extra = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, name) => extra.set(name, value));
      for (let hops = 0; ; hops++) {
        const request = new Request(url, { method, body, signal: init?.signal ?? null });
        // Set after the request is made, since a DOM environment drops these from its init.
        new Headers(visitOptions.headers).forEach((value, name) =>
          request.headers.set(name, value),
        );
        extra.forEach((value, name) => request.headers.set(name, value));
        if (jar.size > 0) {
          request.headers.set(
            'cookie',
            [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
          );
        }
        if (method !== 'GET' && method !== 'HEAD') {
          request.headers.set('origin', origin);
        }
        const handle = url.pathname.startsWith(`${prefix}/`) ? options.calls : options.routes;
        const answered = handle().then((handler) => handler(request));
        // oxlint-disable-next-line no-await-in-loop -- Each redirect is a request of its own.
        const response = (await answered) ?? new Response('Not found', { status: 404 });
        storeCookies(jar, response);
        const location = response.headers.get('location');
        if (!REDIRECTS.has(response.status) || !location || init?.redirect === 'manual') {
          Object.defineProperty(response, 'url', { value: url.href });
          return response;
        }
        if (hops === 20) {
          throw new TypeError(`Too many redirects from ${path}`);
        }
        url = new URL(location, url);
        // As in fetch: 303 asks for the page with GET, and so do 301 and 302 after a POST.
        // 307 and 308 send the request again as it was.
        if (
          (response.status === 303 && method !== 'HEAD') ||
          (method === 'POST' && (response.status === 301 || response.status === 302))
        ) {
          method = 'GET';
          body = undefined;
          extra.delete('content-type');
        }
      }
    };
    globalThis.fetch = answer as typeof fetch;

    // The DOM of a test does not run scripts, so the ones that the page adds run here, once each.
    const ran = new WeakSet<Element>();
    const runOnce = (script: Element): void => {
      if (!ran.has(script) && !script.hasAttribute('src') && !script.hasAttribute('type')) {
        ran.add(script);
        run(script);
      }
    };
    const scripts = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeName === 'SCRIPT') {
            runOnce(node as Element);
          } else if (node instanceof Element) {
            node.querySelectorAll('script').forEach(runOnce);
          }
        }
      }
    });

    const response = await answer(path);
    // The page is at the URL of the last redirect.
    history.replaceState(null, '', response.url);
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let html = '';
    let end = -1;
    let done = false;
    while (end < 0 && !done) {
      // oxlint-disable-next-line no-await-in-loop -- The page arrives in pieces.
      const chunk = await reader.read();
      done = chunk.done;
      html += chunk.value ?? '';
      end = html.search(/<\/html>/i);
    }
    const cut = end < 0 ? html.length : end + '</html>'.length;
    const page = new DOMParser().parseFromString(html.slice(0, cut), 'text/html');
    for (const name of document.documentElement.getAttributeNames()) {
      document.documentElement.removeAttribute(name);
    }
    for (const attribute of page.documentElement.attributes) {
      document.documentElement.setAttribute(attribute.name, attribute.value);
    }
    document.head.replaceChildren(
      ...[...page.head.childNodes].map((node) => document.importNode(node, true)),
    );
    document.body.replaceChildren(
      ...[...page.body.childNodes].map((node) => document.importNode(node, true)),
    );
    document.querySelectorAll('script').forEach(runOnce);
    scripts.observe(document, { childList: true, subtree: true });

    const stop = start({ load: options.load, rpc: prefix, navigate: true, preload: false });
    let rest = html.slice(cut);
    let open = true;
    void (async () => {
      while (!done) {
        // oxlint-disable-next-line no-await-in-loop -- Later markup arrives in pieces.
        const chunk = await reader.read();
        done = chunk.done;
        rest += chunk.value ?? '';
        // A chunk can end inside a tag, a script or a template, so only whole nodes move in.
        const last = done ? rest.length : wholeNodes(rest);
        if (last > 0 && open) {
          // The observer runs its scripts.
          const template = document.createElement('template');
          template.innerHTML = rest.slice(0, last);
          document.body.append(template.content);
          rest = rest.slice(last);
        }
      }
    })();

    const current: Visited = {
      ...actions(document),
      get url() {
        return location.pathname + location.search;
      },
      status: response.status,
      get cookies() {
        return Object.fromEntries(jar);
      },
      close: () => {
        if (!open) {
          return;
        }
        open = false;
        visited = undefined;
        stop();
        scripts.disconnect();
        reader.cancel().catch(() => {});
        if (globalThis.fetch === answer) {
          globalThis.fetch = original;
        }
        // The core forgets the page, so the next visit starts its IDs again.
        void import('./client.ts').then((core) => core.leavePage());
        document.head.replaceChildren();
        document.body.replaceChildren();
      },
    };
    visited = current;
    return current;
  };
}
