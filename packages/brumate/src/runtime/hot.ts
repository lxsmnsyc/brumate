// Hot updates on the dev server. When an edit of a component keeps its
// markup, its slots and its update table, the plugin sends `brumate:update`
// instead of reloading the page. New styles replace the old ones, and the
// next event or update of the component loads its new code. State stays.

import type { ClientModule } from './client.ts';

/** What `brumate:update` holds for each component that changed. */
export interface HotUpdate {
  id: string;
  /** The new styles, when they changed. */
  css?: string;
  /** The URL of the new client entry, when its code changed. */
  url?: string;
}

/** The part of `import.meta.hot` that this module uses. */
export interface HotContext {
  on(
    event: 'brumate:update',
    listener: (data: { updates: HotUpdate[]; timestamp: number }) => void,
  ): void;
}

/**
 * Listens for updates of components, and returns a `load` for the loader
 * that loads the new code of a component that changed. Pass
 * `import.meta.hot`, which only the module that reads it gets.
 */
export function hotLoad(
  hot: HotContext | undefined,
  load: (id: string) => Promise<ClientModule>,
): (id: string) => Promise<ClientModule> {
  if (!hot) {
    return load;
  }
  const fresh = new Map<string, string>();
  hot.on('brumate:update', ({ updates, timestamp }) => {
    const changed: string[] = [];
    for (const update of updates) {
      if (update.css !== undefined) {
        const style = document.querySelector(`style[data-brm="${CSS.escape(update.id)}"]`);
        if (style) {
          style.textContent = update.css;
        }
      }
      if (update.url) {
        fresh.set(update.id, `${update.url}${update.url.includes('?') ? '&' : '?'}t=${timestamp}`);
        changed.push(update.id);
      }
    }
    if (changed.length > 0) {
      // The core forgets the old code of these components.
      document.dispatchEvent(new CustomEvent('brumate:hot', { detail: changed }));
    }
  });
  return (id) => {
    const url = fresh.get(id);
    return url ? (import(/* @vite-ignore */ url) as Promise<ClientModule>) : load(id);
  };
}
