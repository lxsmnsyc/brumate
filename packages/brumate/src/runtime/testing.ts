// Renders a component on the server and resumes it in the DOM of a test, as
// a page does: the HTML and the state first, then the loader, which loads
// client code when an event fires.

import type { ClientModule } from './client.ts';
import { start } from './loader.ts';
import { render } from './server.ts';
import type { Component, RenderOptions } from './server.ts';

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
      },
    };
  };
}
