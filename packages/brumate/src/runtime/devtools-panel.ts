// The panel of the devtools overlay. It reads the core through the hooks in
// `devtools.ts`, and asks the dev server about each component. It docks at
// the bottom of the page, and its height can be dragged.
//
// The panel is the shell: the tab bar, the header, Pick and the draw loop. The tabs are drawn by
// the workspaces in `devtools-panel/`:
//
// - Inspect (`inspect.ts`): Components, Elements and Graph.
// - Activity (`activity.ts`): Log, Timeline, Effects, Navigation and Server.
// - Issues (`issues.ts`): Errors.
// - Page (`page.ts`): Overview, Page state, Blocks and Report.

import type { ScopeId } from './shared.ts';
import { LOGO, findRootScope } from './devtools.ts';
import type { DevtoolsState } from './devtools.ts';
import { activity } from './devtools-panel/activity.ts';
import { element, icon, iconButton, pill } from './devtools-panel/dom.ts';
import { kilobytes, stateBytes } from './devtools-panel/format.ts';
import { drawGraph } from './devtools-panel/graph.ts';
import {
  collectModules,
  countBlocks,
  drawReads,
  findAnchor,
  findScope,
  roots,
} from './devtools-panel/info.ts';
import { inspect } from './devtools-panel/inspect.ts';
import { issues } from './devtools-panel/issues.ts';
import { page } from './devtools-panel/page.ts';
import { STYLE } from './devtools-panel/style.ts';
import { createShell, splitPlain } from './devtools-panel/workspace.ts';
import type { DockContext, Shell, Tab, Workspace } from './devtools-panel/workspace.ts';

export { layoutGraph } from './devtools-panel/graph.ts';

/** The workspaces, with the tabs that each holds. */
const WORKSPACES: Workspace[] = [inspect, activity, issues, page];
/** The tabs of the tab bar, in order. */
const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['errors', 'Errors'],
  ['scopes', 'Components'],
  ['elements', 'Elements'],
  ['graph', 'Graph'],
  ['log', 'Log'],
  ['timeline', 'Timeline'],
  ['state', 'Page state'],
  ['effects', 'Effects'],
  ['navigation', 'Navigation'],
  ['server', 'Server'],
  ['blocks', 'Blocks'],
  ['report', 'Report'],
];
/** The height of the panel, kept between pages. */
const HEIGHT_KEY = 'brumate:devtools:height';

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

/** Opens the panel on a tab, or switches to it when the panel is open. */
export function openPanel(root: ShadowRoot, state: DevtoolsState, tab: string): void {
  if (docked?.panel) {
    docked.showTab?.(tab as Tab);
  } else {
    togglePanel(root, state, tab as Tab);
  }
}

