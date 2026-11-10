// The chrome of the dock: the header with the version, the workspace nav and the tool buttons, the
// edge that resizes the dock, and the footer. The entry draws the workspaces into `body`.

import { LOGO } from '../devtools.ts';
import type { DevtoolsState } from '../devtools.ts';
import { element, svg } from './dom.ts';
import { kilobytes, stateBytes } from './format.ts';
import { collectModules, countBlocks, roots } from './info.ts';
import type { Workspace, WorkspaceId } from './workspace.ts';

/** The edge that the dock is attached to. */
export type Side = 'bottom' | 'right';

/** The names of what the dock keeps for the next open. */
type Pref = 'height' | 'width' | 'side' | 'workspace';

const PREFS: Record<Pref, string> = {
  height: 'brumate:devtools:height',
  width: 'brumate:devtools:width',
  side: 'brumate:devtools:side',
  workspace: 'brumate:devtools:workspace',
};

/** The least and the greatest size of the dock, in pixels or as a share of the window. */
export const LIMITS = {
  height: { min: 160, share: 0.9 },
  width: { min: 340, share: 0.7 },
};

/** Reads what the dock kept, or nothing. */
export function readPref(name: Pref): string | undefined {
  try {
    return localStorage.getItem(PREFS[name]) ?? undefined;
  } catch {
    // Storage can be off. The default stays.
    return undefined;
  }
}

/** Keeps a choice for the next open. */
export function writePref(name: Pref, value: string): void {
  try {
    localStorage.setItem(PREFS[name], value);
  } catch {
    // Storage can be off.
  }
}

/** The strokes of the icons of the header, on a grid of 24. */
const GLYPHS = {
  inspect: '<path d="M4 6h16M4 12h10M4 18h6"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  issues: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
  page: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pick: '<path d="M4 4l7 17 2.5-7.5L21 11z"/>',
  updates: '<rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="3 3"/>',
  side: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
} as const;

