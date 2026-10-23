// The loader's code that every page runs. `loader.ts` adds client navigation,
// and `static-loader.ts` starts it without, so a site that turns navigation
// off does not have its code, or the parts of the core that only it uses, in
// its bundle.

import type * as Client from './client.ts';
import type { ClientModule, DevtoolsHooks } from './client.ts';
import type { SerialEntry } from './values.ts';

/** True on the dev server. A Vite build replaces it with `false`, so the devtools calls go. */
const DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV;

/** The hooks of the devtools overlay, under the same key as the core's. */
function devtools(): DevtoolsHooks | undefined {
  return (globalThis as Record<symbol, DevtoolsHooks | undefined>)[Symbol.for('brumate.devtools')];
}

export interface LoaderOptions {
  /**
   * Imports the client module of a component, by component ID. Undefined for
   * a component that has no client code.
   */
  load: (id: string) => Promise<ClientModule> | undefined;
  /** The URL prefix of server function calls. */
  rpc?: string;
  /** Imports the serial entry, which the core takes before it reads the page state. */
  serial?: () => Promise<SerialEntry>;
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
  /**
   * The ID of the build of the page, for skew protection. The Vite plugin
   * sets it. Calls send it, and a page of another build, or a call that
   * answers 409 after a deploy, makes the next navigation a full page load.
   */
  build?: string;
  /**
   * Receives every error of client code first: of a handler, an effect, a
   * `$client` callback or a memo that loads, such as for a reporting
   * service. `scope` is the ID of the scope that the code belongs to. The
   * error then renders the `#catch` body of the nearest `#try`, or the page
   * gets a `brumate:error` event on `window` and the error is logged.
   */
  onError?: (error: unknown, info: { scope?: number | string }) => void;
}

export interface NavigateOptions {
  /**
   * Swaps the page inside a view transition, where the browser has them.
   * CSS can tell links, the back and forward buttons and forms apart with
   * the types `push`, `traverse` and `form`. A redirect from a server
   * function has the type `form`.
   */
  transition?: boolean;
  /**
   * After a navigation, moves the focus to the first `<h1>` of the routes
   * that changed, or to `<main>`, as a full page load starts it at the top.
   * Defaults to true.
   */
  focus?: boolean;
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
let corePromise: Promise<Core> | undefined;
export const importCore = (): Promise<Core> =>
  (corePromise ??= import('./client.ts').then(
    (client) => client.loader,
    (error: unknown) => {
      // A load that fails can start again, such as after the network comes back.
      corePromise = undefined;
      throw error;
    },
  ));

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
  /** Starts the core, or returns the one that runs. */
  start: () => Promise<Core>;
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
  /** The event types that the document listens to, and whether each listener is passive. */
  const types = new Map<string, boolean>();
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
  // The serial entry loads with the core, so the core can make the values of the app.
  const loadCore = (): Promise<Core> =>
    (core ??= Promise.all([load(), options.serial?.()]).then(([client, serial]) => {
      client.init({ ...options, listen: scan, serial });
      return client;
    }));

  // The devtools panel asks for the core when it opens, so it can show the page before any event.
  listen(document, 'brumate:core', () => void loadCore());

  // Starts loading the module of a handler and its part, as one step when the module holds them.
  // The core reports an error of the load when it runs the handler.
  // `reason` tells the devtools why: an event, a block, or a preload on hover, near the viewport,
  // on idle or after `load`.
  // The parts that loaded or are loading. A list of 1,000 rows names the same handlers 1,000
  // times, and each part loads once.
  const warmed = new Set<string>();
  // The module and part of each ref, which repeats for each row of a list.
  const parts = new Map<string, [id: string, part: string] | undefined>();
  const partOf = (ref: string): [id: string, part: string] | undefined => {
    if (parts.has(ref)) {
      return parts.get(ref);
    }
    let found: [string, string] | undefined;
    // A built-in of the core, such as `$bind`, has no code of a component to load.
    if (!ref.startsWith('$')) {
      // A handler that a spread passed on names its scope after `@`.
      const [id, name] = ref.split('@')[0]!.split('#') as [string, string];
      found = [id, /^[hct]\d/.test(name) ? name : 'update'];
    }
    parts.set(ref, found);
    return found;
  };
  const warmedAll = (element: Element): boolean => {
    for (const entry of entries(element)) {
      const found = partOf(entry.ref);
      if (found && !warmed.has(`${found[0]}#${found[1]}`)) {
        return false;
      }
    }
    return true;
  };
  const warm = (ref: string, reason: string): void => {
    const found = partOf(ref);
    if (!found) {
      return;
    }
    const [id, part] = found;
    const key = `${id}#${part}`;
    if (warmed.has(key)) {
      return;
    }
    warmed.add(key);
    const done = options.load(id)?.then((module) => module.load?.(part));
    // A load that fails can start again, such as after the network comes back.
    void done?.catch(() => warmed.delete(key));
    if (DEV && done) {
      devtools()?.load?.(id, part, reason, done);
    }
  };

