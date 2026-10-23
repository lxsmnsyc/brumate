// The devtools overlay of development builds. This module only listens to
// the core and shows a button. The panel loads when the button is pressed,
// so the page behaves as in production until then.

import type { DevtoolsHooks, Scope } from './client.ts';
import type * as Panel from './devtools-panel.ts';
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

/** A server function call, for the Timeline tab. */
export interface CallTiming {
  name: string;
  start: number;
  end?: number;
  /** The status of the answer, `redirect` for a redirect, or `failed`. */
  status?: number | 'redirect' | 'failed';
  /** How long the function took on the server, from the `Server-Timing` of the dev server. */
  server?: number;
}

/** A batch of updates that a write ran, with its effects. */
export interface UpdateTiming {
  count: number;
  start: number;
  end: number;
}

/**
 * A handler that ran, for the Timeline tab: when its event came, when its
 * code was ready and the handlers before it had started, when its call
 * returned, and when the promise of an async handler settled. The server
 * calls and the updates that ran meanwhile are its own.
 */
export interface Interaction {
  ref: string;
  /** What happened, such as `click on <button>`. */
  label: string;
  begun: number;
  ready: number;
  end: number;
  settled?: number;
  failed?: boolean;
  calls: CallTiming[];
  updates: UpdateTiming[];
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
  /** The handlers that ran, oldest first, with their calls and updates. */
  timeline: Interaction[];
  /** Opens the panel on a tab, such as `errors`. */
  open?: (tab: string) => void;
  /** Shows the number of errors on the tab. */
  errorCount?: () => void;
  /** True while the elements that change are outlined on the page. */
  flash: boolean;
  /** Turns the outlines of changed elements on or off, and keeps the choice. */
  setFlash?: (on: boolean) => void;
  /** While the panel is open: sets its top edge to a place of the pointer, and keeps it. */
  resize?: (clientY: number) => void;
  resized?: () => void;
  /** Called after each change, while the panel is open. */
  changed?: () => void;
}

const MAX_LOG = 300;

/**
 * The logo of brumate: the pole and the bowl of a b, in outline, where the
 * pole runs through the left of the bowl. The part they share is orange.
 */
export const LOGO = `<svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true"><defs><linearGradient id="brumate-logo-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc38a"/><stop offset=".5" stop-color="#ee7a3e"/><stop offset="1" stop-color="#e0445a"/></linearGradient><clipPath id="brumate-logo-pole"><rect x="7.5" y="2.5" width="8" height="27" rx="4"/></clipPath></defs><circle cx="18" cy="19.5" r="10" fill="url(#brumate-logo-fill)" clip-path="url(#brumate-logo-pole)"/><g fill="none" stroke="#ece8e4" stroke-width="2.2"><rect x="7.5" y="2.5" width="8" height="27" rx="4"/><circle cx="18" cy="19.5" r="10"/></g></svg>`;

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

/** The code of the panel, which loads when it opens. */
const panelModule = (): Promise<typeof Panel> => import('./devtools-panel.ts');

/** Where the choice to outline changed elements is kept. */
const FLASH_KEY = 'brumate:devtools:flash';
/** How long an outline shows. */
const FLASH_MS = 700;
/** The most outlines that one frame draws, so a big change does not stall the page. */
const MAX_FLASHES = 200;

/**
 * Outlines the elements that change, as an update writes them: green for an
 * element that changes now and then, yellow and red for one that changes
 * often. A MutationObserver sees every change of the page, so it needs no
 * hook of the core. The outlines are drawn in the shadow root, so the page
 * itself does not change.
 */