function glyph(name: keyof typeof GLYPHS, size: number): SVGElement {
  const node = svg('svg', {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  node.innerHTML = GLYPHS[name];
  return node;
}

function toolButton(name: keyof typeof GLYPHS, label: string): HTMLButtonElement {
  return element('button', { class: 'tbtn', title: label, 'aria-label': label }, glyph(name, 15));
}

/** The parts of the chrome that the entry reads and draws into. */
export interface Chrome {
  panel: HTMLElement;
  edge: HTMLElement;
  /** Where the open workspace draws. */
  body: HTMLElement;
  tabs: Map<WorkspaceId, HTMLButtonElement>;
  counts: Map<WorkspaceId, HTMLElement>;
  indicator: HTMLElement;
  search: HTMLButtonElement;
  pick: HTMLButtonElement;
  updates: HTMLButtonElement;
  side: HTMLButtonElement;
  close: HTMLButtonElement;
  /** The parts of the footer that change. */
  live: HTMLElement;
  facts: { route: HTMLElement; components: HTMLElement; scopes: HTMLElement; size: HTMLElement };
  up: HTMLElement;
}

/** The chrome of a closed dock, with the nav of the workspaces. */
export function createChrome(state: DevtoolsState, workspaces: Workspace[]): Chrome {
  const tabs = new Map<WorkspaceId, HTMLButtonElement>();
  const counts = new Map<WorkspaceId, HTMLElement>();
  const indicator = element('span', { class: 'ind' });
  const nav = element(
    'nav',
    { class: 'ws', role: 'tablist', 'aria-label': 'Workspaces' },
    indicator,
  );
  for (const workspace of workspaces) {
    const count = element('span', { class: workspace.id === 'issues' ? 'c red' : 'c' });
    const button = element(
      'button',
      { role: 'tab', 'data-ws': workspace.id, title: workspace.label },
      glyph(workspace.id, 14),
      element('span', { class: 'l' }, workspace.label),
      count,
    );
    tabs.set(workspace.id, button);
    counts.set(workspace.id, count);
    nav.append(button);
  }

  const mark = element('i');
  mark.innerHTML = LOGO;
  const vite = state.meta.vite ? ` · Vite ${state.meta.vite}` : '';
  const brand = element(
    'div',
    { class: 'brand' },
    mark,
    element('b', {}, 'brumate'),
    element(
      'span',
      { class: 'ver', title: `brumate ${state.meta.version ?? '?'}${vite}` },
      state.meta.version ?? '?',
    ),
  );

  const search = element(
    'button',
    { class: 'cmd', 'aria-label': 'Search', title: 'Search (Cmd+K)' },
    glyph('search', 14),
    element('span', { class: 't' }, 'Search'),
    element('kbd', {}, '⌘K'),
  );
  const pick = toolButton('pick', 'Pick an element');
  pick.setAttribute('aria-pressed', 'false');
  pick.title = 'Click an element of the page to see its scope, handlers and code';
  const updates = toolButton('updates', 'Outline updates');
  updates.setAttribute('aria-pressed', String(state.flash));
  updates.title = 'Outline the elements that change: green now and then, red often';
  const side = toolButton('side', 'Dock to the right');
  side.setAttribute('aria-pressed', 'false');
  const close = toolButton('close', 'Close (Esc)');

  const live = element('span', { class: 'live' }, element('i'), 'live');
  const facts = {
    route: element('b'),
    components: element('b'),
    scopes: element('b'),
    size: element('b'),
  };
  const up = element('b');
  const viteFact = element('span', {});
  if (state.meta.vite) {
    viteFact.append('Vite ', element('b', {}, state.meta.vite));
  }
  const edge = element('div', {
    class: 'edge',
    role: 'separator',
    tabindex: '0',
    'aria-label': 'Resize the dock',
    title: 'Drag, or use the arrow keys',
  });
  const body = element('div', { class: 'body' });
  const panel = element(
    'section',
    { class: 'panel bottom', 'aria-label': 'brumate dev dock' },
    edge,
    element(
      'header',
      { class: 'head' },
      brand,
      nav,
      element('span', { class: 'grow' }),
      search,
      pick,
      updates,
      side,
      close,
    ),
    body,
    element(
      'footer',
      { class: 'foot' },
      live,
      element('span', {}, facts.route),
      element('span', {}, facts.components, ' components'),
      element('span', {}, facts.scopes, ' scopes'),
      element('span', {}, facts.size, ' page state'),
      element('span', { class: 'grow' }),
      viteFact,
      element('span', {}, 'up ', up),
    ),
  );
  return {
    panel,
    edge,
    body,
    tabs,
    counts,
    indicator,
    search,
    pick,
    updates,
    side,
    close,
    live,
    facts,
    up,
  };
}

/** Moves the highlight of the nav under the selected workspace. */
export function placeIndicator(chrome: Chrome, current: WorkspaceId): void {
  const button = chrome.tabs.get(current)!;
  chrome.indicator.style.left = `${button.offsetLeft}px`;
  chrome.indicator.style.width = `${button.offsetWidth}px`;
}

/** Sets the side of the dock, with the label of the button that switches it. */
export function applySide(chrome: Chrome, side: Side): void {
  chrome.panel.classList.toggle('bottom', side === 'bottom');
  chrome.panel.classList.toggle('right', side === 'right');
  chrome.side.setAttribute('aria-pressed', String(side === 'right'));
  const label = side === 'right' ? 'Dock to the bottom' : 'Dock to the right';
  chrome.side.title = label;
  chrome.side.setAttribute('aria-label', label);
}

/** The selected workspace, the counts of the nav and the footer. */
export function drawChrome(
  chrome: Chrome,
  state: DevtoolsState,
  current: WorkspaceId,
  paused: boolean,
): void {
  for (const [id, button] of chrome.tabs) {
    button.setAttribute('aria-selected', String(id === current));
    button.tabIndex = id === current ? 0 : -1;
  }
  placeIndicator(chrome, current);
  const errors = state.errors.length;
  const entries = state.log.length;
  chrome.counts.get('activity')!.textContent = entries > 0 ? String(entries) : '';
  chrome.counts.get('issues')!.textContent = errors > 0 ? String(errors) : '';
  chrome.tabs
    .get('issues')!
    .setAttribute('aria-label', errors > 0 ? `Issues, ${errors}` : 'Issues');

  const list = roots(state);
  chrome.live.classList.toggle('paused', paused);
  chrome.live.lastChild!.textContent = paused ? 'paused' : 'live';
  chrome.facts.route.textContent = location.pathname + location.search;
  chrome.facts.components.textContent = String(collectModules(list).size);
  chrome.facts.scopes.textContent = String(state.scopes?.size ?? 0);
  chrome.facts.size.textContent = kilobytes(stateBytes());
  // Blocks that wait for their trigger show on the title of the page entry of the nav.
  const waiting = countBlocks(state.blocks.values(), 'waiting');
  chrome.tabs.get('page')!.title =
    waiting > 0 ? `Page · ${waiting} blocks wait for their trigger` : 'Page';
  chrome.up.textContent = `${Math.round(performance.now() / 1000)} s`;
}
