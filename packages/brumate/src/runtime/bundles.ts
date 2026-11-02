// The `load` of a build, which `virtual:brumate/manifest` exports. The server names the bundles
// that a page needs in the `b-load` attribute of its state records, so the client entry holds
// no table of the bundles of the app.

import type { ClientModule } from './client.ts';

/** The client modules of the bundles that loaded, by component ID. */
const loaded = new Map<string, ClientModule>();
/** The bundles that load or loaded, by URL. */
const pending = new Map<string, Promise<void>>();
/** The state records whose `b-load` was read. */
const read = new WeakSet<Element>();

/**
 * Loads a URL that a state record names: a bundle, with the client modules of the components
 * that it holds, or a stylesheet that a module of a bundle imports. A URL is relative to this
 * chunk, as the server writes it for a base of "./".
 */
function loadBundle(url: string): Promise<void> | undefined {
  const href = new URL(url, import.meta.url).href;
  // A stylesheet goes in the head unless the page has it, such as from the head of the page.
  if (url.endsWith('.css')) {
    for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]')) {
      if (link.href === href) {
        return undefined;
      }
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.append(link);
    return undefined;
  }
  let promise = pending.get(url);
  if (!promise) {
    promise = import(/* @vite-ignore */ href).then(
      (bundle: { modules: Record<string, ClientModule> }) => {
        for (const [id, module] of Object.entries(bundle.modules)) {
          loaded.set(id, module);
        }
      },
    );
    pending.set(url, promise);
    // A load that fails can start again, such as after the network comes back.
    promise.catch(() => pending.delete(url));
  }
  return promise;
}

/** Loads what the state records of the page that were not read yet name. */
function readRecords(): void {
  for (const script of document.querySelectorAll('script[b-load]')) {
    if (!read.has(script)) {
      read.add(script);
      for (const url of script.getAttribute('b-load')!.split(' ')) {
        void loadBundle(url)?.catch(() => {});
      }
    }
  }
}

// The bundles of the page start with the entry, so the code of the page comes in the same round
// trip as the core. The rest of a page that the browser reads after an `async` entry comes later.
readRecords();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', readRecords);
}

/**
 * The client module of a component, from the bundles that the state records of the page name.
 * Undefined for a component with no client code.
 */
export function load(id: string): Promise<ClientModule> | undefined {
  if (loaded.has(id)) {
    return Promise.resolve(loaded.get(id)!);
  }
  // The records that the page added since, such as those of a navigation or a `#defer` body.
  readRecords();
  const waiting = [...pending.values()];
  return waiting.length > 0 ? Promise.allSettled(waiting).then(() => loaded.get(id)!) : undefined;
}
