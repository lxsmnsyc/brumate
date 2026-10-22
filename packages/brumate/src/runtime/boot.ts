// The loader's code that every page runs. `loader.ts` adds client navigation,
// and `static-loader.ts` starts it without, so a site that turns navigation
// off does not have its code, or the parts of the core that only it uses, in
// its bundle.

import type * as Client from './client.ts';
import type { ClientModule } from './client.ts';

export interface LoaderOptions {
  /**
   * Imports the client module of a component, by component ID. Undefined for
   * a component that has no client code.
   */
  load: (id: string) => Promise<ClientModule> | undefined;
  /** The URL prefix of server function calls. */
  rpc?: string;
  /**
   * Loads pages without a full page load: links to the same origin, the back
   * and forward buttons, forms that post to a server function, and redirects
   * from server functions to the same origin. Defaults to true.
   */
  navigate?: boolean | NavigateOptions;
  /**
   * After the page loads, while the browser is idle, loads the core and the
   * code of the handlers of elements in or near the viewport, so a first
   * event needs no request. Elements with `data-prefetch="none"` are left
   * out, and nothing loads when the browser asks to save data or the
   * connection is 2G. Defaults to true.
   */
  preload?: boolean;
}

export interface NavigateOptions {
  /**
   * Swaps the page inside a view transition, where the browser has them.
   * CSS can tell links, the back and forward buttons and forms apart with
   * the types `push`, `traverse` and `form`. A redirect from a server
   * function has the type `form`.
   */
  transition?: boolean;
}

interface Entry {
  raw: string;
  type: string;
  modifiers: string[];
  ref: string;
}

// Parsed `b-on` values, so repeated events do not parse them again.
const parsed = new Map<string, Entry[]>();

export function entries(element: Element): Entry[] {
  const value = element.getAttribute('b-on') ?? '';
  return (parsed.get(value) ??
    parsed
      .set(
        value,
        value
          .split(' ')
          .filter(Boolean)
          .map((entry) => {
            const [name, ref] = entry.split('=') as [string, string];
            const [type, ...modifiers] = name.split(':') as [string, ...string[]];
            return { raw: entry, type, modifiers, ref };
          }),
      )
      .get(value))!;
}

/** The `prefetch` strategy of an element, from its `data-prefetch`. */
export function strategy(element: Element): string {
  return element.getAttribute('data-prefetch') ?? 'hover';
}

/** The functions of the core that the loader calls. */
export type Core = (typeof Client)['loader'];

/**
 * Imports the core. It reads one export by name, so a build keeps only it and
 * the helpers that compiled components call.
 */
export const importCore = (): Promise<Core> =>
  import('./client.ts').then((client) => client.loader);

/** Runs a function when the browser is idle. */
const idle = (fn: () => void): unknown => (window.requestIdleCallback ?? setTimeout)(fn);

/** What the loader gives the code that loads pages without a full page load. */
export interface Navigation {
  options: LoaderOptions;
  listen: (
    target: EventTarget,
    type: string,
    listener: (event: Event) => void,
    flags?: AddEventListenerOptions | boolean,
  ) => void;
  core: () => Promise<Core> | undefined;
  scan: (root: ParentNode) => void;
}

/**
 * Starts resuming the page. Listens to the events in `b-on` attributes
 * and loads `brumate/client` and the component's module on the first one.
 * `navigate` adds client navigation, and returns how to import the core.
 * Returns a function that removes the listeners and stops the core.
 */