  const run = (element: Element, ref: string, event?: Event): void => {
    // The module loads while the core does, not after it.
    warm(ref, event ? 'event' : 'block');
    void loadCore().then((client) => client.handle(element, ref, event));
  };

  const apply = (event: Event, element: Element, entry: Entry): boolean => {
    for (const modifier of entry.modifiers) {
      // `prevent(ArrowDown,Enter)` prevents only these keys, by `event.key`.
      if (
        modifier === 'prevent' ||
        (modifier.startsWith('prevent(') &&
          modifier
            .slice(8, -1)
            .split(',')
            .includes(
              (event as KeyboardEvent).key === ' ' ? 'Space' : (event as KeyboardEvent).key,
            ))
      ) {
        event.preventDefault();
      }
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

  /**
   * Handlers run as if each element had its own listener: those with
   * `capture` from the outside in, then the others from the target outwards.
   * An event that does not bubble, such as `focus`, reaches only the others
   * of its target. `stop` ends the event where it is.
   */
  const onEvent = (event: Event): void => {
    const path: Element[] = [];
    for (
      let node = event.target as Node | null;
      node && node !== document;
      node = node.parentNode
    ) {
      if (node.nodeType === 1 && (node as Element).hasAttribute('b-on')) {
        path.push(node as Element);
      }
    }
    const phase = (elements: Element[], capture: boolean): boolean => {
      for (const element of elements) {
        let stop = false;
        for (const entry of entries(element)) {
          if (
            entry.type === event.type &&
            entry.modifiers.includes('capture') === capture &&
            apply(event, element, entry)
          ) {
            stop = true;
          }
        }
        if (stop) {
          event.stopPropagation();
          return true;
        }
      }
      return false;
    };
    if (!phase([...path].reverse(), true)) {
      phase(event.bubbles ? path : path.filter((element) => element === event.target), false);
    }
  };

  /** True for an entry that prevents the default action, which a passive listener cannot do. */
  const prevents = (entry: Entry): boolean =>
    entry.modifiers.some((modifier) => modifier.startsWith('prevent'));

  /**
   * Listens to an event type on the document. The listener is passive, so
   * scrolling does not wait for it, until an entry of the type prevents.
   */
  const delegate = (type: string, prevent: boolean): void => {
    const passive = types.get(type);
    if (passive === false || (passive === true && !prevent)) {
      return;
    }
    if (passive) {
      document.removeEventListener(type, onEvent, true);
    }
    types.set(type, !prevent);
    listen(document, type, onEvent, { capture: true, passive: !prevent });
  };

  // Templates are started once, even when markup is scanned again.
  const started = new WeakSet<Element>();
  const select = (root: ParentNode, selector: string): Element[] => {
    const found: Element[] = [];
    const add = (element: Element): void => {
      if (element.tagName === 'TEMPLATE') {
        if (started.has(element)) {
          return;
        }
        started.add(element);
      }
      found.push(element);
    };
    if ((root as Element).matches?.(selector)) {
      add(root as Element);
    }
    for (const element of root.querySelectorAll(selector)) {
      add(element);
    }
    return found;
  };

  const visible =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver(
          (records) => {
            for (const record of records) {
              if (record.isIntersecting) {
                visible!.unobserve(record.target);
                preload(record.target, eagerly.has(record.target) ? 'eager' : 'visible');
              }
            }
          },
          // Near the viewport counts too, so code loads before an element scrolls in.
          { rootMargin: '25%' },
        );
  removers.push(() => visible?.disconnect());
  // Elements that preload near the viewport because the page is idle after `load`.
  const eagerly = new WeakSet<Element>();

  // True once the page is idle after `load`, when elements with the default strategy preload
  // as they come near the viewport. See `preload` in the options.
  let eager = false;

  // The values of `b-on` whose event types the document listens to already. The rows of a
  // list repeat the same few values.
  const delegated = new Set<string>();
  const onElement = (element: Element): void => {
    const value = element.getAttribute('b-on')!;
    if (!delegated.has(value)) {
      delegated.add(value);
      for (const entry of entries(element)) {
        delegate(entry.type, prevents(entry));
      }
    }
    // An element whose parts loaded already, such as a new row of a list, has nothing to preload.
    if (eager && strategy(element) === 'hover' && !warmedAll(element)) {
      eagerly.add(element);
      visible?.observe(element);
    }
  };
  const onListener = (template: Element): void => {
    const target = template.getAttribute('b-listen') === 'window' ? window : document;
    for (const entry of entries(template)) {
      // Markup that is gone, such as a page that navigation replaced, no longer listens.
      listen(
        target,
        entry.type,
        (event) => {
          if (template.isConnected) {
            apply(event, template, entry);
          }
        },
        { capture: entry.modifiers.includes('capture'), passive: !prevents(entry) },
      );
    }
  };
  // A `#defer` block whose body the server sends in the same response, with `b-hole`, waits for it.
  const onBlock = (root: ParentNode, template: Element): void => {
    const client = template.getAttribute('b-client');
    const [trigger, ref] = (client ?? template.getAttribute('b-defer')!).split(
      client ? '=' : ':',
    ) as [string, string];
    // A `#defer` block asks the server for its body, with a module that only it needs.
    const go = (): void => {
      if (client) {
        run(template, ref);
        return;
      }
      const done = import('./defer.ts').then((module) => module.loadDeferred(template));
      if (DEV) {
        devtools()?.defer?.(template, done);
      }
    };
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
  };
  const SCANNED =
    '[data-prefetch=visible],[data-prefetch=idle],[b-on],template[b-listen],template[b-client],template[b-defer]';
  // One query of the markup for everything that the loader starts. The blocks start after the
  // rest, as they did when each kind had its own query.
  const scan = (root: ParentNode): void => {
    const blocks: Element[] = [];
    for (const element of select(root, SCANNED)) {
      if (element.tagName === 'TEMPLATE') {
        if (element.hasAttribute('b-listen')) {
          onListener(element);
        } else if (
          element.hasAttribute('b-client') ||
          (element.hasAttribute('b-defer') && !element.hasAttribute('b-hole'))
        ) {
          blocks.push(element);
        }
        continue;
      }
      if (element.hasAttribute('data-prefetch')) {
        const prefetch = element.getAttribute('data-prefetch');
        if (prefetch === 'visible' || prefetch === 'idle') {
          if (strategy(element) === 'idle' || !visible) {
            idle(() => preload(element, strategy(element) === 'idle' ? 'idle' : 'visible'));
          } else {
            visible.observe(element);
          }
        }
      }
      if (element.hasAttribute('b-on')) {
        onElement(element);
      }
    }
    for (const template of blocks) {
      onBlock(root, template);
    }
  };

  // Preloads the core and the parts of an element's handlers, so its first event does not wait for them.
  const preloaded = new WeakSet<Element>();
  const preload = (element: Element, reason: string): void => {
    if (preloaded.has(element)) {
      return;
    }
    preloaded.add(element);
    void importCore();
    for (const entry of entries(element)) {
      warm(entry.ref, reason);
    }
  };

  const hover = (event: Event): void => {
    const element = (event.target as Element).closest?.('[b-on]');
    if (element && strategy(element) === 'hover') {
      preload(element, 'hover');
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
    load = navigate({ options, listen, core: () => core, start: loadCore, scan });
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
