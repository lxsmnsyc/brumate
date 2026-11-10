// The dock of the devtools overlay. It reads the core through the hooks in `devtools.ts`, and asks
// the dev server about each component. It attaches to the bottom or the right edge of the page.
//
// This file is the entry: it opens and closes the dock, keeps its side and size, and holds Pick,
// the keys and the draw loop. The chrome is in `devtools-panel/shell.ts`, the search in
// `devtools-panel/search.ts`, and each workspace draws itself:
//
// - Inspect (`inspect.ts`): the components, their values and their graph.
// - Activity (`activity.ts`): the log, the timeline and the server calls.
// - Issues (`issues.ts`): the errors.
// - Page (`page.ts`): the page, its state and its blocks.

import type { ScopeId } from './shared.ts';
import { findRootScope } from './devtools.ts';
import type { DevtoolsState } from './devtools.ts';
import { activity } from './devtools-panel/activity.ts';
import { drawCallDetail } from './devtools-panel/call-detail.ts';
import { element, pill } from './devtools-panel/dom.ts';
import { drawGraph } from './devtools-panel/graph.ts';
import { drawReads, findAnchor, findScope } from './devtools-panel/info.ts';
import { inspect } from './devtools-panel/inspect.ts';
import { issues } from './devtools-panel/issues.ts';
import { page } from './devtools-panel/page.ts';
import { createSearch } from './devtools-panel/search.ts';
import type { SearchItem } from './devtools-panel/search.ts';
import {
  LIMITS,
  applySide,
  createChrome,
  drawChrome,
  placeIndicator,
  readPref,
  writePref,
} from './devtools-panel/shell.ts';
import type { Side } from './devtools-panel/shell.ts';
import { STYLE } from './devtools-panel/style.ts';
import { createShell, splitPlain } from './devtools-panel/workspace.ts';
import type { DockContext, Shell, Tab, Workspace } from './devtools-panel/workspace.ts';

export { layoutGraph } from './devtools-panel/graph.ts';

/** The workspaces, in the order of the nav. */
const WORKSPACES: Workspace[] = [inspect, activity, issues, page];

/** The workspace with an ID. */
function findWorkspaceById(id: string | undefined): Workspace | undefined {
  for (const workspace of WORKSPACES) {
    if (workspace.id === id) {
      return workspace;
    }
  }
  return undefined;
}

/** The workspace that holds a tab. */
function findWorkspace(tab: Tab): Workspace {
  for (const workspace of WORKSPACES) {
    if (tab in workspace.tabs) {
      return workspace;
    }
  }
  return WORKSPACES[0]!;
}

/** The state of the open panel, or nothing when it is closed. */
let docked: Shell | undefined;
/** What closes the open dock, or reopens it while it slides out. */
let leave: { close(): void; reopen(): void } | undefined;
/** True while the dock slides out. */
let closing = false;

/** Opens the dock on a tab, or switches to it when the dock is open. Without a tab, it opens on the last workspace. */
export function openPanel(root: ShadowRoot, state: DevtoolsState, tab?: string): void {
  if (docked?.panel) {
    if (closing) {
      leave?.reopen();
    }
    if (tab) {
      docked.showTab?.(tab as Tab);
    }
  } else {
    togglePanel(root, state, tab as Tab | undefined);
  }
}

/** The first tab of a workspace, which the nav opens it on. */
function defaultTab(workspace: Workspace): Tab {
  return Object.keys(workspace.tabs)[0] as Tab;
}

/** True on macOS, where Ctrl+K is not the key of the search. */
function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/** Keeps a size between its least and its greatest. */
function clamp(size: number, min: number, max: number): number {
  return Math.min(Math.max(size, min), max);
}