export function boot(
  options: LoaderOptions,
  navigate?: (navigation: Navigation) => () => Promise<Core>,
): () => void {
  let core: Promise<Core> | undefined;
  const types = new Set<string>();
  const removers: (() => void)[] = [];
  const listen = (
    target: EventTarget,
    type: string,
    listener: (event: Event) => void,
    flags?: AddEventListenerOptions | boolean,
  ): void => {
    target.addEventListener(type, listener, flags);
    removers.push(() => target.removeEventListener(type, listener, flags));
  };

  // Client navigation imports the core with the code that reads the pages it adds.
  let load = importCore;
  const loadCore = (): Promise<Core> =>
    (core ??= load().then((client) => {
      client.init({ ...options, listen: scan });
      return client;
    }));

  // The devtools panel asks for the core when it opens, so it can show the page before any event.
  listen(document, 'brumate:core', () => void loadCore());

  // Starts loading the module of a handler and its part, as one step when the module holds them.
  const warm = (ref: string): void => {
    const [id, name] = ref.split('#') as [string, string];
    void options.load(id)?.then((module) => module.load?.(/^[hc]\d/.test(name) ? name : 'update'));
  };

  const run = (element: Element, ref: string, event?: Event): void => {
    // The module loads while the core does, not after it.
    warm(ref);
    void loadCore().then((client) => client.handle(element, ref, event));
  };

  const apply = (event: Event, element: Element, entry: Entry): boolean => {
    if (entry.modifiers.includes('prevent')) {
      event.preventDefault();
    }
    if (entry.modifiers.includes('once')) {
      element.setAttribute(
        'b-on',
        entries(element)
          .map((item) => item.raw)
          .filter((raw) => raw !== entry.raw)
          .join(' '),
      );
    }
    run(element, entry.ref, event);
    return entry.modifiers.includes('stop');
  };

  // Handlers run from the target outwards, as if each element had its own listener.
  const onEvent = (event: Event): void => {
    for (
      let node = event.target as Node | null;
      node && node !== document;
      node = node.parentNode
    ) {
      if (node.nodeType !== 1 || !(node as Element).hasAttribute('b-on')) {
        continue;
      }
      let stop = false;
      for (const entry of entries(node as Element)) {
        if (entry.type === event.type && apply(event, node as Element, entry)) {
          stop = true;
        }
      }
      if (stop) {
        event.stopPropagation();
        return;
      }
    }
  };

  // Templates are started once, even when markup is scanned again.
  const started = new WeakSet<Element>();
  const select = (root: ParentNode, selector: string): Element[] => {
    const found = [...root.querySelectorAll(selector)];
    if ((root as Element).matches?.(selector)) {
      found.unshift(root as Element);
    }
    return found.filter((element) => {
      if (element.tagName !== 'TEMPLATE') {
        return true;
      }
      if (started.has(element)) {
        return false;
      }
      started.add(element);
      return true;
    });
  };

  const visible =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver(
          (records) => {
            for (const record of records) {
              if (record.isIntersecting) {
                visible!.unobserve(record.target);
                preload(record.target);
              }
            }
          },
          // Near the viewport counts too, so code loads before an element scrolls in.
          { rootMargin: '25%' },
        );
  removers.push(() => visible?.disconnect());

  // True once the page is idle after `load`, when elements with the default strategy preload
  // as they come near the viewport. See `preload` in the options.
  let eager = false;

  const scan = (root: ParentNode): void => {
    for (const element of select(root, '[data-prefetch=visible],[data-prefetch=idle]')) {
      if (strategy(element) === 'idle' || !visible) {
        idle(() => preload(element));
      } else {
        visible.observe(element);
      }
    }
    for (const element of select(root, '[b-on]:not(template)')) {
      for (const { type } of entries(element)) {
        if (!types.has(type)) {
          types.add(type);
          listen(document, type, onEvent, true);
        }
      }
      if (eager && strategy(element) === 'hover') {
        visible?.observe(element);
      }
    }
    for (const template of select(root, 'template[b-listen]')) {
      const target = template.getAttribute('b-listen') === 'window' ? window : document;
      for (const entry of entries(template)) {
        // Markup that is gone, such as a page that navigation replaced, no longer listens.
        listen(target, entry.type, (event) => {
          if (template.isConnected) {
            apply(event, template, entry);
          }
        });
      }
    }
    for (const template of select(root, 'template[b-client],template[b-defer]')) {
      const client = template.getAttribute('b-client');
      const [trigger, ref] = (client ?? template.getAttribute('b-defer')!).split(
        client ? '=' : ':',
      ) as [string, string];
      // A `#defer` block asks the server for its body, with a module that only it needs.
      const go = (): void =>
        client
          ? run(template, ref)
          : void import('./defer.ts').then((module) => module.loadDeferred(template));
      // The element that a `$client` callback reads through `ref`, or the one after the marker.
      const near = template.getAttribute('b-near');
      const next =
        (near &&
          (root.querySelector(`[b-b="${near}"]`) ?? document.querySelector(`[b-b="${near}"]`))) ||
        template.nextElementSibling;
      if (trigger === 'idle') {
        idle(go);
      } else if (trigger === 'visible' && next && visible) {
        const observer = new IntersectionObserver((records) => {
          if (records.some((record) => record.isIntersecting)) {
            observer.disconnect();
            go();
          }
        });
        observer.observe(next);
      } else {
        go();
      }
    }
  };

  // Preloads the core and the parts of an element's handlers, so its first event does not wait for them.
  const preloaded = new WeakSet<Element>();
  const preload = (element: Element): void => {
    if (preloaded.has(element)) {
      return;
    }
    preloaded.add(element);
    void importCore();
    for (const entry of entries(element)) {
      warm(entry.ref);
    }
  };

  const hover = (event: Event): void => {
    const element = (event.target as Element).closest?.('[b-on]');
    if (element && strategy(element) === 'hover') {
      preload(element);
    }
  };
  listen(document, 'pointerover', hover, { passive: true });
  listen(document, 'focusin', hover);

  // A form of an `$action` sends its data with `fetch`, and the core writes the result into the page.
  listen(document, 'submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (event.defaultPrevented || !form.hasAttribute?.('b-result')) {
      return;
    }
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter;
    void loadCore().then((client) => client.submitAction(form, submitter));
  });

  if (navigate) {
    load = navigate({ options, listen, core: () => core, scan });
  } else {
    // A hot update whose markup changed loads the page again.
    listen(document, 'brumate:reload', () => location.reload());
  }

  scan(document);
  // Markup that streams in later, such as a `#loading` body, has handlers too.
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) {
          scan(node as Element);
        }
      }
    }
  });
  observer.observe(document, { childList: true, subtree: true });

  // After `load`, so the page's own requests go first, and only when the browser is idle.
  // `2g` matches `slow-2g` too.
  const connection = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (
    options.preload !== false &&
    !connection?.saveData &&
    !/2g/.test(connection?.effectiveType as string)
  ) {
    listen(window, 'load', () =>
      idle(() => {
        eager = true;
        scan(document);
      }),
    );
  }
  return () => {
    observer.disconnect();
    for (const remove of removers.splice(0)) {
      remove();
    }
    void core?.then((client) => client.dispose());
  };
}
