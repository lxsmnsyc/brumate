import type * as Client from './client.ts';
import type { ClientModule } from './client.ts';

export interface LoaderOptions {
  /** Imports the client module of a component, by component ID. */
  load: (id: string) => Promise<ClientModule>;
  /** The URL prefix of server function calls. */
  rpc?: string;
}

interface Entry {
  raw: string;
  type: string;
  modifiers: string[];
  ref: string;
}

function entries(element: Element): Entry[] {
  return (element.getAttribute('data-on') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((entry) => {
      const [name, ref] = entry.split('=') as [string, string];
      const [type, ...modifiers] = name.split(':') as [string, ...string[]];
      return { raw: entry, type, modifiers, ref };
    });
}

/**
 * Starts resuming the page. Listens to the events in `data-on` attributes
 * and loads `brumate/client` and the component's module on the first one.
 * Returns a function that removes the listeners and stops the core.
 */
export function start(options: LoaderOptions): () => void {
  let core: Promise<typeof Client> | undefined;
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

  const run = (element: Element, ref: string, event?: Event): void => {
    core ??= import('./client.ts').then((client) => {
      client.init({ ...options, listen: scan });
      return client;
    });
    void core.then((client) => client.handle(element, ref, event));
  };

  const apply = (event: Event, element: Element, entry: Entry): boolean => {
    if (entry.modifiers.includes('prevent')) {
      event.preventDefault();
    }
    if (entry.modifiers.includes('once')) {
      const rest = (element.getAttribute('data-on') ?? '')
        .split(' ')
        .filter((item) => item !== entry.raw);
      element.setAttribute('data-on', rest.join(' '));
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
      if (node.nodeType !== 1 || !(node as Element).hasAttribute('data-on')) {
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

  const scan = (root: ParentNode): void => {
    for (const element of select(root, '[data-on]:not(template)')) {
      for (const { type } of entries(element)) {
        if (!types.has(type)) {
          types.add(type);
          listen(document, type, onEvent, true);
        }
      }
    }
    for (const template of select(root, 'template[data-listen]')) {
      const target = template.getAttribute('data-listen') === 'window' ? window : document;
      for (const entry of entries(template)) {
        listen(target, entry.type, (event) => apply(event, template, entry));
      }
    }
    for (const template of select(root, 'template[data-client]')) {
      const [trigger, ref] = template.getAttribute('data-client')!.split('=') as [string, string];
      const go = (): void => run(template, ref);
      const next = template.nextElementSibling;
      if (trigger === 'idle') {
        (window.requestIdleCallback ?? setTimeout)(go);
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
    }
  };

  // Preloads a component's module when the pointer is over one of its handlers.
  listen(
    document,
    'pointerover',
    (event) => {
      const element = (event.target as Element).closest?.('[data-on]');
      if (element && element.getAttribute('data-prefetch') !== 'none') {
        for (const entry of entries(element)) {
          void options.load(entry.ref.split('#')[0]!);
        }
      }
    },
    { passive: true },
  );

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
  return () => {
    observer.disconnect();
    for (const remove of removers.splice(0)) {
      remove();
    }
    void core?.then((client) => client.dispose());
  };
}
