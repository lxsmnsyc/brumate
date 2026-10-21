// The devtools overlay of development builds. This module only listens to
// the core and shows a button. The panel loads when the button is pressed,
// so the page behaves as in production until then.

import type { DevtoolsHooks, Scope } from './client.ts';

// The same key as the core's, without importing the core.
const DEVTOOLS = Symbol.for('brumate.devtools');

/** Something that happened on the page, for the log of the panel. */
export interface DevtoolsEntry {
  time: number;
  kind: 'handler' | 'part' | 'write';
  text: string;
  /** The scope of a write, so the panel can mark it. */
  scope?: number;
}

export interface DevtoolsState {
  scopes?: Map<number, Scope>;
  log: DevtoolsEntry[];
  /** The scopes written since the panel last drew, by scope ID. */
  written: Set<number>;
  /** The URL prefix of the inspect endpoint of the dev server. */
  endpoint: string;
  /** Called after each change, while the panel is open. */
  changed?: () => void;
}

const MAX_LOG = 300;

/** A short text for a value in the log. */
export function preview(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value);
  }
  if (typeof value === 'function') {
    return 'function';
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (value instanceof Element) {
    return `<${value.tagName.toLowerCase()}>`;
  }
  if (value !== null && typeof value === 'object') {
    const name = value.constructor?.name;
    return name && name !== 'Object' ? name : `{${Object.keys(value).slice(0, 3).join(', ')}}`;
  }
  return String(value);
}

/** Listens to the core, and adds the button that opens the panel. */
export function installDevtools(endpoint = '/__brumate/inspect'): DevtoolsState {
  const state: DevtoolsState = { log: [], written: new Set(), endpoint };
  const add = (entry: Omit<DevtoolsEntry, 'time'>): void => {
    state.log.push({ ...entry, time: performance.now() });
    if (state.log.length > MAX_LOG) {
      state.log.splice(0, state.log.length - MAX_LOG);
    }
    state.changed?.();
  };
  const hooks: DevtoolsHooks = {
    attach(core) {
      state.scopes = core.scopes;
      state.changed?.();
    },
    handler(ref, element, event) {
      add({
        kind: 'handler',
        text: `${event?.type ?? 'call'} on <${element.tagName.toLowerCase()}>: ${ref}`,
      });
    },
    part(component, name) {
      add({ kind: 'part', text: `loaded ${component} ${name}` });
    },
    write(scope, slot, value) {
      state.written.add(scope.id);
      add({
        kind: 'write',
        text: `scope ${scope.id} slot ${slot} = ${preview(value)}`,
        scope: scope.id,
      });
    },
  };
  (globalThis as Record<symbol, DevtoolsHooks | undefined>)[DEVTOOLS] = hooks;

  const host = document.createElement('brumate-devtools');
  const root = host.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  button.textContent = 'brm';
  button.title = 'Open the brumate devtools';
  button.setAttribute(
    'style',
    'position:fixed;right:12px;bottom:12px;z-index:2147483647;font:600 12px ui-monospace,monospace;padding:6px 10px;border-radius:999px;border:1px solid #8884;background:#111;color:#fff;cursor:pointer',
  );
  button.addEventListener('click', () => {
    void import('./devtools-panel.ts').then(({ togglePanel }) => togglePanel(root, state));
  });
  root.append(button);
  const append = (): void => {
    // Navigation replaces the body, so the button goes on the document element.
    document.documentElement.append(host);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', append);
  } else {
    append();
  }
  return state;
}
