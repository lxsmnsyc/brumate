// The devtools overlay of development builds. This module only listens to
// the core and shows a button. The panel loads when the button is pressed,
// so the page behaves as in production until then.

import type { DevtoolsHooks, Scope } from './client.ts';
import type { ScopeId } from './shared.ts';

// The same key as the core's, without importing the core.
const DEVTOOLS = Symbol.for('brumate.devtools');

/** Something that happened on the page, for the log of the panel. */
export interface DevtoolsEntry {
  time: number;
  kind: 'handler' | 'part' | 'write' | 'call';
  text: string;
  /** The scope of a write, so the panel can mark it. */
  scope?: ScopeId;
  /** For a write: the component, the scope in the compiled component, and the slot. */
  write?: { component: string; k: number; slot: number };
}

/** Code of a component that loaded, or is loading, for the Loading tab. */
export interface LoadEntry {
  component: string;
  /** The part, such as `h3` or `update`, `entry` for the module, or `all` for a merged module. */
  part: string;
  /**
   * Why it loaded: `event`, `block`, `call`, `template`, `state`, `write`, `error`, `reset` or
   * `prop`, or a preload: `hover`, `visible`, `idle` or `eager`.
   */
  reason: string;
  start: number;
  end?: number;
  failed?: boolean;
  /** For a preload: true once something ran the code, such as a handler. */
  used: boolean;
}

/** A block of the page that renders later, for the Blocks tab. */
export interface BlockEntry {
  kind: 'loading' | 'defer' | 'client' | '$client';
  /** The boundary of `#loading` and `#defer`, or the `b-b` of the template of the others. */
  id: string;
  /** The trigger of `#defer`, `#client` and `$client`. */
  trigger?: string;
  /** The reference that `#client` and `$client` run. */
  ref?: string;
  /** The template that the loader reads for `#defer`, `#client` and `$client`. */
  template?: Element;
  state: 'waiting' | 'loading' | 'streaming' | 'rendered' | 'failed';
  /** When the panel first saw the block, when its trigger fired, and when it rendered. */
  seen: number;
  fired?: number;
  rendered?: number;
}

/** The loads that are preloads, which the Loading tab marks when nothing used them. */
export const PRELOADS: ReadonlySet<string> = new Set(['hover', 'visible', 'idle', 'eager']);

export interface DevtoolsState {
  scopes?: Map<ScopeId, Scope>;
  /** Writes a slot, as a handler does, so the page updates. */
  set?: (scope: Scope, slot: number, value: unknown) => void;
  /** Runs a reference for an element, as the loader does for a trigger. */
  handle?: (element: Element, ref: string, event?: Event) => Promise<unknown>;
  log: DevtoolsEntry[];
  /** The code that loaded, by `component:part`, in the order it started. */
  loads: Map<string, LoadEntry>;
  /** The blocks of the page, by kind and ID. */
  blocks: Map<string, BlockEntry>;
  /** Asks the server for the body of a `#defer` block now. */
  fire?: (block: BlockEntry) => void;
  /** The scopes written since the panel last drew, by scope ID. */
  written: Set<ScopeId>;
  /** The URL prefix of the inspect endpoint of the dev server. */
  endpoint: string;
  /** Called after each change, while the panel is open. */
  changed?: () => void;
}

const MAX_LOG = 300;

/** The root scope of a scope, whose `m` names its component. */
export function rootOf(scope: Scope): Scope {
  let root = scope;
  while (root.p) {
    root = root.p;
  }
  return root;
}

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

/**
 * Reads the blocks of the page from their markers, and updates their state.
 * Returns true when something changed.
 *
 * - `#defer`: a `<template b-defer>`, and `<!--l…-->` around its fallback until its body arrives.
 * - `#loading`: `<!--l…-->` around its fallback until the server streams its body.
 * - `#client`: a `<template b-client>` with a `#k` reference, and a marker that gets `:1` once
 *   its body rendered.
 * - `$client`: a `<template b-client>` with a `#c` reference.
 */
