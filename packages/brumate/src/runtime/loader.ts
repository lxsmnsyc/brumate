import type * as Routes from './client-routes.ts';
import { boot, importCore, strategy } from './boot.ts';
import type { Core, LoaderOptions, Navigation } from './boot.ts';

export type { LoaderOptions, NavigateOptions } from './boot.ts';
export { startWithoutNavigation } from './static-loader.ts';

/**
 * Starts resuming the page. Listens to the events in `b-on` attributes
 * and loads `brumate/client` and the component's module on the first one.
 * Returns a function that removes the listeners and stops the core.
 */
export function start(options: LoaderOptions): () => void {
  return boot(options, options.navigate === false ? undefined : navigation);
}

/** Starts loading the page of a link, unless the link asks not to. */
function prefetch(link: HTMLAnchorElement | undefined): void {
  if (link && strategy(link) !== 'none') {
    void import('./navigate.ts').then((module) => module.prefetch(link.href));
  }
}

/**
 * Imports the code with which the core reads the pages that navigation adds.
 * A core that runs loads it when the loader navigates. A core that starts
 * later loads it with the core, when the page has records that navigation
 * marked.
 */
const routes = (): (typeof Routes)['ready'] =>
  import('./client-routes.ts').then((module) => module.ready);

/**
 * Loads pages without a full page load: links to the same origin, the back
 * and forward buttons, forms that post to a server function, and redirects
 * from server functions to the same origin. Returns how the loader imports
 * the core.
 */
function navigation({ options, listen, core, scan }: Navigation): () => Promise<Core> {
  const rpc = `${options.rpc ?? '/_brumate'}/`;
  // The page without its hash, to tell a change of the hash from a change of the page.
  let page = String(location.href).split('#')[0];
  const go = (url: string, init?: RequestInit, push = true, reload = false): void => {
    page = url.split('#')[0]!;
    if (core()) {
      void routes();
    }
    void import('./navigate.ts').then((module) =>
      module.navigate({
        url,
        init,
        push,
        reload,
        transition: typeof options.navigate === 'object' && options.navigate.transition === true,
        // The core forgets the old page, or only stops reading, when layouts stay.
        leave: async (partial) => {
          if (core()) {
            (await routes())(partial);
          }
        },
        enter: () => {
          void core()?.then((client) => client.init({ ...options, listen: scan }));
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
      !link.matches('[download],[data-reload]') &&
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
  // A server function that redirects, from `rpc.ts`. Another site loads in full.
  listen(document, 'brumate:redirect', (event) => {
    const url = new URL((event as CustomEvent<string>).detail, location.href);
    if (url.origin === location.origin) {
      event.preventDefault();
      go(url.href, undefined, true, true);
    }
  });
  // A hot update whose markup changed loads the page again, in place. With `init`, the whole
  // page is replaced, as for a form, so layouts render again too, and it keeps the scroll.
  listen(document, 'brumate:reload', () => go(location.href, { method: 'GET' }, false));
  listen(window, 'popstate', () => {
    // A change of the hash only stays on the page.
    if (location.href.split('#')[0] !== page) {
      go(location.href, undefined, false);
    }
  });
  return () =>
    Promise.all([importCore(), document.querySelector('[b-offset],[b-roots]') && routes()]).then(
      ([client]) => client,
    );
}
