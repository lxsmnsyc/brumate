// The only script before the first interaction: the loader of brumate.
import type { ClientModule } from 'brumate/client';
import { start } from 'brumate/loader';
import { load } from 'virtual:brumate/manifest';

// The live samples of the docs register their components here, by component ID. See live/run.ts.
function samples(): Map<string, () => Promise<ClientModule>> | undefined {
  return (globalThis as Record<symbol, Map<string, () => Promise<ClientModule>> | undefined>)[
    Symbol.for('brumate.live')
  ];
}

start({
  load: (id) => samples()?.get(id)?.() ?? load(id),
  navigate: { transition: true },
});
