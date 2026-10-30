// The only script before the first interaction: the loader of brumate.
import type { ClientModule } from 'brumate/client';
import { hotLoad } from 'brumate/hot';
import { start } from 'brumate/loader';
import { load } from 'virtual:brumate/manifest';

// The live samples of the docs register their components here, by component ID. See live/run.ts.
function samples(): Map<string, () => Promise<ClientModule>> | undefined {
  return (globalThis as Record<symbol, Map<string, () => Promise<ClientModule>> | undefined>)[
    Symbol.for('brumate.live')
  ];
}

start({
  // On the dev server, an edit of a component can update the page without a reload.
  load: hotLoad(import.meta.hot, (id) => samples()?.get(id)?.() ?? load(id)),
  navigate: { transition: true },
});

if (import.meta.env.DEV) {
  void import('brumate/devtools').then(({ installDevtools }) => installDevtools());
}