export function scanBlocks(state: DevtoolsState): boolean {
  const now = performance.now();
  let changed = false;
  const open = new Map<string, Comment>();
  const markers = new Map<string, Comment>();
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Comment).data;
    if (/^l[\d.-]+$/.test(data)) {
      open.set(data.slice(1), node as Comment);
    } else if (/^b-?[\d.]+:\d+/.test(data)) {
      markers.set(data.slice(1).split(':').slice(0, 2).join(':'), node as Comment);
    }
  }
  const seen = new Set<string>();
  const update = (key: string, make: () => BlockEntry, next: BlockEntry['state']): void => {
    seen.add(key);
    let block = state.blocks.get(key);
    if (!block) {
      block = make();
      state.blocks.set(key, block);
      changed = true;
    }
    if (block.state === 'rendered' || block.state === next) {
      return;
    }
    // A `#defer` that asked for its body and still shows its fallback did not get it.
    if (block.state === 'loading' && next === 'waiting') {
      return;
    }
    block.state = next;
    if (next === 'rendered') {
      block.rendered = now;
    }
    changed = true;
  };
  const deferBoundaries = new Set<string>();
  for (const template of document.querySelectorAll('template[b-defer]')) {
    const [trigger, boundary] = template.getAttribute('b-defer')!.split(':') as [string, string];
    deferBoundaries.add(boundary);
    update(
      `defer:${boundary}`,
      () => ({ kind: 'defer', id: boundary, trigger, template, state: 'waiting', seen: now }),
      open.has(boundary) ? 'waiting' : 'rendered',
    );
  }
  for (const boundary of open.keys()) {
    if (!deferBoundaries.has(boundary)) {
      update(
        `loading:${boundary}`,
        () => ({ kind: 'loading', id: boundary, state: 'streaming', seen: now }),
        'streaming',
      );
    }
  }
  for (const template of document.querySelectorAll('template[b-client]')) {
    const [trigger, ref] = template.getAttribute('b-client')!.split('=') as [string, string];
    const id = template.getAttribute('b-b') ?? '';
    const block = /#k\d+$/.test(ref);
    const marker = markers.get(id);
    update(
      `client:${id}`,
      () => ({
        kind: block ? 'client' : '$client',
        id,
        trigger,
        ref,
        template,
        state: 'waiting',
        seen: now,
      }),
      // A `$client` callback has run once its trigger fired.
      (
        block
          ? marker && marker.data.split(':').length > 2
          : state.blocks.get(`client:${id}`)?.fired
      )
        ? 'rendered'
        : 'waiting',
    );
  }
  // A `#loading` block whose markers are gone rendered its body. Other blocks that left the page,
  // such as on navigation, are dropped.
  for (const [key, block] of state.blocks) {
    if (seen.has(key)) {
      continue;
    }
    if (block.kind === 'loading') {
      if (block.state === 'streaming') {
        block.state = 'rendered';
        block.rendered = now;
        changed = true;
      }
    } else if (!block.template?.isConnected) {
      state.blocks.delete(key);
      changed = true;
    }
  }
  return changed;
}

/** Listens to the core, and adds the button that opens the panel. */
export function installDevtools(endpoint = '/__brumate/inspect', rpc = '/_brumate'): DevtoolsState {
  const state: DevtoolsState = {
    log: [],
    loads: new Map(),
    blocks: new Map(),
    written: new Set(),
    endpoint,
  };
  const load = (component: string, part: string, reason: string, done: Promise<unknown>): void => {
    const key = `${component}:${part}`;
    const known = state.loads.get(key);
    if (known) {
      // The same code again, for a reason that is not a preload: the preload was used.
      if (!PRELOADS.has(reason)) {
        known.used = true;
      }
      return;
    }
    const entry: LoadEntry = { component, part, reason, start: performance.now(), used: false };
    state.loads.set(key, entry);
    done.then(
      () => {
        entry.end = performance.now();
        state.changed?.();
      },
      () => {
        entry.end = performance.now();
        entry.failed = true;
        state.changed?.();
      },
    );
    state.changed?.();
  };
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
      state.set = core.set;
      state.handle = core.handle;
      state.changed?.();
    },
    load,
    defer(template, done) {
      deferred(template, done);
    },
    handler(ref, element, event) {
      // The code of a handler runs, so a preload of its part was used.
      const [component, name] = ref.split('@')[0]!.split('#') as [string, string];
      const part = state.loads.get(`${component}:${/^[hct]\d/.test(name) ? name : 'update'}`);
      if (part) {
        part.used = true;
      }
      if (element.tagName === 'TEMPLATE') {
        const block = [...state.blocks.values()].find((item) => item.template === element);
        if (block && block.fired === undefined) {
          block.fired = performance.now();
          if (block.kind === '$client') {
            block.state = 'rendered';
            block.rendered = block.fired;
          }
        }
      }
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
      const root = rootOf(scope);
      add({
        kind: 'write',
        text: `scope ${scope.id} slot ${slot} = ${preview(value)}`,
        scope: scope.id,
        write: { component: root.m ?? '', k: scope.k, slot },
      });
    },
  };
  (globalThis as Record<symbol, DevtoolsHooks | undefined>)[DEVTOOLS] = hooks;

  // Server function calls, with how long each took and how it answered.
  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(`${rpc}/`)) {
      return original(input, init);
    }
    const name = decodeURIComponent(url.pathname.slice(rpc.length + 1));
    const started = performance.now();
    try {
      const response = await original(input, init);
      const took = Math.round(performance.now() - started);
      const redirect = response.headers.get('x-brumate-redirect');
      add({
        kind: 'call',
        text: `${name}: ${redirect ? `redirect to ${redirect}` : response.status} in ${took} ms`,
      });
      return response;
    } catch (error) {
      add({
        kind: 'call',
        text: `${name}: failed, ${error instanceof Error ? error.message : String(error)}`,
      });
      throw error;
    }
  };

  // Blocks: the markers of the page tell their state, so the panel follows the changes of the DOM.
  const deferred = (template: Element, done: Promise<unknown>): void => {
    const block = [...state.blocks.values()].find((item) => item.template === template);
    if (block) {
      block.fired ??= performance.now();
      block.state = 'loading';
    }
    void done.finally(() => {
      scanBlocks(state);
      state.changed?.();
    });
  };
  state.fire = (block) => {
    if (block.kind === 'defer' && block.template) {
      deferred(
        block.template,
        import('./defer.ts').then((module) => module.loadDeferred(block.template!)),
      );
    } else if (block.template && block.ref) {
      void state.handle?.(block.template, block.ref);
    }
  };
  if (typeof MutationObserver !== 'undefined') {
    let queued = false;
    new MutationObserver(() => {
      if (!queued) {
        queued = true;
        queueMicrotask(() => {
          queued = false;
          if (scanBlocks(state)) {
            state.changed?.();
          }
        });
      }
    }).observe(document, { childList: true, subtree: true, characterData: true });
  }
  scanBlocks(state);

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
