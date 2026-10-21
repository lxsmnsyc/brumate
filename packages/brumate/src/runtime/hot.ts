// Hot updates on the dev server. When an edit of a component keeps its
// markup, its slots and its update table, the plugin sends `brumate:update`
// instead of reloading the page. New styles replace the old ones, and the
// next event or update of the component loads its new code. State stays.
//
// When the markup changes, the page loads again through the client router,
// and the signals of the component keep their values, by their names.

import type { ClientModule } from './client.ts';

/** What `brumate:update` holds for each component that changed. */
export interface HotUpdate {
  id: string;
  /** The new styles, when they changed. */
  css?: string;
  /** The URL of the new client entry, when its code changed. */
  url?: string;
  /** Set when the markup changed, so the page renders again with the values of its signals. */
  remount?: Remount;
}

/** The slots of a component before and after an edit, by the ID of each scope in the component. */
export interface Remount {
  /** The names of the slots before the edit. */
  before: Record<number, string[]>;
  /** The names of the slots after the edit. */
  after: Record<number, string[]>;
  /** The names of the signals, whose values stay. */
  signals: string[];
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
      document.dispatchEvent(new CustomEvent('brumate:hot', { detail: changed }));
    }
    const remounts = updates.filter((update) => update.remount);
    if (changed.length === 0 && remounts.length === 0) {
      return;
    }
    // The core has the hot update code, which only this module calls, so builds leave it out.
    void import('./client.ts').then(({ forget, remount }) => {
      // The core forgets the old code of these components.
      forget(changed);
      if (remounts.length > 0) {
        // The core keeps the values of the signals, and the loader loads the page again.
        remount(remounts.map((update) => Object.assign({ id: update.id }, update.remount!)));
        document.dispatchEvent(new CustomEvent('brumate:reload'));
      }
    });
  });
  return (id) => {
    const url = fresh.get(id);
    return url ? (import(/* @vite-ignore */ url) as Promise<ClientModule>) : load(id);
  };
}