function installFlash(state: DevtoolsState, root: ShadowRoot, host: Element): void {
  const layer = document.createElement('div');
  layer.className = 'flashes';
  root.append(layer);
  // How many times each element changed lately, for its colour.
  const heat = new WeakMap<Element, { count: number; time: number }>();
  const pending = new Set<Element>();
  let frame = 0;
  const draw = (): void => {
    frame = 0;
    let drawn = 0;
    for (const target of pending) {
      if (drawn >= MAX_FLASHES) {
        break;
      }
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        continue;
      }
      const now = performance.now();
      const last = heat.get(target);
      const count = last && now - last.time < 1000 ? last.count + 1 : 1;
      heat.set(target, { count, time: now });
      const box = document.createElement('div');
      box.className = `flash ${count >= 5 ? 'hot' : count >= 2 ? 'warm' : ''}`;
      box.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
      layer.append(box);
      setTimeout(() => box.remove(), FLASH_MS);
      drawn++;
    }
    pending.clear();
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      let target: Node | null = record.target;
      if (record.type === 'childList') {
        // The elements that came in, or else the element that lost some.
        const added = [...record.addedNodes].filter((node) => node.nodeType === 1);
        for (const node of added) {
          pending.add(node as Element);
        }
        if (added.length > 0) {
          continue;
        }
      }
      if (target.nodeType !== 1) {
        target = target.parentElement;
      }
      if (
        target &&
        target !== host &&
        target !== document.documentElement &&
        target !== document.body
      ) {
        pending.add(target as Element);
      }
    }
    for (const target of pending) {
      // The devtools change their own markup, and the host carries their styles.
      if (target === host || host.contains(target)) {
        pending.delete(target);
      }
    }
    if (pending.size > 0 && frame === 0) {
      frame = requestAnimationFrame(draw);
    }
  });
  state.setFlash = (on) => {
    state.flash = on;
    if (on) {
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    } else {
      observer.disconnect();
      pending.clear();
      layer.replaceChildren();
    }
    try {
      localStorage.setItem(FLASH_KEY, on ? '1' : '0');
    } catch {
      // Storage can be off.
    }
    state.changed?.();
  };
  let saved = false;
  try {
    saved = localStorage.getItem(FLASH_KEY) === '1';
  } catch {
    // Storage can be off.
  }
  if (saved) {
    state.setFlash(true);
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
    timeline: [],
    flash: false,
  };
  /** The handler that a server call or an update that starts now belongs to. */
  const owner = (time: number): Interaction | undefined => {
    for (let index = state.timeline.length - 1; index >= 0; index--) {
      const run = state.timeline[index]!;
      // An update of the answer of a call comes a moment after the handler settled.
      if (run.begun <= time && (run.settled === undefined || time <= run.settled + 32)) {
        return run;
      }
    }
    return undefined;
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
    handled(run) {
      const entry: Interaction = {
        ref: run.ref,
        label: `${run.event ?? 'call'} on <${run.element.tagName.toLowerCase()}>`,
        begun: run.begun,
        ready: run.ready,
        end: run.end,
        calls: [],
        updates: [],
      };
      if (run.result instanceof Promise) {
        run.result.then(
          () => {
            entry.settled = performance.now();
            state.changed?.();
          },
          () => {
            entry.settled = performance.now();
            entry.failed = true;
            state.changed?.();
          },
        );
      } else {
        entry.settled = run.end;
      }
      state.timeline.push(entry);
      if (state.timeline.length > 100) {
        state.timeline.shift();
      }
      state.changed?.();
    },
    updated(count, start, end) {
      if (count > 0) {
        owner(start)?.updates.push({ count, start, end });
      }
    },
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
    const call: CallTiming = { name, start: started };
    owner(started)?.calls.push(call);
    try {
      const response = await original(input, init);
      const took = Math.round(performance.now() - started);
      const redirect = response.headers.get('x-brumate-redirect');
      call.end = performance.now();
      call.status = redirect ? 'redirect' : response.status;
      const server = /brumate;dur=([\d.]+)/.exec(response.headers.get('server-timing') ?? '');
      if (server) {
        call.server = Number(server[1]);
      }
      state.changed?.();
      add({
        kind: 'call',
        text: `${name}: ${redirect ? `redirect to ${redirect}` : response.status} in ${took} ms`,
      });
      return response;
    } catch (error) {
      call.end = performance.now();
      call.status = 'failed';
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
.open { position: fixed; left: 50%; bottom: 0; z-index: 2147483647; transform: translateX(-50%); display: flex; justify-content: center; padding: 8px 16px 0; border: 0; background: none; color: #ece8e4; font: 600 12px/1 system-ui, -apple-system, sans-serif; cursor: pointer; touch-action: none; outline: none; }
.open[hidden] { display: none; }
.grip { width: 40px; height: 5px; border-radius: 4px 4px 0 0; background: rgb(25 24 26 / 0.88); box-shadow: 0 0 0 1px rgb(255 255 255 / 0.3); transition: opacity 150ms cubic-bezier(0.4, 0, 0.2, 1), width 150ms cubic-bezier(0.4, 0, 0.2, 1); }
.open[data-errors] .grip { width: 56px; background: #e5484d; }
.content { position: absolute; left: 50%; bottom: 0; transform: translate(-50%, 100%); display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 10px; white-space: nowrap; background: #222023; border: 1px solid #2f2c31; border-bottom: 0; border-radius: 10px 10px 0 0; box-shadow: 0 -4px 16px rgb(0 0 0 / 0.3); opacity: 0; pointer-events: none; transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms cubic-bezier(0.4, 0, 0.2, 1); }
.open:hover .content, .open:focus-visible .content, .open:active .content { transform: translate(-50%, 0); opacity: 1; pointer-events: auto; }
.open:hover .grip, .open:focus-visible .grip, .open:active .grip { opacity: 0; }
.open:focus-visible .content { border-color: #ee7a3e; }
.mark { display: inline-flex; width: 16px; height: 16px; }
.version { padding: 1px 8px; border-radius: 999px; background: rgb(238 122 62 / 0.16); color: #ffb48a; font: 600 12px/20px ui-monospace, SFMono-Regular, Menlo, monospace; }
.chevron { width: 12px; height: 12px; color: #a39a92; }
.count { min-width: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: #e5484d; color: #fff; font: 600 11px/18px system-ui, sans-serif; text-align: center; }
.count:empty { display: none; }
.flashes { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
.flash { position: fixed; box-sizing: border-box; border: 2px solid #7fd99a; border-radius: 3px; background: rgb(127 217 154 / 0.08); animation: flash 700ms ease-out forwards; }
.flash.warm { border-color: #ffd166; background: rgb(255 209 102 / 0.1); }
.flash.hot { border-color: #ff7a7a; background: rgb(255 122 122 / 0.12); }
@keyframes flash { from { opacity: 1; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .flash { animation: none; } }
@media (prefers-reduced-motion: reduce) { .grip, .content { transition: none; } }
`;
  // The closed panel: a grip on the bottom edge that grows into a pull tab on hover or focus, so
  // it covers almost none of the page. A click, or a drag up, opens the panel.
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'open';
  button.title = 'brumate devtools (Alt+Shift+D)';
  button.innerHTML = `<span class="grip"></span><span class="content"><span class="mark">${LOGO}</span><span class="version"></span><span class="count"></span><svg class="chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 7.5 6 4.5 9 7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  // The version of brumate, next to its mark.
  button.querySelector('.version')!.textContent = meta.version ? `v${meta.version}` : 'brumate';
  const label = (): void => {
    const errors = state.errors.length;
    button.setAttribute(
      'aria-label',
      `Open the brumate devtools${meta.version ? `, version ${meta.version}` : ''}${errors > 0 ? `, ${errors} errors` : ''}`,
    );
  };
  label();
  // The number of errors, in red on the tab, and a red grip, so an error shows while it is closed.
  const count = button.querySelector<HTMLElement>('.count')!;
  state.errorCount = (): void => {
    count.textContent = state.errors.length > 0 ? String(state.errors.length) : '';
    button.toggleAttribute('data-errors', state.errors.length > 0);
    label();
  };
  // Dragging the tab up past a few pixels opens the panel under the pointer. A press that does not
  // move is left to the click.
  let dragged = false;
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    const start = event.clientY;
    let opened = false;
    dragged = false;
    const move = (next: PointerEvent): void => {
      if (!opened) {
        if (start - next.clientY < 4) {
          return;
        }
        opened = true;
        dragged = true;
        void panelModule().then(({ openPanel }) => {
          openPanel(root, state, 'overview');
          state.resize?.(next.clientY);
        });
        return;
      }
      state.resize?.(next.clientY);
    };
    // The tab hides as the panel opens, so the pointer is followed on the window.
    const end = (): void => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', end);
      removeEventListener('pointercancel', end);
      if (opened) {
        state.resized?.();
      }
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
  });
  button.addEventListener('click', () => {
    if (dragged) {
      dragged = false;
      return;
    }
    void panelModule().then(({ togglePanel }) => togglePanel(root, state));
  });
  // Alt+Shift+D opens and closes the panel. `code`, because Alt changes the key on macOS.
  addEventListener('keydown', (event) => {
    if (event.altKey && event.shiftKey && event.code === 'KeyD') {
      event.preventDefault();
      void panelModule().then(({ togglePanel }) => togglePanel(root, state));
    }
  });
  state.open = (tab) => {
    void import('./devtools-panel.ts').then(({ openPanel }) => openPanel(root, state, tab));
  };
  root.append(style, button);
  installFlash(state, root, host);

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
