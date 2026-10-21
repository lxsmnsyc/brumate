import type * as Client from './client.ts';
import type { ClientModule } from './client.ts';

export interface LoaderOptions {
  /** Imports the client module of a component, by component ID. */
  load: (id: string) => Promise<ClientModule>;
  /** The URL prefix of server function calls. */
  rpc?: string;
  /**
   * Loads pages without a full page load: links to the same origin, the back
   * and forward buttons, and forms that post to a server function. Defaults to true.
   */
  navigate?: boolean | NavigateOptions;
}

export interface NavigateOptions {
  /**
   * Swaps the page inside a view transition, where the browser has them.
   * CSS can tell links, the back and forward buttons and forms apart with
   * the types `push`, `traverse` and `form`.
   */
  transition?: boolean;
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

function strategy(element: Element): string {
  return element.getAttribute('data-prefetch') ?? 'hover';
}

/** Starts loading the page of a link, unless the link asks not to. */
function prefetch(link: HTMLAnchorElement | undefined): void {
  if (link && link.getAttribute('data-prefetch') !== 'none') {
    void import('./navigate.ts').then((module) => module.prefetch(link.href));
  }
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

  const loadCore = (): Promise<typeof Client> =>
    (core ??= import('./client.ts').then((client) => {
      client.init({ ...options, listen: scan });
      return client;
    }));

  const run = (element: Element, ref: string, event?: Event): void => {
    void loadCore().then((client) => client.handle(element, ref, event));
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

  const visible =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver((records) => {
          for (const record of records) {
            if (record.isIntersecting) {
              visible!.unobserve(record.target);
              preload(record.target);
            }
          }
        });
  removers.push(() => visible?.disconnect());

  const scan = (root: ParentNode): void => {
    for (const element of select(root, '[data-prefetch="visible"], [data-prefetch="idle"]')) {
      if (strategy(element) === 'idle' || !visible) {
        (window.requestIdleCallback ?? setTimeout)(() => preload(element));
      } else {
        visible.observe(element);
      }
    }
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

  // Preloads the core and the parts of an element's handlers, so its first event does not wait for them.
  const preloaded = new WeakSet<Element>();
  const preload = (element: Element): void => {
    if (preloaded.has(element)) {
      return;
    }
    preloaded.add(element);
    void import('./client.ts');
    for (const entry of entries(element)) {
      const [id, name] = entry.ref.split('#') as [string, string];
      void options.load(id).then((module) => module.load(/^[hc]\d/.test(name) ? name : 'update'));
    }
  };

  listen(
    document,
    'pointerover',
    (event) => {
      const element = (event.target as Element).closest?.('[data-on]');
      if (element && strategy(element) === 'hover') {
        preload(element);
      }
    },
    { passive: true },
  );
  listen(document, 'focusin', (event) => {
    const element = (event.target as Element).closest?.('[data-on]');
    if (element && strategy(element) === 'hover') {
      preload(element);
    }
  });

  // A form of an `$action` sends its data with `fetch`, and the core writes the result into the page.
  listen(document, 'submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (event.defaultPrevented || !form.hasAttribute?.('data-result')) {
      return;
    }
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter;
    void loadCore().then((client) => client.submitAction(form, submitter));
  });

  if (options.navigate !== false) {
    const rpc = `${options.rpc ?? '/_brumate'}/`;
    // The page without its hash, to tell a change of the hash from a change of the page.
    let page = String(location.href).split('#')[0];
    const go = (url: string, init?: RequestInit, push = true): void => {
      page = url.split('#')[0]!;
      void import('./navigate.ts').then(({ navigate }) =>
        navigate({
          url,
          init,
          push,
          transition: typeof options.navigate === 'object' && options.navigate.transition === true,
          // The core forgets the old page, or only stops reading, when layouts stay.
          leave: async (partial) => {
            const client = await core;
            if (partial) {
              client?.dispose();
            } else {
              client?.leavePage();
            }
          },
          enter: () => {
            void core?.then((client) => client.init({ ...options, listen: scan }));
            page = location.href.split('#')[0]!;
          },
        }),
      );
    };
    // A link to another page of this site, which the loader loads itself.
    const pageLink = (target: EventTarget | null): HTMLAnchorElement | undefined => {
      const link = (target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      return link &&
        !link.target &&
        !link.hasAttribute('download') &&
        !link.hasAttribute('data-reload') &&
        link.origin === location.origin &&
        // A link to a place in the same page scrolls there.
        !(link.hash && link.href.split('#')[0] === page)
        ? link
        : undefined;
    };
    listen(document, 'click', (event) => {
      const mouse = event as MouseEvent;
      const link = pageLink(event.target);
      if (
        !link ||
        event.defaultPrevented ||
        mouse.button ||
        mouse.metaKey ||
        mouse.ctrlKey ||
        mouse.shiftKey ||
        mouse.altKey
      ) {
        return;
      }
      event.preventDefault();
      go(link.href);
    });
    // A page loads when the pointer rests on its link, or the link gets focus, so a click finds it loading.
    let resting: ReturnType<typeof setTimeout> | undefined;
    listen(
      document,
      'pointerover',
      (event) => {
        const link = pageLink(event.target);
        if (link) {
          clearTimeout(resting);
          resting = setTimeout(() => prefetch(link), 80);
        }
      },
      { passive: true },
    );
    listen(document, 'pointerout', () => clearTimeout(resting), { passive: true });
    listen(document, 'focusin', (event) => prefetch(pageLink(event.target)));
    listen(document, 'submit', (event) => {
      const form = event.target as HTMLFormElement;
      const submitter = (event as SubmitEvent).submitter;
      const action = submitter?.getAttribute('formaction') ?? form.getAttribute('action') ?? '';
      const method = submitter?.getAttribute('formmethod') ?? form.getAttribute('method');
      if (event.defaultPrevented || method?.toLowerCase() !== 'post' || !action.startsWith(rpc)) {
        return;
      }
      event.preventDefault();
      go(action, { method: 'POST', body: new FormData(form, submitter) });
    });
    listen(window, 'popstate', () => {
      // A change of the hash only stays on the page.
      if (location.href.split('#')[0] !== page) {
        go(location.href, undefined, false);
      }
    });
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
  return () => {
    observer.disconnect();
    for (const remove of removers.splice(0)) {
      remove();
    }
    void core?.then((client) => client.dispose());
  };
}