/** Opens the panel, or closes it when it is open. */
export function togglePanel(
  root: ShadowRoot,
  state: DevtoolsState,
  initial: Tab = 'overview',
): void {
  const opener = root.querySelector<HTMLElement>('button.open');
  if (docked?.panel) {
    // Pick has no button, nor the styles of its card, without the panel.
    docked.endPick?.();
    docked.endPick = undefined;
    docked.panel.remove();
    docked.panel = undefined;
    docked.showTab = undefined;
    docked = undefined;
    state.changed = undefined;
    document.documentElement.style.removeProperty('padding-bottom');
    if (opener) {
      opener.hidden = false;
    }
    state.resize = undefined;
    state.resized = undefined;
    return;
  }
  const shell = createShell(initial);

  let height = 340;
  try {
    height = Number(localStorage.getItem(HEIGHT_KEY)) || height;
  } catch {
    // Storage can be off. The default height stays.
  }
  // The page of an error of the server has nothing else to show.
  const errorPage = document.getElementById('brumate-error') !== null;
  if (errorPage) {
    height = window.innerHeight;
  }

  const body = element('div', { class: 'body' });
  const nav = element('div', { class: 'nav', role: 'tablist', 'aria-orientation': 'vertical' });
  const badges = new Map<Tab, HTMLElement>();
  for (const [name, label] of TABS) {
    const badge = element('span', { class: 'badge' });
    const button = element(
      'button',
      { class: 'tab', role: 'tab', 'data-tab': name },
      icon(name === 'scopes' ? 'scopes' : name, 15),
      element('span', { class: 'label' }, label),
      badge,
    );
    badges.set(name, badge);
    button.addEventListener('click', () => {
      shell.tab = name;
      ctx.draw();
    });
    nav.append(button);
  }

  const routeText = element('span', { class: 'route', title: 'The page' });
  const stats = element('span', { class: 'stats' });
  const pick = iconButton('pick', 'Pick', {
    'aria-pressed': 'false',
    title: 'Click an element of the page to see its scope, handlers and code',
  });
  const ctx: DockContext = {
    root,
    state,
    shell,
    draw,
    select,
    split: splitPlain,
    outline,
    pick: () => pick.click(),
    drawGraph: (scope, info) =>
      info?.graph
        ? drawGraph(ctx, findRootScope(scope).m ?? '', findRootScope(scope), info)
        : element('div', { class: 'empty' }, 'No graph for this component.'),
    drawCallDetail: () => element('div'),
  };
  // Outlines the elements that change on the page, as updates write them.
  const flash = iconButton('flash', 'Updates', {
    'aria-pressed': String(state.flash),
    title: 'Outline the elements that change: green now and then, red often',
  });
  flash.addEventListener('click', () => {
    state.setFlash?.(!state.flash);
    flash.setAttribute('aria-pressed', String(state.flash));
  });
  const close = iconButton('close', 'Close the devtools (Alt+Shift+D)', {}, true);
  close.addEventListener('click', () => togglePanel(root, state));
  const versions: HTMLElement[] = [
    element(
      'span',
      { class: 'chip accent', title: 'The version of brumate' },
      `v${state.meta.version ?? '?'}`,
    ),
  ];
  if (state.meta.vite) {
    versions.push(
      element('span', { class: 'chip', title: 'The version of Vite' }, `Vite ${state.meta.vite}`),
    );
  }
  const logo = element('i');
  logo.innerHTML = LOGO;
  const resize = element('div', { class: 'resize', title: 'Drag to resize' });
  shell.panel = element(
    'div',
    { class: 'panel', role: 'region', 'aria-label': 'brumate devtools' },
    element('style', {}, STYLE),
    resize,
    element(
      'div',
      { class: 'top' },
      element('span', { class: 'brand' }, logo, 'brumate'),
      ...versions,
      routeText,
      stats,
      element('span', { class: 'spacer' }),
      flash,
      pick,
      close,
    ),
    element('div', { class: 'main' }, nav, body),
  );
  function applyHeight(): void {
    shell.panel!.style.height = `${height}px`;
    if (errorPage) {
      shell.panel!.style.maxHeight = 'none';
    }
    // The page can scroll past the panel.
    document.documentElement.style.paddingBottom = `${height}px`;
  }
  docked = shell;
  applyHeight();
  root.append(shell.panel);
  // The tab hides while the panel is open. Close, or Alt+Shift+D, closes it.
  if (opener) {
    opener.hidden = true;
  }
  state.resize = (clientY) => {
    height = Math.min(Math.max(window.innerHeight - clientY, 160), window.innerHeight * 0.9);
    applyHeight();
  };
  state.resized = () => {
    try {
      localStorage.setItem(HEIGHT_KEY, String(Math.round(height)));
    } catch {
      // Storage can be off.
    }
    ctx.draw();
  };
  resize.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- It writes the height of this panel.
    function move(next: PointerEvent): void {
      state.resize?.(next.clientY);
    }
    function up(): void {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      state.resized?.();
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
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

  // Pick: the next click on the page shows its element in the Elements tab.
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
    rows.push(element('div', { class: 'card-hint' }, 'Click to see it in Elements · Esc to stop'));
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

  /** Opens a workspace. The target is a tab of the old tab bar. */
  function select(id: Workspace['id'], target?: Tab): void {
    const workspace = WORKSPACES.find((item) => item.id === id)!;
    shell.tab = target ?? (Object.keys(workspace.tabs)[0] as Tab);
    draw();
  }
  /** The header and the counts of the tabs. */
  function drawChrome(): void {
    for (const button of nav.querySelectorAll('.tab')) {
      button.setAttribute(
        'aria-selected',
        String((button as HTMLElement).dataset.tab === shell.tab),
      );
    }
    const list = roots(state);
    routeText.textContent = location.pathname + location.search;
    stats.textContent = [
      `${collectModules(list).size} components`,
      `${state.scopes?.size ?? 0} scopes`,
      `state ${kilobytes(stateBytes())}`,
    ].join(' · ');
    const waiting = countBlocks(state.blocks.values(), 'waiting');
    const counts: Partial<Record<Tab, [number, string?]>> = {
      errors: [state.errors.length, 'Errors'],
      scopes: [collectModules(list).size],
      log: [state.log.length],
      blocks: waiting > 0 ? [waiting, 'Blocks that wait for their trigger'] : [state.blocks.size],
    };
    for (const [name, badge] of badges) {
      const [count = 0, warning] = counts[name] ?? [];
      badge.textContent = count > 0 ? String(count) : '';
      let kind = warning ? ' warn' : '';
      if (name === 'errors') {
        kind = ' error';
      }
      badge.className = `badge${kind}`;
      badge.title = warning ?? '';
    }
  }

  let queued = false;
  function draw(): void {
    drawChrome();
    const drawing = shell.tab;
    const drawn = findWorkspace(shell.tab).draw(ctx, body);
    // Log and Blocks draw at once.
    if (!drawn) {
      return;
    }
    void drawn.then(() => {
      // A tab that waited for the dev server, and that the user left meanwhile, drew over the
      // tab that is open now, so that one draws again.
      if (shell.tab !== drawing) {
        draw();
        return;
      }
      drawChrome();
      // Marks of writes show once, on the next draw of the scopes.
      if (shell.tab === 'scopes') {
        state.written.clear();
      }
    });
  }
  // Changes come in bursts, so the panel draws once per frame. It waits while a value is edited
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
