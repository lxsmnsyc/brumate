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

/** What the plugin tells the devtools about the dev server. */
export interface DevtoolsMeta {
  version?: string;
  vite?: string;
}

/** An error for the Errors tab: of a render on the server, of Vite, or of code in the browser. */
export interface ErrorEntry {
  time: number;
  source: 'server' | 'compile' | 'browser';
  message: string;
  stack?: string;
  /** The lines around the error, as Vite's overlay shows them. */
  frame?: string;
  /** The place of the error, such as a compile error in a `.brm` file. */
  loc?: { file: string; line: number; column: number };
  /** The plugin that threw it, such as `brumate`. */
  plugin?: string;
}

/** What Vite's overlay gets, and what `errorPage` sends. */
export interface ErrorPayload {
  message: string;
  stack?: string;
  frame?: string;
  plugin?: string;
  id?: string;
  loc?: { file?: string; line: number; column: number };
}

/** The part of `import.meta.hot` that the devtools listen to. */
interface HotContext {
  on(event: string, listener: (payload: never) => void): void;
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
  /** The versions of brumate and Vite, from the plugin. */
  meta: DevtoolsMeta;
  /** The errors of the page, oldest first. */
  errors: ErrorEntry[];
  /** Opens the panel on a tab, such as `errors`. */
  open?: (tab: string) => void;
  /** Shows the number of errors on the tab. */
  errorCount?: () => void;
  /** While the panel is open: sets its top edge to a place of the pointer, and keeps it. */
  resize?: (clientY: number) => void;
  resized?: () => void;
  /** Called after each change, while the panel is open. */
  changed?: () => void;
}

const MAX_LOG = 300;

/** The logo of brumate: a lowercase b on the orange of the site. */
export const LOGO = `<svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true"><defs><linearGradient id="brumate-logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc38a"/><stop offset=".5" stop-color="#ee7a3e"/><stop offset="1" stop-color="#e0445a"/></linearGradient></defs><circle cx="16" cy="16" r="15" fill="url(#brumate-logo)"/><path d="M11.5 7.5v16" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><circle cx="16.6" cy="18.4" r="5.1" fill="none" stroke="#fff" stroke-width="3.2"/></svg>`;

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

/**
 * Adds an error to the Errors tab. An error of the server or of Vite opens
 * the panel on it, as Vite's overlay would. An error of the browser only
 * counts on the button.
 */
export function reportError(
  state: DevtoolsState,
  payload: ErrorPayload,
  source: ErrorEntry['source'],
): void {
  const file = payload.loc?.file ?? payload.id;
  const entry: ErrorEntry = {
    time: performance.now(),
    // An error of a plugin, such as a compile error, is one, even when a render met it.
    source: source === 'server' && payload.plugin ? 'compile' : source,
    message: payload.message,
    ...(payload.stack ? { stack: payload.stack } : {}),
    ...(payload.frame ? { frame: payload.frame } : {}),
    ...(payload.plugin ? { plugin: payload.plugin } : {}),
    ...(payload.loc && file
      ? { loc: { file, line: payload.loc.line, column: payload.loc.column } }
      : {}),
  };
  // The same error again, such as on each request for the page, counts once.
  const last = state.errors.at(-1);
  if (last?.message !== entry.message || last.stack !== entry.stack) {
    state.errors.push(entry);
    if (state.errors.length > 50) {
      state.errors.shift();
    }
  }
  state.errorCount?.();
  state.changed?.();
  if (source !== 'browser') {
    state.open?.('errors');
  }
}

