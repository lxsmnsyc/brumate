// The panel of the devtools overlay. It reads the core through the hooks in
// `devtools.ts`, and asks the dev server about each component.
//
// - Scopes: each component on the page, its scopes and the value of each
//   slot by name. A value can be edited, which writes it as a handler does.
//   Hovering a scope outlines its elements, and Pick finds the scope of an
//   element of the page.
// - Graph: the values and markup of a component that change in the
//   browser, and what reads what. A write marks its node and the nodes after it.
// - Log: handlers, loaded parts, writes and server function calls.
// - Report: the inspect report of a component.

import type { Scope } from './client.ts';
import type { ScopeId } from './shared.ts';
import { preview, rootOf } from './devtools.ts';
import type { DevtoolsEntry, DevtoolsState } from './devtools.ts';

/** What the dev server tells about a component: see the inspect endpoint of the plugin. */
interface ComponentInfo {
  name: string;
  file: string;
  /** Each scope of the component, by its number in the compiled component. */
  scopes: Record<number, { label: string; slots: string[] }>;
  graph?: {
    nodes: { kind: string; label: string; scope: number; slot?: number }[];
    /** Pairs of node indexes: the first is read by the second. */
    edges: [number, number][];
  };
  /** The inspect report as text. */
  text: string;
}

const STYLE = `
:host { all: initial; }
.panel { position: fixed; right: 12px; bottom: 52px; z-index: 2147483647; width: min(520px, calc(100vw - 24px)); height: min(64vh, 620px); display: flex; flex-direction: column; background: #111; color: #eee; font: 12px/1.5 ui-monospace, monospace; border: 1px solid #8884; border-radius: 8px; box-shadow: 0 8px 32px #0006; overflow: hidden; }
.bar { display: flex; gap: 4px; padding: 6px; border-bottom: 1px solid #8883; align-items: center; flex-wrap: wrap; }
button, select { font: inherit; color: inherit; background: none; border: 1px solid transparent; border-radius: 4px; padding: 2px 8px; cursor: pointer; }
select { border-color: #8884; background: #111; }
.bar .tab[aria-selected="true"], .bar button[aria-pressed="true"] { border-color: #8886; background: #fff1; }
.bar .end { margin-left: auto; }
.body { flex: 1; overflow: auto; padding: 8px; }
.component { margin-bottom: 10px; }
.component > button { font-weight: 600; color: #9cf; padding: 0; }
.scope { margin-left: 12px; padding-left: 8px; border-left: 1px solid #8883; }
.scope.selected { border-left-color: #9cf; background: #9cf1; }
.scope-label { color: #aaa; cursor: default; }
.slot { white-space: pre; }
.slot .name { color: #fc9; }
.slot .value { cursor: text; border-bottom: 1px dotted #8886; }
.slot input { font: inherit; color: inherit; background: #000; border: 1px solid #9cf; border-radius: 3px; padding: 0 4px; width: 60%; }
.written { animation: flash 0.8s; }
@keyframes flash { from { background: #fd04; } to { background: transparent; } }
.entry { white-space: pre-wrap; border-bottom: 1px solid #8882; padding: 2px 0; }
.entry .time { color: #888; margin-right: 6px; }
.entry.handler .kind { color: #9cf; }
.entry.part .kind { color: #9e9; }
.entry.write .kind { color: #fc9; }
.entry.call .kind { color: #f9c; }
.filters label { display: inline-flex; gap: 3px; align-items: center; margin-right: 6px; }
pre { margin: 0; white-space: pre-wrap; }
.empty { color: #888; }
svg text { fill: #eee; font: 11px ui-monospace, monospace; }
svg rect { fill: #222; stroke: #8886; }
svg .kind-signal rect, svg .kind-prop rect { stroke: #9cf; }
svg .kind-memo rect { stroke: #c9f; }
svg .kind-effect rect { stroke: #9e9; }
svg .hot rect { fill: #fd03; stroke: #fd0; }
.legend { color: #aaa; margin: 6px 0; }
.legend b { font-weight: normal; }
.legend .signal { color: #9cf; } .legend .memo { color: #c9f; } .legend .effect { color: #9e9; } .legend .hot { color: #fd0; }
svg line { stroke: #8886; }
svg .hot-edge { stroke: #fd0; }
.outline { position: fixed; pointer-events: none; border: 2px solid #9cf; background: #9cf2; border-radius: 3px; z-index: 2147483646; }
`;

