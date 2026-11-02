// The `load` of a build, which `virtual:brumate/manifest` exports. The server names the bundles
// that a page needs in the `b-load` attribute of its state records, so the client entry holds
// no table of the bundles of the app.

import type { ClientModule } from './client.ts';

/** The client modules of the bundles that loaded, by component ID. */
const loaded = new Map<string, ClientModule>();
/** The bundles that load or loaded, by URL. */
const pending = new Map<string, Promise<void>>();

/**
 * Loads a bundle that a state record names: the client modules of the components that it holds.
 * Each URL loads once, and again after it failed.
 */
export function loadBundle(url: string): Promise<void> {
  let promise = pending.get(url);
  if (!promise) {
    // A relative URL, as from base "./", is relative to the page, like the hints in its head.
    promise = import(/* @vite-ignore */ new URL(url, document.baseURI).href).then(
      (bundle: { modules: Record<string, ClientModule> }) => {
        for (const [id, module] of Object.entries(bundle.modules)) {
          loaded.set(id, module);
        }
      },
    );
    pending.set(url, promise);
    promise.catch(() => pending.delete(url));
  }
  return promise;
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
  for (const script of document.querySelectorAll('script[b-load]')) {
    for (const url of script.getAttribute('b-load')!.split(' ')) {
      void loadBundle(url).catch(() => {});
    }
  }
  const waiting = [...pending.values()];
  return waiting.length > 0 ? Promise.allSettled(waiting).then(() => loaded.get(id)!) : undefined;
}