/** True for an error of code that is not of the page, such as of a browser extension. */
const foreign = (stack: string | undefined, file = ''): boolean =>
  /^[a-z-]+-extension:/.test(file) ||
  (stack !== undefined && /[a-z-]+-extension:\/\//.test(stack) && !stack.includes(location.origin));

/** Listens to the core, and adds the button that opens the panel. */
export function installDevtools(
  endpoint = '/__brumate/inspect',
  rpc = '/_brumate',
  meta: DevtoolsMeta = {},
  hot?: HotContext,
): DevtoolsState {
  const state: DevtoolsState = {
    log: [],
    loads: new Map(),
    blocks: new Map(),
    written: new Set(),
    endpoint,
    meta,
    errors: [],
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
  const style = document.createElement('style');
  style.textContent = `
.open { position: fixed; right: 24px; bottom: 0; z-index: 2147483647; display: flex; align-items: center; gap: 7px; height: 28px; padding: 0 9px 0 8px; border: 1px solid #2f2c31; border-bottom: 0; border-radius: 9px 9px 0 0; background: #19181a; color: #ece8e4; font: 600 12px/1 system-ui, -apple-system, sans-serif; letter-spacing: -0.01em; cursor: pointer; box-shadow: 0 -4px 18px #0005; transition: height 0.15s, background 0.15s; touch-action: none; }
.open:hover { height: 32px; background: #222023; }
.open:focus-visible { outline: 2px solid #ee7a3e; outline-offset: 2px; }
.open .mark { display: inline-flex; width: 16px; height: 16px; }
.open .chevron { width: 10px; height: 10px; opacity: 0.6; transition: transform 0.15s; }
.open[aria-expanded="true"] .chevron { transform: rotate(180deg); }
.count { min-width: 16px; height: 16px; padding: 0 5px; box-sizing: border-box; border-radius: 8px; background: #e5484d; color: #fff; font: 700 10px/16px system-ui, sans-serif; text-align: center; }
.count:empty { display: none; }
@media (prefers-reduced-motion: reduce) { .open, .open .chevron { transition: none; } }
`;
  const button = document.createElement('button');
  button.className = 'open';
  button.title = 'Open the brumate devtools. Drag to resize.';
  button.setAttribute('aria-expanded', 'false');
  // A tab on the bottom edge, which pulls the panel up, and sits on its top edge while it is open.
  button.innerHTML = `<span class="mark">${LOGO}</span><span>brumate</span><span class="count"></span><svg class="chevron" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 6.5 5 3.5 8 6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  // The number of errors, in red on the tab, so an error shows while the panel is closed.
  const count = button.querySelector<HTMLElement>('.count')!;
  state.errorCount = (): void => {
    count.textContent = state.errors.length > 0 ? String(state.errors.length) : '';
    count.title = `${state.errors.length} errors`;
  };
  // Dragging the tab of an open panel changes its height. A click opens or closes it.
  let drag: { y: number; moved: boolean } | undefined;
  let dragged = false;
  button.addEventListener('pointerdown', (event) => {
    if (state.resize) {
      drag = { y: event.clientY, moved: false };
      button.setPointerCapture(event.pointerId);
    }
  });
  button.addEventListener('pointermove', (event) => {
    if (drag && (drag.moved || Math.abs(event.clientY - drag.y) > 4)) {
      drag.moved = true;
      state.resize?.(event.clientY);
    }
  });
  button.addEventListener('pointerup', () => {
    dragged = drag?.moved ?? false;
    drag = undefined;
    if (dragged) {
      state.resized?.();
    }
  });
  button.addEventListener('click', () => {
    if (dragged) {
      dragged = false;
      return;
    }
    void import('./devtools-panel.ts').then(({ togglePanel }) => togglePanel(root, state));
  });
  state.open = (tab) => {
    void import('./devtools-panel.ts').then(({ openPanel }) => openPanel(root, state, tab));
  };
  root.append(style, button);

  // Errors of code of the page in the browser. Errors of other code are left out.
  addEventListener('error', (event) => {
    const stack = (event.error as Error | undefined)?.stack;
    if (foreign(stack, event.filename)) {
      return;
    }
    reportError(
      state,
      { message: event.message, stack: (event.error as Error | undefined)?.stack },
      'browser',
    );
  });
  addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as Error | undefined;
    if (foreign(reason?.stack)) {
      return;
    }
    reportError(
      state,
      { message: reason?.message ?? String(event.reason), stack: reason?.stack },
      'browser',
    );
  });
  // Errors of Vite, such as a compile error after an edit, which its overlay would show. A good
  // update after them clears them.
  hot?.on('vite:error', (payload: { err: ErrorPayload }) => {
    reportError(state, payload.err, 'compile');
  });
  hot?.on('vite:afterUpdate', () => {
    const before = state.errors.length;
    state.errors = state.errors.filter((error) => error.source !== 'compile');
    if (state.errors.length !== before) {
      state.errorCount?.();
      state.changed?.();
    }
  });
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
