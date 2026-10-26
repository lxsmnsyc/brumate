// The loader's code that every page runs. `loader.ts` adds client navigation,
// and `static-loader.ts` starts it without, so a site that turns navigation
// off does not have its code, or the parts of the core that only it uses, in
// its bundle.

import { HAS_ACTIONS, HAS_BLOCKS, HAS_LATE_MARKUP, HAS_LISTENERS } from './features.ts';
import type * as Client from './client.ts';
import type { ClientModule, DevtoolsHooks, Part } from './client.ts';
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
  /**
   * Loads the bundle of a root component of the page, such as a route: the client modules of
   * the components that it can render, in one chunk. Undefined for a component that is not a
   * root.
   */
  loadBundle?: (id: string) => Promise<unknown> | undefined;
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
  // Once stopped, the loader starts nothing, also from markup that the core inserts later with the
  // hooks that this loader gave it. A new loader can reuse the IDs of client scopes, so a stale
  // start would run in a scope of the new page.
  let stopped = false;
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
  // The modules and parts that the loader asked for, which the core takes, so a handler whose
  // code loaded runs without another `import()`. In Chrome, an `import()` of a module that is
  // loaded already still resolves in a task of its own, which can wait for the next frame.
  const modules = new Map<string, Promise<ClientModule> | undefined>();
  const loadModule = (id: string): Promise<ClientModule> | undefined => {
    if (modules.has(id)) {
      return modules.get(id);
    }
    const promise = options.load(id);
    modules.set(id, promise);
    // A load that fails can start again, such as after the network comes back.
    promise?.catch(() => modules.delete(id));
    return promise;
  };
  const partLoads = new Map<string, Promise<Part>>();
  const loadPart = (module: ClientModule, part: string): Promise<Part> => {
    const key = `${module.id}#${part}`;
    let promise = partLoads.get(key);
    if (!promise) {
      promise = module.load!(part);
      partLoads.set(key, promise);
      promise.catch(() => partLoads.delete(key));
    }
    return promise;
  };
  // The serial entry loads with the core, so the core can make the values of the app.
  let serialLoad: Promise<SerialEntry> | undefined;
  const loadSerial = (): Promise<SerialEntry> | undefined => {
    serialLoad ??= options.serial?.();
    serialLoad?.catch(() => (serialLoad = undefined));
    return serialLoad;
  };
  const loadCore = (): Promise<Core> =>
    (core ??= Promise.all([load(), loadSerial()]).then(([client, serial]) => {
      client.init({ ...options, load: loadModule, loadPart, listen: scanInsert, inserted, serial });
      return client;
    }));

  // The devtools panel asks for the core when it opens, so it can show the page before any event.
  listen(document, 'brumate:core', () => void loadCore());

  const run = (element: Element, ref: string, event?: Event): void => {
    if (stopped) {
      return;
    }
    void loadCore().then((client) => client.handle(element, ref, event));
  };

  const apply = (event: Event, element: Element, entry: Entry): boolean => {
    for (const modifier of entry.modifiers) {
      // `prevent(ArrowDown,Enter)` prevents only these keys, by `event.key`. A key that commits
      // or moves within the text of an input method, such as Enter while it composes, is the
      // input method's, so it keeps its default.
      if (
        modifier === 'prevent' ||
        (modifier.startsWith('prevent(') &&
          !(event as KeyboardEvent).isComposing &&
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
    } else if (trigger === 'visible' && next && typeof IntersectionObserver !== 'undefined') {
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
  const SCANNED = '[b-on],template[b-listen],template[b-client],template[b-defer]';
  // One query of the markup for everything that the loader starts. The blocks start after the
  // rest, as they did when each kind had its own query.
  const scan = (root: ParentNode): void => {
    if (stopped) {
      return;
    }
    const blocks: Element[] = [];
    for (const element of select(root, SCANNED)) {
      if (element.tagName === 'TEMPLATE') {
        if (HAS_LISTENERS && element.hasAttribute('b-listen')) {
          onListener(element);
        } else if (
          HAS_BLOCKS &&
          (element.hasAttribute('b-client') ||
            (element.hasAttribute('b-defer') && !element.hasAttribute('b-hole')))
        ) {
          blocks.push(element);
        }
        continue;
      }
      if (element.hasAttribute('b-on')) {
        onElement(element);
      }
    }
    for (const template of blocks) {
      onBlock(root, template);
    }
  };

  // A form of an `$action` sends its data with `fetch`, and the core writes the result into the page.
  listen(document, 'submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (!HAS_ACTIONS || event.defaultPrevented || !form.hasAttribute?.('b-result')) {
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
  const scanAdded = (records: MutationRecord[]): void => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) {
          scan(node as Element);
        }
      }
    }
  };
  // Without markup that others insert, the core scans all that comes into the page. The rest of
  // the page that the browser reads after an `async` script starts is scanned when it ends.
  const observer = HAS_LATE_MARKUP ? new MutationObserver(scanAdded) : undefined;
  observer?.observe(document, { childList: true, subtree: true });
  if (!HAS_LATE_MARKUP && document.readyState === 'loading') {
    listen(document, 'DOMContentLoaded', () => scan(document));
  }
  // The core scans the markup that it inserts before the insert, so the records of the insert
  // are dropped instead of scanned again. The markup that others inserted first is scanned
  // first.
  const scanInsert = (root: ParentNode): void => {
    if (observer) {
      scanAdded(observer.takeRecords());
    }
    scan(root);
  };
  const inserted = (): void => {
    observer?.takeRecords();
  };

  // The core starts at once and loads the code of the components on the page, so a call of a
  // function of another component, such as a function prop, runs at once and in order.
  void loadCore().catch(() => {});
  // The bundles of the components in the state start with it, so the code of the page comes in
  // the same round trip as the core. The core asks for them again when it reads the state.
  const bundled = new Set<string>();
  const loadBundles = (): void => {
    for (const script of document.querySelectorAll('script[b-state]')) {
      for (const [, id] of script.textContent?.matchAll(/\bm:"([^"]+)"/g) ?? []) {
        if (!bundled.has(id!)) {
          bundled.add(id!);
          void options.loadBundle?.(id!)?.catch(() => {});
        }
      }
    }
  };
  if (options.loadBundle) {
    loadBundles();
    if (document.readyState === 'loading') {
      listen(document, 'DOMContentLoaded', loadBundles);
    }
  }
  return () => {
    stopped = true;
    observer?.disconnect();
    for (const remove of removers.splice(0)) {
      remove();
    }
    void core?.then((client) => client.dispose());
  };
}