type Tab = 'scopes' | 'graph' | 'log' | 'report';
const KINDS: DevtoolsEntry['kind'][] = ['handler', 'part', 'write', 'call'];
/** How long a write marks the nodes of the graph. */
const HOT_MS = 1500;

const components = new Map<string, Promise<ComponentInfo | undefined>>();
const known = new Map<string, ComponentInfo>();

/** Asks the dev server about a component, once. */
function componentInfo(state: DevtoolsState, id: string): Promise<ComponentInfo | undefined> {
  let info = components.get(id);
  if (!info) {
    info = fetch(`${state.endpoint}/${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? (response.json() as Promise<ComponentInfo>) : undefined))
      .then((value) => {
        if (value) {
          known.set(id, value);
        }
        return value;
      })
      .catch(() => undefined);
    components.set(id, info);
  }
  return info;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

function svg(
  tag: string,
  attributes: Record<string, string | number>,
  ...children: Node[]
): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  node.append(...children);
  return node;
}

/** A value that can be edited as text: what JSON can hold. */
function editable(value: unknown): boolean {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return true;
  }
  if (typeof value !== 'object' || value instanceof Element) {
    return false;
  }
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

/** Reads what a person typed: JSON, or else the text as a string. */
function parseValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** A write with the name of its slot, once the dev server has said what it is. */
function describe(entry: DevtoolsEntry): string {
  const write = entry.write;
  const info = write && known.get(write.component);
  const name = info?.scopes[write!.k]?.slots[write!.slot];
  return name
    ? `${info!.name} ${name} = ${entry.text.split(' = ').slice(1).join(' = ')}`
    : entry.text;
}

let panel: HTMLElement | undefined;

/** Opens the panel, or closes it when it is open. */
export function togglePanel(root: ShadowRoot, state: DevtoolsState): void {
  if (panel) {
    panel.remove();
    panel = undefined;
    state.changed = undefined;
    return;
  }
  let tab: Tab = 'scopes';
  let selected: string | undefined;
  let selectedScope: ScopeId | undefined;
  let editing: { scope: ScopeId; slot: number } | undefined;
  let paused = false;
  const shown = new Set<DevtoolsEntry['kind']>(KINDS);
  // The log as it was when Pause was pressed.
  let frozen: DevtoolsEntry[] | undefined;

  const body = element('div', { class: 'body' });
  const bar = element('div', { class: 'bar', role: 'tablist' });
  for (const [name, label] of [
    ['scopes', 'Scopes'],
    ['graph', 'Graph'],
    ['log', 'Log'],
    ['report', 'Report'],
  ] as const) {
    const button = element('button', { class: 'tab', role: 'tab', 'data-tab': name }, label);
    button.addEventListener('click', () => {
      tab = name;
      draw();
    });
    bar.append(button);
  }
  const pick = element(
    'button',
    {
      class: 'end',
      'aria-pressed': 'false',
      title: 'Click an element of the page to find its scope',
    },
    'Pick',
  );
  bar.append(pick);
  panel = element('div', { class: 'panel' }, element('style', {}, STYLE), bar, body);
  root.append(panel);
  // Without an event, the core has not loaded yet, and nothing knows the components of the page.
  if (!state.scopes) {
    document.dispatchEvent(new Event('brumate:core'));
  }

  // Outlines the elements of a scope on the page.
  const outlines: HTMLElement[] = [];
  const outline = (scope?: ScopeId): void => {
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
  };

  // Pick: the next click on the page selects the scope of its element.
  const onPick = (event: MouseEvent): void => {
    const target = (event.target as Element | null)?.closest?.('[b-b]');
    if (!target || event.composedPath().includes(panel!)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    stopPicking();
    const id = target.getAttribute('b-b')!.split(':')[0]!;
    selectedScope = /^-?\d+$/.test(id) ? Number(id) : id;
    const scope = state.scopes?.get(selectedScope);
    selected = scope ? rootOf(scope).m : selected;
    tab = 'scopes';
    draw();
  };
  const stopPicking = (): void => {
    pick.setAttribute('aria-pressed', 'false');
    window.removeEventListener('click', onPick, true);
    document.documentElement.style.cursor = '';
  };
  pick.addEventListener('click', () => {
    if (pick.getAttribute('aria-pressed') === 'true') {
      stopPicking();
      return;
    }
    pick.setAttribute('aria-pressed', 'true');
    document.documentElement.style.cursor = 'crosshair';
    // On the window, so it runs before the listeners of the loader on the document.
    window.addEventListener('click', onPick, true);
  });

  /** A slot with its name and value. A value that JSON can hold can be edited. */
  const drawSlot = (scope: Scope, slot: number, name: string): HTMLElement => {
    const value = scope.s[slot];
    const line = element('div', { class: 'slot' }, element('span', { class: 'name' }, name), ' = ');
    if (editing?.scope === scope.id && editing.slot === slot) {
      const input = element('input', { 'aria-label': `New value of ${name}` });
      input.value = JSON.stringify(value) ?? '';
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          editing = undefined;
          state.set?.(scope, slot, parseValue(input.value));
          draw();
        } else if (event.key === 'Escape') {
          editing = undefined;
          draw();
        }
      });
      line.append(input);
      queueMicrotask(() => input.focus());
      return line;
    }
    const canEdit = editable(value) && state.set !== undefined;
    const text = element('span', { class: canEdit ? 'value' : '' }, preview(value));
    if (canEdit) {
      text.title = 'Click to edit. Enter JSON, or text for a string.';
      text.addEventListener('click', () => {
        editing = { scope: scope.id, slot };
        draw();
      });
    }
    line.append(text);
    return line;
  };

  /** A scope with its slots and the scopes inside it, other than components. */
  const drawScope = (scope: Scope, info: ComponentInfo | undefined): HTMLElement => {
    const plan = info?.scopes[scope.k];
    const classes = ['scope'];
    if (state.written.has(scope.id)) {
      classes.push('written');
    }
    if (selectedScope === scope.id) {
      classes.push('selected');
    }
    const label = element(
      'div',
      { class: 'scope-label' },
      // A hidden `#offscreen` body keeps its scope and its slots.
      `scope ${scope.id}${plan ? ` · ${plan.label}` : ''}${scope.h ? ' · hidden' : ''}`,
    );
    label.addEventListener('mouseenter', () => outline(scope.id));
    label.addEventListener('mouseleave', () => outline());
    const box = element('div', { class: classes.join(' ') }, label);
    scope.s.forEach((_, slot) =>
      box.append(drawSlot(scope, slot, plan?.slots[slot] ?? `slot ${slot}`)),
    );
    for (const child of scope.children) {
      if (child.m === undefined) {
        box.append(drawScope(child, info));
      }
    }
    return box;
  };

  const roots = (): Scope[] =>
    [...(state.scopes?.values() ?? [])].filter((scope) => scope.m !== undefined);

  const drawScopes = async (): Promise<void> => {
    const list = roots();
    const infos = await Promise.all(list.map((scope) => componentInfo(state, scope.m!)));
    const content = element('div');
    list.forEach((scope, index) => {
      const info = infos[index];
      const name = element('button', {}, info ? `${info.name} (${info.file})` : scope.m!);
      name.title = 'Show the graph of this component';
      name.addEventListener('click', () => {
        selected = scope.m;
        tab = 'graph';
        draw();
      });
      content.append(element('div', { class: 'component' }, name, drawScope(scope, info)));
    });
    if (list.length === 0) {
      content.append(
        element('div', { class: 'empty' }, 'No scopes yet. The first event loads them.'),
      );
    }
    body.replaceChildren(content);
    body.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  };

  /** A select of the components on the page, for Graph and Report. */
  const chooser = (current: string | undefined): HTMLElement => {
    const select = element('select', { 'aria-label': 'Component' });
    for (const id of new Set(roots().map((scope) => scope.m!))) {
      const option = element('option', { value: id }, known.get(id)?.name ?? id);
      option.selected = id === current;
      select.append(option);
    }
    select.addEventListener('change', () => {
      selected = select.value;
      draw();
    });
    return element('div', {}, select);
  };

  let cooling: ReturnType<typeof setTimeout> | undefined;

  const drawGraph = async (): Promise<void> => {
    const id = selected ?? roots()[0]?.m;
    const info = id ? await componentInfo(state, id) : undefined;
    if (!id || !info) {
      body.replaceChildren(element('div', { class: 'empty' }, 'No component yet.'));
      return;
    }
    if (!info.graph) {
      body.replaceChildren(
        chooser(id),
        element(
          'div',
          { class: 'empty' },
          'The dev server sent no graph. It runs an older brumate than this panel: restart it.',
        ),
      );
      return;
    }
    const { nodes, edges } = info.graph;
    // The current value of each value node, from the first instance of the component.
    const instance = roots().find((scope) => scope.m === id);
    // The first scope of the instance for each scope in the compiled component.
    const scopeOfNode = new Map<number, Scope>();
    const visit = (scope: Scope): void => {
      if (!scopeOfNode.has(scope.k)) {
        scopeOfNode.set(scope.k, scope);
      }
      for (const child of scope.children) {
        if (child.m === undefined) {
          visit(child);
        }
      }
    };
    if (instance) {
      visit(instance);
    }
    // Nodes that a recent write reached: the written value, and what reads it.
    const now = performance.now();
    const hot = new Set<number>();
    for (const entry of state.log) {
      if (entry.write?.component === id && now - entry.time < HOT_MS) {
        nodes.forEach((node, index) => {
          if (node.scope === entry.write!.k && node.slot === entry.write!.slot) {
            hot.add(index);
          }
        });
      }
    }
    for (let grew = true; grew;) {
      grew = false;
      for (const [from, to] of edges) {
        if (hot.has(from) && !hot.has(to)) {
          hot.add(to);
          grew = true;
        }
      }
    }
    // Columns by the longest path from a value that nothing feeds.
    const depth = nodes.map(() => 0);
    for (let round = 0, changed = true; changed && round < nodes.length; round++) {
      changed = false;
      for (const [from, to] of edges) {
        if (depth[from]! + 1 > depth[to]!) {
          depth[to] = depth[from]! + 1;
          changed = true;
        }
      }
    }
    const rows = new Map<number, number>();
    const position = nodes.map((_, index) => {
      const column = depth[index]!;
      const row = rows.get(column) ?? 0;
      rows.set(column, row + 1);
      return { x: 8 + column * 150, y: 8 + row * 34 };
    });
    const width = 8 + (Math.max(0, ...depth) + 1) * 150;
    const height = 8 + Math.max(1, ...rows.values()) * 34;
    const graph = svg('svg', { width, height, role: 'img', 'aria-label': `Graph of ${info.name}` });
    for (const [from, to] of edges) {
      const a = position[from]!;
      const b = position[to]!;
      graph.append(
        svg('line', {
          x1: a.x + 132,
          y1: a.y + 12,
          x2: b.x,
          y2: b.y + 12,
          class: hot.has(from) && hot.has(to) ? 'hot-edge' : '',
        }),
      );
    }
    nodes.forEach((node, index) => {
      const { x, y } = position[index]!;
      const text = svg('text', { x: x + 6, y: y + 16 });
      const owner = node.slot === undefined ? undefined : scopeOfNode.get(node.scope);
      const value = owner && node.slot !== undefined ? ` = ${preview(owner.s[node.slot])}` : '';
      text.textContent = `${node.label}${value}`.slice(0, 22);
      const title = svg('title', {});
      title.textContent = `${node.kind} ${node.label}${value}`;
      graph.append(
        svg(
          'g',
          { class: `kind-${node.kind}${hot.has(index) ? ' hot' : ''}` },
          svg('rect', { x, y, width: 132, height: 24, rx: 4 }),
          text,
          title,
        ),
      );
    });
    const legend = element(
      'div',
      { class: 'legend' },
      'What reads what, left to right: ',
      element('b', { class: 'signal' }, 'signals and props'),
      ', ',
      element('b', { class: 'memo' }, 'memos'),
      ', markup and ',
      element('b', { class: 'effect' }, 'effects'),
      '. A change lights up in ',
      element('b', { class: 'hot' }, 'yellow'),
      ' what it reaches.',
    );
    body.replaceChildren(
      chooser(id),
      ...(nodes.length > 0
        ? [legend, graph]
        : [
            element('div', { class: 'empty' }, 'Nothing in this component changes in the browser.'),
          ]),
    );
    // Draws again when the marks of the last write expire.
    if (hot.size > 0) {
      clearTimeout(cooling);
      cooling = setTimeout(() => state.changed?.(), HOT_MS);
    }
  };

  const drawLog = (): void => {
    const filters = element('div', { class: 'filters' });
    for (const kind of KINDS) {
      const box = element('input', { type: 'checkbox' });
      box.checked = shown.has(kind);
      box.addEventListener('change', () => {
        if (box.checked) {
          shown.add(kind);
        } else {
          shown.delete(kind);
        }
        draw();
      });
      filters.append(element('label', {}, box, kind));
    }
    const pause = element(
      'button',
      { 'aria-pressed': String(paused) },
      paused ? 'Resume' : 'Pause',
    );
    pause.addEventListener('click', () => {
      paused = !paused;
      frozen = paused ? [...state.log] : undefined;
      draw();
    });
    const clear = element('button', {}, 'Clear');
    clear.addEventListener('click', () => {
      state.log.length = 0;
      frozen = paused ? [] : undefined;
      draw();
    });
    filters.append(pause, clear);
    const list = element('div');
    const entries = (frozen ?? state.log).filter((entry) => shown.has(entry.kind));
    for (const entry of entries.toReversed()) {
      list.append(
        element(
          'div',
          { class: `entry ${entry.kind}` },
          element('span', { class: 'time' }, `${(entry.time / 1000).toFixed(2)}s`),
          element('span', { class: 'kind' }, entry.kind),
          ` ${entry.kind === 'write' ? describe(entry) : entry.text}`,
        ),
      );
    }
    if (entries.length === 0) {
      list.append(element('div', { class: 'empty' }, 'Nothing to show.'));
    }
    body.replaceChildren(filters, list);
  };

  const drawReport = async (): Promise<void> => {
    const id = selected ?? roots()[0]?.m;
    const info = id ? await componentInfo(state, id) : undefined;
    body.replaceChildren(
      ...(info
        ? [chooser(id), element('pre', {}, info.text)]
        : [element('div', { class: 'empty' }, 'No component yet.')]),
    );
  };

  let queued = false;
  const draw = (): void => {
    for (const button of bar.querySelectorAll('.tab')) {
      button.setAttribute('aria-selected', String((button as HTMLElement).dataset.tab === tab));
    }
    if (tab === 'log') {
      drawLog();
      return;
    }
    const drawn = tab === 'scopes' ? drawScopes() : tab === 'graph' ? drawGraph() : drawReport();
    // Marks of writes show once, on the next draw of the scopes.
    void drawn.then(() => {
      if (tab === 'scopes') {
        state.written.clear();
      }
    });
  };
  // Changes come in bursts, so the panel draws once per frame. It waits while a value is edited.
  state.changed = () => {
    if (!queued && !editing && !(paused && tab === 'log')) {
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (panel) {
          draw();
        }
      });
    }
  };
  draw();
}