/** Opens the dock, or closes it when it is open. */
export function togglePanel(root: ShadowRoot, state: DevtoolsState, initial?: Tab): void {
  const opener = root.querySelector<HTMLElement>('button.open');
  if (docked?.panel) {
    // The dock slides out, and a second toggle while it does slides it back in.
    if (closing) {
      leave?.reopen();
    } else {
      leave?.close();
    }
    return;
  }
  const remembered = findWorkspaceById(readPref('workspace')) ?? WORKSPACES[0]!;
  const shell = createShell(initial ?? defaultTab(remembered));
  const chrome = createChrome(state, WORKSPACES);
  const { panel, body, pick } = chrome;
  shell.panel = panel;
  panel.prepend(element('style', {}, STYLE));

  let side: Side = readPref('side') === 'right' ? 'right' : 'bottom';
  let height = Number(readPref('height')) || 340;
  let width = Number(readPref('width')) || 480;
  // The page of an error of the server has nothing else to show.
  const errorPage = document.getElementById('brumate-error') !== null;
  if (errorPage) {
    side = 'bottom';
    height = window.innerHeight;
  }

  const ctx: DockContext = {
    root,
    state,
    shell,
    draw,
    select,
    split: splitPlain,
    outline,
    pick: () => pick.click(),
    drawGraph: (scope, info) => drawGraph(ctx, scope, info),
    drawCallDetail: (entry) => drawCallDetail(ctx, entry),
  };

  // The page can scroll past the dock.
  function applySize(): void {
    panel.style.setProperty('--h', `${height}px`);
    panel.style.setProperty('--w', `${width}px`);
    if (errorPage) {
      panel.style.maxHeight = 'none';
    }
    document.documentElement.style.paddingBottom = side === 'bottom' ? `${height}px` : '';
    document.documentElement.style.paddingRight = side === 'right' ? `${width}px` : '';
  }
  function keepSize(): void {
    if (!errorPage) {
      writePref('height', String(Math.round(height)));
    }
    writePref('width', String(Math.round(width)));
  }
  function moveEdge(clientX: number, clientY: number): void {
    if (side === 'bottom') {
      height = clamp(
        window.innerHeight - clientY,
        LIMITS.height.min,
        window.innerHeight * LIMITS.height.share,
      );
    } else {
      width = clamp(
        window.innerWidth - clientX,
        LIMITS.width.min,
        window.innerWidth * LIMITS.width.share,
      );
    }
    applySize();
  }
  docked = shell;
  applySide(chrome, side);
  applySize();
  drawEdge();
  // The dock slides in from its edge.
  panel.classList.add('closed');
  root.append(panel);
  void panel.offsetHeight;
  panel.classList.remove('closed');
  // The grip hides while the dock is open. Close, Escape or Alt+Shift+D closes it.
  if (opener) {
    opener.hidden = true;
  }
  // The grip of the closed dock drags the dock open under the pointer.
  state.resize = (clientY) => {
    if (side === 'bottom') {
      moveEdge(0, clientY);
    }
  };
  state.resized = () => {
    keepSize();
    ctx.draw();
  };
  // The listeners of a drag that is under way, so closing mid-drag leaves none.
  let endDrag: (() => void) | undefined;
  chrome.edge.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    endDrag?.();
    panel.classList.add('dragging');
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- It resizes this dock.
    function move(next: PointerEvent): void {
      moveEdge(next.clientX, next.clientY);
    }
    function up(): void {
      endDrag?.();
      state.resized?.();
    }
    endDrag = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      panel.classList.remove('dragging');
      endDrag = undefined;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  // The arrow keys move the edge, 16 pixels at a time, or 64 with Shift.
  chrome.edge.addEventListener('keydown', (event) => {
    const grow = side === 'bottom' ? 'ArrowUp' : 'ArrowLeft';
    const shrink = side === 'bottom' ? 'ArrowDown' : 'ArrowRight';
    if (event.key !== grow && event.key !== shrink) {
      return;
    }
    event.preventDefault();
    const step = (event.shiftKey ? 64 : 16) * (event.key === grow ? 1 : -1);
    if (side === 'bottom') {
      moveEdge(0, window.innerHeight - (height + step));
    } else {
      moveEdge(window.innerWidth - (width + step), 0);
    }
    drawEdge();
    // Keeps the size and draws the workspaces again, as the end of a drag does.
    state.resized?.();
  });
  function drawEdge(): void {
    chrome.edge.setAttribute('aria-orientation', side === 'bottom' ? 'horizontal' : 'vertical');
    chrome.edge.setAttribute(
      'aria-valuenow',
      String(Math.round(side === 'bottom' ? height : width)),
    );
  }
  chrome.side.addEventListener('click', () => {
    side = side === 'bottom' ? 'right' : 'bottom';
    writePref('side', side);
    applySide(chrome, side);
    applySize();
    drawEdge();
    ctx.draw();
  });
  chrome.close.addEventListener('click', () => togglePanel(root, state));
  chrome.updates.addEventListener('click', () => {
    state.setFlash?.(!state.flash);
    chrome.updates.setAttribute('aria-pressed', String(state.flash));
  });
  for (const [id, button] of chrome.tabs) {
    button.addEventListener('click', () => {
      if (findWorkspace(shell.tab).id !== id) {
        select(id);
      }
    });
  }
  // The arrow keys move along the nav, as a tab list does.
  chrome.tabs.get(WORKSPACES[0]!.id)!.parentElement!.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[(event as KeyboardEvent).key];
    if (!step) {
      return;
    }
    event.preventDefault();
    let at = 0;
    for (const [index, item] of WORKSPACES.entries()) {
      if (item === findWorkspace(shell.tab)) {
        at = index;
      }
    }
    const next = WORKSPACES[(at + step + WORKSPACES.length) % WORKSPACES.length]!;
    select(next.id);
    chrome.tabs.get(next.id)!.focus();
  });
  window.addEventListener('resize', placeNav);
  function placeNav(): void {
    placeIndicator(chrome, findWorkspace(shell.tab).id);
  }

  // Search (Cmd+K) lists the components, the issues and what the dock can do.
  const search = createSearch(ctx, listActions);
  chrome.search.addEventListener('click', () => search.open());
  function listActions(): SearchItem[] {
    const items: SearchItem[] = [
      { group: 'Actions', label: 'Pick an element', hint: '', run: () => ctx.pick() },
      {
        group: 'Actions',
        label: side === 'right' ? 'Dock to the bottom' : 'Dock to the right',
        hint: '',
        run: () => chrome.side.click(),
      },
      {
        group: 'Actions',
        label: state.flash ? 'Stop outlining updates' : 'Outline updates',
        hint: '',
        run: () => chrome.updates.click(),
      },
    ];
    for (const item of WORKSPACES) {
      items.push({
        group: 'Actions',
        label: `Open ${item.label}`,
        hint: '',
        run: () => select(item.id),
      });
    }
    return items;
  }
  // Cmd+K opens the search and Escape closes the dock, unless Pick, the search, or a field
  // that is being typed in, takes the key first.
  function onKey(event: KeyboardEvent): void {
    const target = event.composedPath()[0];
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    if (event.key.toLowerCase() === 'k' && !event.altKey) {
      // Cmd+K always. Ctrl+K is the search off macOS only, and not in a field of the page.
      const ctrl = event.ctrlKey && !isMac() && !(typing && !root.contains(target as Node));
      if (event.metaKey || ctrl) {
        event.preventDefault();
        search.open();
        return;
      }
    }
    if (event.key !== 'Escape' || event.defaultPrevented || search.isOpen() || typing) {
      return;
    }
    if (closing) {
      return;
    }
    togglePanel(root, state);
  }
  window.addEventListener('keydown', onKey);
  const clock = setInterval(() => {
    chrome.up.textContent = `${Math.round(performance.now() / 1000)} s`;
  }, 1000);
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The dock leaves for good: the window, the page and the hooks of the core are as before.
  function finishClose(): void {
    clearTimeout(timer);
    panel.removeEventListener('transitionend', onSlid);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', placeNav);
    clearInterval(clock);
    endDrag?.();
    search.close();
    // Pick may have been armed while the dock slid out.
    shell.endPick?.();
    shell.endPick = undefined;
    panel.remove();
    shell.panel = undefined;
    shell.showTab = undefined;
    docked = undefined;
    leave = undefined;
    closing = false;
    state.changed = undefined;
    document.documentElement.style.removeProperty('padding-bottom');
    document.documentElement.style.removeProperty('padding-right');
    state.resize = undefined;
    state.resized = undefined;
  }
  function onSlid(event: TransitionEvent): void {
    if (event.target === panel && event.propertyName === 'transform') {
      finishClose();
    }
  }
  leave = {
    close(): void {
      // Pick has no button, nor the styles of its card, without the dock.
      shell.endPick?.();
      search.close();
      endDrag?.();
      closing = true;
      if (opener) {
        opener.hidden = false;
        // Focus goes back to the grip, so the keyboard picks up where it left.
        opener.focus();
      }
      // Without a transition (reduced motion, or none) the dock leaves at once.
      if (!(Number.parseFloat(getComputedStyle(panel).transitionDuration) > 0)) {
        finishClose();
        return;
      }
      panel.classList.add('closed');
      panel.addEventListener('transitionend', onSlid);
      timer = setTimeout(finishClose, 400);
    },
    reopen(): void {
      closing = false;
      clearTimeout(timer);
      panel.removeEventListener('transitionend', onSlid);
      panel.classList.remove('closed');
      if (opener) {
        // The grip hides, so focus on it moves to the open workspace in the nav.
        const lost = root.activeElement === opener;
        opener.hidden = true;
        if (lost) {
          chrome.tabs.get(findWorkspace(shell.tab).id)?.focus();
        }
      }
    },
  };
  // Without an event, the core has not loaded yet, and nothing knows the components of the page.
  if (!state.scopes) {
    document.dispatchEvent(new Event('brumate:core'));
  }

  // Outlines the elements of a scope on the page.
  const outlines: HTMLElement[] = [];
  function outline(scope?: ScopeId): void {
    for (const box of outlines.splice(0)) {
      box.remove();
    }
    if (scope === undefined) {
      return;
    }
    for (const target of document.querySelectorAll(`[b-b^="${scope}:"]`)) {
      const rect = target.getBoundingClientRect();
      const box = element('div', {
        class: 'outline',
        style: `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`,
      });
      root.append(box);
      outlines.push(box);
    }
  }

  // Pick: the next click on the page selects the row of its component in Inspect.
  function onPick(event: MouseEvent): void {
    const clicked = event.target as Element | null;
    if (!clicked?.closest || event.composedPath().includes(shell.panel!)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    stopPicking();
    shell.picked = clicked;
    const id = clicked.closest('[b-b]')?.getAttribute('b-b')!.split(':')[0];
    if (id !== undefined) {
      shell.selectedScope = /^-?\d+$/.test(id) ? Number(id) : id;
      const scope = state.scopes?.get(shell.selectedScope);
      shell.selected = scope ? findRootScope(scope).m : shell.selected;
    }
    shell.tab = 'elements';
    ctx.draw();
  }
  // While picking, the element under the pointer is outlined, with a card of what brumate knows
  // about it: its component, its place in the file, its scope, its handlers and what it reads.
  const inspectCard = element('div', { class: 'inspect-card', role: 'tooltip' });
  const hoverBox = element('div', { class: 'outline' });
  let hovered: Element | undefined;
  let hoverToken = 0;
  function onHover(event: PointerEvent): void {
    const target = event.target as Element | null;
    if (!target?.closest || event.composedPath().includes(shell.panel!) || target === hovered) {
      return;
    }
    hovered = target;
    void showCard(target);
  }
  async function showCard(target: Element): Promise<void> {
    const token = ++hoverToken;
    const rect = target.getBoundingClientRect();
    hoverBox.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
    root.append(hoverBox, inspectCard);
    const tag = target.tagName.toLowerCase();
    let classes = '';
    for (const name of [...target.classList].slice(0, 2)) {
      classes += `.${name}`;
    }
    const rows: (Node | string)[] = [
      element(
        'div',
        { class: 'card-head' },
        element('span', { class: 'mono' }, `${tag}${classes}`),
        element('span', { class: 'sub' }, `${Math.round(rect.width)} × ${Math.round(rect.height)}`),
      ),
    ];
    const anchored = target.closest('[b-b]');
    const [id = '', anchorText = '0'] = anchored?.getAttribute('b-b')!.split(':') ?? [];
    const scope = anchored ? findScope(state, id) : undefined;
    if (scope) {
      const { info, component: owner, place } = await findAnchor(state, scope, Number(anchorText));
      if (token !== hoverToken) {
        return;
      }
      rows.push(
        element(
          'div',
          { class: 'card-component' },
          element('strong', {}, info?.name ?? owner.m ?? 'component'),
          element(
            'span',
            { class: 'mono sub' },
            place?.at ? `${info?.file}:${place.at}` : (info?.file ?? ''),
          ),
        ),
        element(
          'div',
          { class: 'sub' },
          `scope ${scope.id} · ${info?.scopes[scope.k]?.label ?? 'scope'}${anchored === target ? '' : ` · in ${place?.label ?? 'an element'}`}`,
        ),
      );
      const handled = target.closest('[b-on]');
      if (handled && anchored!.contains(handled)) {
        const handlers = element('div', { class: 'card-pills' });
        for (const raw of (handled.getAttribute('b-on') ?? '').split(/\s+/)) {
          if (!raw) {
            continue;
          }
          const [head] = raw.split('=') as [string];
          handlers.append(pill(head));
        }
        rows.push(handlers);
      }
      if (place && place.reads.length > 0) {
        rows.push(
          element('div', { class: 'card-pills' }, ...drawReads(scope, place.reads.slice(0, 4))),
        );
      }
    } else {
      rows.push(element('div', { class: 'sub' }, 'Nothing in the browser updates this element.'));
    }
    rows.push(element('div', { class: 'card-hint' }, 'Click to see it in Inspect · Esc to stop'));
    inspectCard.replaceChildren(...rows);
    // Below the element, or above it when there is no room, and inside the window.
    const cardHeight = inspectCard.offsetHeight;
    const top =
      rect.bottom + 8 + cardHeight < window.innerHeight
        ? rect.bottom + 8
        : Math.max(8, rect.top - 8 - cardHeight);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - inspectCard.offsetWidth - 8);
    inspectCard.style.cssText = `top:${top}px;left:${left}px`;
  }
  function onEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // The dock closes on Escape too, but not on the key that ends Pick, so the key stops here.
      event.preventDefault();
      event.stopPropagation();
      stopPicking();
    }
  }
  shell.endPick = (): void => stopPicking();
  function stopPicking(): void {
    pick.setAttribute('aria-pressed', 'false');
    window.removeEventListener('click', onPick, true);
    window.removeEventListener('pointermove', onHover, true);
    window.removeEventListener('keydown', onEscape, true);
    document.documentElement.style.cursor = '';
    hovered = undefined;
    hoverToken++;
    hoverBox.remove();
    inspectCard.remove();
  }
  pick.addEventListener('click', () => {
    if (pick.getAttribute('aria-pressed') === 'true') {
      stopPicking();
      return;
    }
    pick.setAttribute('aria-pressed', 'true');
    document.documentElement.style.cursor = 'crosshair';
    // On the window, so it runs before the listeners of the loader on the document.
    window.addEventListener('click', onPick, true);
    window.addEventListener('pointermove', onHover, true);
    window.addEventListener('keydown', onEscape, true);
  });

  /** Opens a workspace. The target is a tab of the workspace, for the one that has several. */
  function select(id: Workspace['id'], target?: Tab): void {
    const workspace = WORKSPACES.find((item) => item.id === id)!;
    shell.tab = target ?? defaultTab(workspace);
    draw();
  }
  let shown: Workspace['id'] | undefined;
  /** The header and the counts of the nav. */
  function drawHeader(): void {
    const current = findWorkspace(shell.tab).id;
    drawChrome(chrome, state, current, shell.paused);
    // The next open starts on the workspace that was last open.
    if (current !== shown) {
      shown = current;
      writePref('workspace', current);
    }
  }

  let queued = false;
  function draw(): void {
    drawHeader();
    const drawing = shell.tab;
    const drawn = findWorkspace(drawing).draw(ctx, body);
    // Marks of writes show once, on the next draw of Inspect.
    function settle(): void {
      if (findWorkspace(shell.tab).id === 'inspect') {
        state.written.clear();
      }
    }
    // Log and Blocks draw at once.
    if (!drawn) {
      settle();
      return;
    }
    void drawn.then(() => {
      // A tab that waited for the dev server, and that the user left meanwhile, drew over the
      // tab that is open now, so that one draws again.
      if (shell.tab !== drawing) {
        draw();
        return;
      }
      drawHeader();
      settle();
    });
  }
  // Changes come in bursts, so the dock draws once per frame. It waits while a value is edited
  // or a search is typed.
  state.changed = () => {
    const typing = root.activeElement?.matches?.('input[type="search"]');
    if (!queued && !shell.editing && !typing && !(shell.paused && shell.tab === 'log')) {
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (shell.panel) {
          draw();
        }
      });
    }
  };
  shell.showTab = (next) => {
    shell.tab = next;
    draw();
  };
  draw();
}
