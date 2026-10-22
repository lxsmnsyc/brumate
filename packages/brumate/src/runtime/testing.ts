// Renders a component on the server and resumes it in the DOM of a test, as
// a page does: the HTML and the state first, then the loader, which loads
// client code when an event fires.

import type { ClientModule } from './client.ts';
import { start } from './loader.ts';
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

export interface Mounted {
  /** The element that holds the component. */
  container: HTMLElement;
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
  /** Stops the loader and removes the component. */
  unmount: () => void;
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
    const get = (selector: string): HTMLElement => {
      const element = container.querySelector<HTMLElement>(selector);
      if (!element) {
        throw new Error(`No element matches ${selector}`);
      }
      return element;
    };
    return {
      container,
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
