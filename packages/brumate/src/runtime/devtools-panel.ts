// The panel of the devtools overlay. It reads the core through the hooks in
// `devtools.ts`, and asks the dev server about each component. It docks at
// the bottom of the page, and its height can be dragged.
//
// - Overview: the versions, the page, and each component on it.
// - Errors: errors of a render on the server, of Vite and of the browser,
//   with the code of the selected place highlighted by twinkleplop, in place
//   of Vite's overlay.
// - Components: the scopes of each component, and the value of each slot by
//   name. A value can be edited, which writes it as a handler does.
// - Elements: the element that Pick found: its scope and anchor, its place in
//   the file, its handlers with their parts, and the values its updates read.
// - Graph: the values and markup of a component that change in the browser,
//   and what reads what. A write marks its node and the nodes after it.
// - Log: handlers, loaded parts, writes and server function calls.
// - Loading: each part of client code that loaded, why, and when.
// - Blocks: the `#loading`, `#defer`, `#client` blocks and `$client`
//   callbacks of the page, with their state. A trigger can fire now.
// - Report: the inspect report of a component.

import type * as Highlight from '../highlight.ts';
import type { Scope } from './client.ts';
import type { ScopeId } from './shared.ts';
import { LOGO, PRELOADS, preview, rootOf } from './devtools.ts';
import type {
  BlockEntry,
  DevtoolsEntry,
  DevtoolsState,
  ErrorEntry,
  LoadEntry,
} from './devtools.ts';

/** What the dev server tells about a component: see the inspect endpoint of the plugin. */
interface ComponentInfo {
  name: string;
  file: string;
  /** Each scope of the component, by its number in the compiled component. */
  scopes: Record<number, { label: string; slots: string[] }>;
  graph?: {
    nodes: GraphNode[];
    /** Pairs of node indexes: the first is read by the second. */
    edges: [number, number][];
  };
  /** The inspect report as text. */
  text: string;
  /** The absolute path of the file, for the editor. */
  path?: string;
  /** The URL that the browser loads the client code of the component from. */
  url?: string;
  /** Each anchor of each scope: what it is, its place in the file and what its updates read. */
  anchors?: Record<number, Record<number, { label: string; at?: string; reads: string[] }>>;
}

/** A node of the graph of a component. */
interface GraphNode {
  kind: string;
  label: string;
  scope: number;
  slot?: number;
}

const STYLE = `
:host { all: initial; }
.panel {
  --bg: #121113; --surface: #19181a; --raised: #222023; --hover: #2a282c; --line: #2f2c31;
  --text: #ece8e4; --dim: #a39a92; --faint: #6f6862; --accent: #ee7a3e;
  --blue: #7cb7ff; --purple: #c49bff; --green: #7fd99a; --yellow: #ffd166; --red: #ff7a7a;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483647;
  display: flex; flex-direction: column; min-height: 160px; max-height: 90vh;
  background: var(--bg); color: var(--text); border-top: 1px solid var(--line);
  box-shadow: 0 -8px 32px #0007; font: 12px/1.5 system-ui, -apple-system, sans-serif;
  color-scheme: dark;
}
.resize { position: absolute; top: -4px; left: 0; right: 0; height: 8px; cursor: ns-resize; }
.top { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-bottom: 1px solid var(--line); background: var(--surface); white-space: nowrap; overflow: hidden; }
.brand { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; letter-spacing: -0.01em; }
.brand i { display: inline-block; width: 18px; height: 18px; }
.chip { padding: 1px 7px; border-radius: 999px; background: var(--raised); color: var(--dim); font: 11px var(--mono); }
.chip.accent { background: #ee7a3e22; color: #ffb48a; }
.route { font: 12px var(--mono); color: var(--text); overflow: hidden; text-overflow: ellipsis; }
.stats { color: var(--dim); overflow: hidden; text-overflow: ellipsis; }
.spacer { flex: 1; }
button, select, input { font: inherit; color: inherit; }
button { background: none; border: 1px solid transparent; border-radius: 6px; padding: 2px 8px; cursor: pointer; }
button:hover { background: var(--hover); }
button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
button.tool { border-color: var(--line); }
button.tool[aria-pressed="true"] { border-color: var(--accent); background: #ee7a3e22; color: #ffb48a; }
select, input[type="search"] { background: var(--raised); border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; }
.main { flex: 1; display: flex; min-height: 0; }
.nav { display: flex; flex-direction: column; gap: 1px; padding: 6px; width: 132px; flex: none; border-right: 1px solid var(--line); background: var(--surface); overflow: auto; }
.nav .tab { display: flex; justify-content: space-between; align-items: center; text-align: left; padding: 4px 8px; color: var(--dim); }
.nav .tab[aria-selected="true"] { background: var(--raised); color: var(--text); box-shadow: inset 2px 0 var(--accent); }
.badge { min-width: 16px; padding: 0 5px; border-radius: 999px; background: var(--raised); color: var(--dim); font: 10px/16px var(--mono); text-align: center; }
.badge:empty { display: none; }
.tab[aria-selected="true"] .badge { background: var(--hover); }
.badge.warn { background: #ffd16622; color: var(--yellow); }
.badge.error, .tab[aria-selected="true"] .badge.error { background: #e5484d; color: #fff; }
.error-message { margin: 0 0 8px; color: var(--red); font: 600 14px/1.4 var(--mono); white-space: pre-wrap; }
.error-row { display: block; width: 100%; text-align: left; padding: 6px 8px; border-radius: 6px; }
.error-row[aria-current="true"] { background: var(--raised); box-shadow: inset 2px 0 var(--red); }
.error-row .text { display: block; color: var(--text); font: 12px var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.error-row .when { color: var(--faint); font-size: 11px; }
.code { margin: 6px 0 10px; border: 1px solid var(--line); border-radius: 8px; background: #0d1117; overflow: auto; }
.code .twinkleplop { margin: 0; padding: 8px 0; font: 12px/1.6 var(--mono); background: none; white-space: normal; }
.code .l { display: block; padding: 0 12px 0 0; white-space: pre; min-height: 1.6em; }
.code .ln { display: inline-block; width: 44px; padding-right: 12px; text-align: right; color: var(--faint); user-select: none; }
.code .l.error-line { background: #e5484d26; box-shadow: inset 3px 0 #e5484d; }
.code .l.error-line .ln { color: var(--red); }
.code .error-mark { text-decoration: wavy underline #e5484d; text-underline-offset: 3px; }
.code pre.plain { margin: 0; padding: 8px 12px; font: 12px/1.6 var(--mono); white-space: pre; }
.frames { display: flex; flex-direction: column; gap: 1px; }
.frame { display: flex; gap: 10px; width: 100%; text-align: left; padding: 3px 8px; border-radius: 5px; font: 11.5px var(--mono); }
.frame .fn { color: var(--text); white-space: nowrap; }
.frame .where { color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.frame.library .fn, .frame.library .where { color: var(--faint); }
.frame[aria-current="true"] { background: var(--raised); box-shadow: inset 2px 0 var(--accent); }
.body { flex: 1; overflow: auto; padding: 12px 14px; min-width: 0; }
.split { display: flex; height: calc(100% + 24px); margin: -12px -14px; }
.split > .list { width: 280px; flex: none; overflow: auto; border-right: 1px solid var(--line); padding: 8px; display: flex; flex-direction: column; gap: 1px; }
.split > .list input { margin-bottom: 6px; }
.split > .detail { flex: 1; overflow: auto; padding: 12px 14px; min-width: 0; }
h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
h3 { margin: 14px 0 6px; font-size: 11px; font-weight: 600; color: var(--dim); text-transform: uppercase; letter-spacing: 0.05em; }
.sub { color: var(--dim); font-weight: 400; }
.mono { font-family: var(--mono); }
.empty { color: var(--faint); padding: 16px 0; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; margin-bottom: 6px; }
.card { padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.card .label { color: var(--dim); font-size: 11px; }
.card .value { font-size: 18px; font-weight: 650; letter-spacing: -0.02em; }
.card .note { color: var(--faint); font-size: 11px; }
.rows { width: 100%; border-collapse: collapse; }
.rows th { text-align: left; color: var(--faint); font-weight: 500; font-size: 11px; }
.rows td, .rows th { padding: 4px 10px 4px 0; border-bottom: 1px solid var(--line); vertical-align: middle; }
.rows tr:hover td { background: #ffffff05; }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; align-items: baseline; }
.kv > :nth-child(odd) { color: var(--dim); }
.pill { display: inline-block; padding: 0 7px; border-radius: 999px; font: 11px/18px var(--mono); background: var(--raised); color: var(--dim); white-space: nowrap; }
.pill.blue { background: #7cb7ff1f; color: var(--blue); } .pill.purple { background: #c49bff1f; color: var(--purple); }
.pill.green { background: #7fd99a1f; color: var(--green); } .pill.yellow { background: #ffd1661f; color: var(--yellow); }
.pill.red { background: #ff7a7a1f; color: var(--red); } .pill.accent { background: #ee7a3e22; color: #ffb48a; }
.pill .name { color: #ffc28f; }
.link { color: var(--blue); padding: 0; border: 0; font-family: var(--mono); text-align: left; }
.link:hover { background: none; text-decoration: underline; }
.tree-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; width: 100%; text-align: left; padding: 2px 6px; border-radius: 5px; }
.tree-row.component { font-weight: 600; margin-top: 4px; }
.tree-row .file { color: var(--faint); font: 11px var(--mono); font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-row[aria-current="true"] { background: var(--raised); box-shadow: inset 2px 0 var(--accent); }
.written { animation: flash 0.8s; }
@keyframes flash { from { background: #ffd16633; } to { background: transparent; } }
.slots td.name { color: #ffc28f; font-family: var(--mono); width: 1%; white-space: nowrap; }
.slots td.type { color: var(--faint); font-family: var(--mono); width: 1%; white-space: nowrap; }
.slot .value { font-family: var(--mono); cursor: text; border-bottom: 1px dotted var(--faint); }
.slot .value.fixed { cursor: default; border: 0; }
.slot input { font: 12px var(--mono); color: var(--text); background: #000; border: 1px solid var(--accent); border-radius: 4px; padding: 1px 6px; width: 100%; box-sizing: border-box; }
.filters label { display: inline-flex; gap: 4px; align-items: center; padding: 1px 8px; border-radius: 999px; background: var(--raised); cursor: pointer; }
.entry td { font-family: var(--mono); }
.entry .time { color: var(--faint); white-space: nowrap; width: 1%; }
.kind-handler { color: var(--blue); } .kind-part { color: var(--green); } .kind-write { color: var(--yellow); } .kind-call { color: #ff9ecf; }
.bar-cell { width: 40%; min-width: 160px; }
.bar-track { position: relative; height: 12px; }
.bar { position: absolute; top: 2px; height: 8px; min-width: 3px; border-radius: 3px; background: var(--blue); }
.bar.preload { background: var(--purple); } .bar.other { background: var(--faint); }
.bar.unused { background: repeating-linear-gradient(45deg, var(--purple) 0 3px, transparent 3px 6px); box-shadow: inset 0 0 0 1px var(--purple); }
.bar.failed { background: var(--red); }
tr.unused td:not(.bar-cell) { color: var(--yellow); }
tr.failed td:not(.bar-cell) { color: var(--red); }
.legend { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; color: var(--dim); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
.graph-wrap { display: flex; gap: 10px; height: calc(100% - 42px); min-height: 180px; }
.graph-view { position: relative; flex: 1; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: radial-gradient(circle, #ffffff12 1px, transparent 1px) 0 0 / 16px 16px; cursor: grab; touch-action: none; }
.graph-view.dragging { cursor: grabbing; }
.graph-view svg { display: block; width: 100%; height: 100%; }
.graph-side { width: 250px; flex: none; overflow: auto; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; background: var(--surface); }
.zoom { position: absolute; right: 8px; bottom: 8px; display: flex; gap: 4px; }
.zoom button { background: var(--raised); border-color: var(--line); min-width: 28px; }
svg .node rect.box { fill: var(--surface); stroke: var(--line); }
svg .node rect.kind { fill: var(--faint); }
svg .node .name { fill: var(--text); font: 600 11.5px var(--mono); }
svg .node .meta { fill: var(--dim); font: 10.5px var(--mono); }
svg .node { cursor: pointer; }
svg .node:hover rect.box { stroke: var(--dim); }
svg .k-signal rect.kind, svg .k-prop rect.kind { fill: var(--blue); }
svg .k-memo rect.kind { fill: var(--purple); }
svg .k-effect rect.kind { fill: var(--green); }
svg .node.selected rect.box { stroke: var(--accent); stroke-width: 1.5; }
svg .node.hot rect.box { fill: #3a3020; stroke: var(--yellow); }
svg .node.faded { opacity: 0.3; }
svg path.edge { fill: none; stroke: #8a828066; stroke-width: 1.25; }
svg path.edge.lit { stroke: var(--accent); stroke-width: 1.75; }
svg path.edge.hot-edge { stroke: var(--yellow); stroke-width: 1.75; }
svg path.edge.faded { opacity: 0.15; }
pre.report { margin: 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); font: 11.5px/1.55 var(--mono); white-space: pre-wrap; }
.outline { position: fixed; pointer-events: none; border: 2px solid #ee7a3e; background: #ee7a3e22; border-radius: 3px; z-index: 2147483646; }
`;

type Tab =
  | 'overview'
  | 'errors'
  | 'scopes'
  | 'elements'
  | 'graph'
  | 'log'
  | 'loading'
  | 'blocks'
  | 'report';
const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['errors', 'Errors'],
  ['scopes', 'Components'],
  ['elements', 'Elements'],
  ['graph', 'Graph'],
  ['log', 'Log'],
  ['loading', 'Loading'],
  ['blocks', 'Blocks'],
  ['report', 'Report'],
];
const KINDS: DevtoolsEntry['kind'][] = ['handler', 'part', 'write', 'call'];
/** How long a write marks the nodes of the graph. */
const HOT_MS = 1500;
/** The height of the panel, kept between pages. */
const HEIGHT_KEY = 'brumate:devtools:height';

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

/** The type of a value, for the column next to it. */
function typeOf(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value instanceof Element) {
    return 'element';
  }
  if (typeof value === 'object') {
    const name = value.constructor?.name;
    return name && name !== 'Object' ? name : 'object';
  }
  return typeof value;
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

const ms = (time: number): string => `${Math.round(time)} ms`;
const seconds = (time: number): string => `${(time / 1000).toFixed(2)} s`;
const kilobytes = (bytes: number): string => `${(bytes / 1024).toFixed(1)} kB`;

/** The bytes of the code of a part, as the dev server sent it, from the timing of its request. */
function bytesOf(info: ComponentInfo | undefined, part: string): number {
  if (!info?.url || typeof performance.getEntriesByType !== 'function') {
    return 0;
  }
  const entry = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).find(
    (item) => {
      const url = new URL(item.name, location.href);
      return (
        url.pathname === info.url &&
        url.searchParams.has('brumate-client') &&
        (part === 'entry' || part === 'all'
          ? !url.searchParams.has('part')
          : url.searchParams.get('part') === part)
      );
    },
  );
  return entry ? entry.encodedBodySize || entry.transferSize : 0;
}

/** The bytes of the code that loaded. */
function codeBytes(state: DevtoolsState): number {
  let bytes = 0;
  for (const load of state.loads.values()) {
    bytes += bytesOf(known.get(load.component), load.part);
  }
  return bytes;
}

/** The bytes of the state records of the page. */
function stateBytes(): number {
  let bytes = 0;
  for (const script of document.querySelectorAll('script[b-state]')) {
    bytes += script.textContent?.length ?? 0;
  }
  return bytes;
}

/** The value of a name that a scope or one of the scopes around it holds. */
function valueOf(scope: Scope, name: string): string | undefined {
  for (let current: Scope | undefined = scope; current; current = current.p) {
    const slots = known.get(rootOf(current).m ?? '')?.scopes[current.k]?.slots;
    const slot = slots?.indexOf(name) ?? -1;
    if (slot !== -1) {
      return preview(current.s[slot]);
    }
    if (current.m !== undefined) {
      break;
    }
  }
  return undefined;
}

/** The colour of the pill of a reason to load. */
function reasonColor(reason: string): string {
  return PRELOADS.has(reason) ? 'purple' : reason === 'event' || reason === 'block' ? 'blue' : '';
}

const STATE_COLORS: Record<BlockEntry['state'], string> = {
  waiting: '',
  loading: 'blue',
  streaming: 'blue',
  rendered: 'green',
  failed: 'red',
};

const blockLabel = (block: BlockEntry): string =>
  block.kind === '$client' ? '$client' : `#${block.kind}`;

const pill = (text: string, color = ''): HTMLElement =>
  element('span', { class: `pill ${color}` }, text);

/** A row of cells, as a table row. */
const row = (cells: (Node | string)[], tag: 'td' | 'th' = 'td'): HTMLElement =>
  element('tr', {}, ...cells.map((cell) => element(tag, {}, cell)));

/** A card of a number, with a label above and a note below. */
const card = (label: string, value: string, note: string): HTMLElement =>
  element(
    'div',
    { class: 'card' },
    element('div', { class: 'label' }, label),
    element('div', { class: 'value' }, value),
    element('div', { class: 'note' }, note),
  );

/** A square of colour and its meaning, for a legend. */
const key = (color: string, text: string): HTMLElement =>
  element('span', {}, element('i', { style: `background: ${color}` }), text);

/** A button that opens a place of a file in the editor, through the dev server. */
function source(info: ComponentInfo | undefined, at = '1:1'): Node | string {
  if (!info) {
    return '';
  }
  const label = at === '1:1' ? info.file : `${info.file}:${at}`;
  if (!info.path) {
    return element('span', { class: 'mono sub' }, label);
  }
  const open = element('button', { class: 'link', title: 'Open in the editor' }, label);
  open.addEventListener('click', () => {
    void fetch(`/__open-in-editor?file=${encodeURIComponent(`${info.path}:${at}`)}`);
  });
  return open;
}

/**
 * Places the nodes of a graph in columns, left to right, by the longest
 * path from a value that nothing feeds. Within a column, nodes are ordered
 * by the average place of the nodes they connect to, a few times in each
 * direction, so edges cross less. Each column is as wide as its widest node.
 */
export function layoutGraph(
  nodes: unknown[],
  edges: [number, number][],
  widthOf: (index: number) => number,
): { x: number; y: number; width: number }[] {
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
  const columns: number[][] = [];
  nodes.forEach((_, index) => {
    (columns[depth[index]!] ??= []).push(index);
  });
  const filled = columns.filter(Boolean);
  const order = new Map<number, number>();
  for (const column of filled) {
    column.forEach((node, index) => order.set(node, index));
  }
  const before = nodes.map(() => [] as number[]);
  const after = nodes.map(() => [] as number[]);
  for (const [from, to] of edges) {
    after[from]!.push(to);
    before[to]!.push(from);
  }
  const average = (list: number[], fallback: number): number =>
    list.length === 0
      ? fallback
      : list.reduce((sum, node) => sum + order.get(node)!, 0) / list.length;
  for (let sweep = 0; sweep < 8; sweep++) {
    const forward = sweep % 2 === 0;
    const sequence = forward ? filled.slice(1) : filled.slice(0, -1).toReversed();
    for (const column of sequence) {
      const weight = new Map(
        column.map((node) => [
          node,
          average(forward ? before[node]! : after[node]!, order.get(node)!),
        ]),
      );
      column.sort((a, b) => weight.get(a)! - weight.get(b)!);
      column.forEach((node, index) => order.set(node, index));
    }
  }
  const ROW = 50;
  const GAP = 72;
  const tallest = Math.max(1, ...filled.map((column) => column.length));
  const result: { x: number; y: number; width: number }[] = [];
  let x = 16;
  for (const column of filled) {
    const width = Math.max(...column.map(widthOf));
    // Each column is centred against the tallest one.
    const top = 16 + ((tallest - column.length) * ROW) / 2;
    column.forEach((node, index) => {
      result[node] = { x, y: top + index * ROW, width };
    });
    x += width + GAP;
  }
  return result;
}

/** The scopes of a component instance, without the components inside it. */
function countScopes(scope: Scope): number {
  let count = 1;
  for (const child of scope.children) {
    if (child.m === undefined) {
      count += countScopes(child);
    }
  }
  return count;
}

/** A label cut to the width of a node of the graph. */
const clip = (text: string): string => (text.length > 34 ? `${text.slice(0, 33)}…` : text);

/** The text of an entry of the log. */
const textOf = (entry: DevtoolsEntry): string =>
  entry.kind === 'write' ? describe(entry) : entry.text;

/** The class of the bar of a load: its reason, and whether it was used or failed. */
function barClass(load: LoadEntry): string {
  if (load.failed) {
    return 'failed';
  }
  if (PRELOADS.has(load.reason)) {
    return load.used ? 'preload' : 'unused';
  }
  return load.reason === 'event' || load.reason === 'block' ? '' : 'other';
}

/** A place in a file that a stack names. */
interface Frame {
  fn: string;
  file: string;
  line: number;
  column: number;
  /** True for code of a dependency, of the runtime of brumate, or of Node. */
  library: boolean;
  /** True for code that the browser ran, whose lines are of the compiled code. */
  compiled: boolean;
}

/** The places of a stack, with their files as the dev server can read them. */
function framesOf(stack: string | undefined): Frame[] {
  const frames: Frame[] = [];
  for (const line of (stack ?? '').split('\n')) {
    const match = /^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
    if (!match) {
      continue;
    }
    let file = match[2]!;
    let compiled = false;
    // Code of a browser extension, or code without a file, is not code of the app.
    if (/^[a-z-]+-extension:/.test(file) || file.startsWith('<')) {
      continue;
    }
    if (/^https?:/.test(file)) {
      const url = new URL(file);
      if (url.origin !== location.origin) {
        continue;
      }
      compiled = true;
      file = url.pathname.startsWith('/@fs/') ? url.pathname.slice(4) : url.pathname;
    } else if (file.startsWith('file://')) {
      file = decodeURIComponent(new URL(file).pathname);
    }
    frames.push({
      fn: match[1] ?? '(anonymous)',
      file,
      line: Number(match[3]),
      column: Number(match[4]),
      library:
        file.startsWith('node:') ||
        file.includes('/node_modules/') ||
        /\/brumate\/(?:src|dist)\/runtime\//.test(file) ||
        file.includes('/@vite/'),
      compiled,
    });
  }
  return frames;
}

/** The highlighter, which loads with the first code that the Errors tab shows. */
let highlighter: Promise<typeof Highlight> | undefined;
/** The sources of files, by path. */
const sources = new Map<string, Promise<string | undefined>>();

function sourceOf(file: string): Promise<string | undefined> {
  let text = sources.get(file);
  if (!text) {
    text = fetch(`/__brumate/source?file=${encodeURIComponent(file)}`)
      .then((response) => (response.ok ? response.text() : undefined))
      .catch(() => undefined);
    sources.set(file, text);
  }
  return text;
}

/**
 * The lines around a place of a file, highlighted by twinkleplop, with the
 * line of the place and the word at its column marked. Without the source,
 * the frame of the error is shown as it is.
 */
async function codeView(
  place: { file: string; line: number; column: number },
  fallback?: string,
): Promise<HTMLElement> {
  const box = element('div', { class: 'code' });
  const [text, module] = await Promise.all([
    sourceOf(place.file),
    (highlighter ??= import('../highlight.ts')),
  ]);
  if (text === undefined) {
    box.append(
      element('pre', { class: 'plain' }, fallback ?? 'The dev server cannot read this file.'),
    );
    return box;
  }
  const lines = text.split('\n');
  const start = Math.max(1, place.line - 6);
  const end = Math.min(lines.length, place.line + 6);
  const target = place.line - start + 1;
  const word = /^[\w$.]*/.exec(lines[place.line - 1]?.slice(place.column - 1) ?? '')?.[0] ?? '';
  // The colours of the theme, in the box, since the styles of the page do not reach the panel.
  box.append(element('style', {}, module.themeCSS('dark')));
  box.insertAdjacentHTML(
    'beforeend',
    module.highlightFile(place.file, lines.slice(start - 1, end).join('\n'), {
      line_numbers: { start },
      line: (index) => (index === target ? { class: 'error-line' } : undefined),
      overlays:
        word.length > 0
          ? [
              {
                start: { line: target, character: place.column - 1 },
                end: { line: target, character: place.column - 1 + word.length },
                class: 'error-mark',
              },
            ]
          : [],
    }),
  );
  return box;
}

let panel: HTMLElement | undefined;
/** Switches the tab of the open panel. */
let showTab: ((tab: Tab) => void) | undefined;

/** Opens the panel on a tab, or switches to it when the panel is open. */
export function openPanel(root: ShadowRoot, state: DevtoolsState, tab: string): void {
  if (panel) {
    showTab?.(tab as Tab);
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
  const opener = root.querySelector<HTMLElement>(':scope > button.open');
  if (panel) {
    panel.remove();
    panel = undefined;
    state.changed = undefined;
    document.documentElement.style.removeProperty('padding-bottom');
    opener?.style.removeProperty('display');
    showTab = undefined;
    return;
  }
  let tab: Tab = initial;
  // The error and the place of its stack that the Errors tab shows.
  let selectedError: ErrorEntry | undefined;
  let selectedFrame = -1;
  let selected: string | undefined;
  let selectedScope: ScopeId | undefined;
  let editing: { scope: ScopeId; slot: number } | undefined;
  let paused = false;
  let filter = '';
  let logSearch = '';
  const shown = new Set<DevtoolsEntry['kind']>(KINDS);
  // The log as it was when Pause was pressed.
  let frozen: DevtoolsEntry[] | undefined;
  // The element that Pick found, for the Elements tab.
  let picked: Element | undefined;
  // The node of the graph that was clicked, and the pan and zoom of the graph.
  let graphNode: number | undefined;
  let view = { x: 0, y: 0, scale: 1, fitted: '' };

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
      element('span', {}, label),
      badge,
    );
    badges.set(name, badge);
    button.addEventListener('click', () => {
      tab = name;
      draw();
    });
    nav.append(button);
  }

  const routeText = element('span', { class: 'route', title: 'The page' });
  const stats = element('span', { class: 'stats' });
  const pick = element(
    'button',
    {
      class: 'tool',
      'aria-pressed': 'false',
      title: 'Click an element of the page to see its scope, handlers and code',
    },
    'Pick',
  );
  const close = element('button', { class: 'tool', title: 'Close the devtools' }, 'Close');
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
  panel = element(
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
      pick,
      close,
    ),
    element('div', { class: 'main' }, nav, body),
  );
  const applyHeight = (): void => {
    panel!.style.height = `${height}px`;
    if (errorPage) {
      panel!.style.maxHeight = 'none';
    }
    // The page can scroll past the panel.
    document.documentElement.style.paddingBottom = `${height}px`;
  };
  applyHeight();
  root.append(panel);
  if (opener) {
    opener.style.display = 'none';
  }
  resize.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- It writes the height of this panel.
    const move = (next: PointerEvent): void => {
      height = Math.min(Math.max(window.innerHeight - next.clientY, 160), window.innerHeight * 0.9);
      applyHeight();
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try {
        localStorage.setItem(HEIGHT_KEY, String(Math.round(height)));
      } catch {
        // Storage can be off.
      }
      draw();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
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

  // Pick: the next click on the page shows its element in the Elements tab.
  const onPick = (event: MouseEvent): void => {
    const clicked = event.target as Element | null;
    if (!clicked?.closest || event.composedPath().includes(panel!)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    stopPicking();
    picked = clicked;
    const id = clicked.closest('[b-b]')?.getAttribute('b-b')!.split(':')[0];
    if (id !== undefined) {
      selectedScope = /^-?\d+$/.test(id) ? Number(id) : id;
      const scope = state.scopes?.get(selectedScope);
      selected = scope ? rootOf(scope).m : selected;
    }
    tab = 'elements';
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

  const roots = (): Scope[] =>
    [...(state.scopes?.values() ?? [])].filter((scope) => scope.m !== undefined);
  const scopeOf = (id: string): Scope | undefined =>
    state.scopes?.get(/^-?\d+$/.test(id) ? Number(id) : id);

  /** The header and the counts of the tabs. */
  const drawChrome = (): void => {
    for (const button of nav.querySelectorAll('.tab')) {
      button.setAttribute('aria-selected', String((button as HTMLElement).dataset.tab === tab));
    }
    const list = roots();
    const loads = [...state.loads.values()];
    const code = codeBytes(state);
    routeText.textContent = location.pathname + location.search;
    stats.textContent = [
      `${new Set(list.map((scope) => scope.m)).size} components`,
      `${state.scopes?.size ?? 0} scopes`,
      `${loads.length} parts${code ? ` (${kilobytes(code)})` : ''}`,
      `state ${kilobytes(stateBytes())}`,
    ].join(' · ');
    const unused = loads.filter((load) => PRELOADS.has(load.reason) && !load.used).length;
    const waiting = [...state.blocks.values()].filter((block) => block.state === 'waiting').length;
    const counts: Partial<Record<Tab, [number, string?]>> = {
      errors: [state.errors.length, 'Errors'],
      scopes: [new Set(list.map((scope) => scope.m)).size],
      log: [state.log.length],
      loading: unused > 0 ? [unused, 'Preloads that nothing used'] : [loads.length],
      blocks: waiting > 0 ? [waiting, 'Blocks that wait for their trigger'] : [state.blocks.size],
    };
    for (const [name, badge] of badges) {
      const [count = 0, warning] = counts[name] ?? [];
      badge.textContent = count > 0 ? String(count) : '';
      badge.className = `badge${name === 'errors' ? ' error' : warning ? ' warn' : ''}`;
      badge.title = warning ?? '';
    }
  };

  /** A select of the components on the page, for Graph and Report. */
  const chooser = (current: string | undefined): HTMLElement => {
    const select = element('select', { 'aria-label': 'Component' });
    for (const id of new Set(roots().map((scope) => scope.m!))) {
      const info = known.get(id);
      const option = element('option', { value: id }, info ? `${info.name} · ${info.file}` : id);
      option.selected = id === current;
      select.append(option);
    }
    select.addEventListener('change', () => {
      selected = select.value;
      graphNode = undefined;
      draw();
    });
    return select;
  };

  const drawErrors = async (): Promise<void> => {
    if (state.errors.length === 0) {
      body.replaceChildren(
        element('h2', {}, 'Errors'),
        element(
          'p',
          { class: 'sub' },
          'No errors. Errors of a render on the server, of Vite, such as a compile error after an edit, and of code in the browser show here.',
        ),
      );
      return;
    }
    if (!selectedError || !state.errors.includes(selectedError)) {
      selectedError = state.errors.at(-1);
      selectedFrame = -1;
    }
    const error = selectedError!;
    const list = element('div', { class: 'list' });
    for (const entry of state.errors.toReversed()) {
      const button = element(
        'button',
        { class: 'error-row', 'aria-current': String(entry === error) },
        element('span', { class: 'text' }, entry.message.split('\n')[0]!),
        element('span', { class: 'when' }, `${entry.source} · ${seconds(entry.time)}`),
      );
      button.addEventListener('click', () => {
        selectedError = entry;
        selectedFrame = -1;
        draw();
      });
      list.append(button);
    }
    const clear = element('button', { class: 'tool' }, 'Clear');
    clear.addEventListener('click', () => {
      state.errors.length = 0;
      state.errorCount?.();
      draw();
    });
    list.append(element('div', { style: 'margin-top: 8px' }, clear));

    // The place to show: a frame that was clicked, the place of a compile error, or the first
    // frame of the app's code.
    const frames = framesOf(error.stack);
    if (selectedFrame === -1) {
      selectedFrame = error.loc
        ? -2
        : frames.findIndex((frame) => !frame.library && !frame.compiled);
    }
    const frame = selectedFrame >= 0 ? frames[selectedFrame] : undefined;
    const place = selectedFrame === -2 ? error.loc : frame;
    const detail = element('div', { class: 'detail' });
    detail.append(
      element('pre', { class: 'error-message' }, error.message),
      element(
        'div',
        { class: 'toolbar' },
        pill(error.source, error.source === 'browser' ? 'yellow' : 'red'),
        error.plugin ? pill(`plugin ${error.plugin}`) : '',
        place ? open(place) : '',
      ),
    );
    if (place) {
      detail.append(await codeView(place, error.frame));
    } else if (error.frame) {
      detail.append(
        element('div', { class: 'code' }, element('pre', { class: 'plain' }, error.frame)),
      );
    }
    if (frames.length > 0) {
      const stack = element('div', { class: 'frames' });
      frames.forEach((item, index) => {
        const button = element(
          'button',
          {
            class: `frame${item.library ? ' library' : ''}`,
            'aria-current': String(index === selectedFrame),
            title: item.compiled ? 'The lines of code that the browser ran' : 'Show this code',
          },
          element('span', { class: 'fn' }, item.fn),
          element('span', { class: 'where' }, `${item.file}:${item.line}:${item.column}`),
        );
        button.addEventListener('click', () => {
          selectedFrame = index;
          draw();
        });
        stack.append(button);
      });
      detail.append(element('h3', {}, 'Stack'), stack);
    }
    body.replaceChildren(element('div', { class: 'split' }, list, detail));
  };

  /** A button that opens a place of a file in the editor. */
  const open = (place: { file: string; line: number; column: number }): HTMLElement => {
    const button = element(
      'button',
      { class: 'link', title: 'Open in the editor' },
      `${place.file.replace(/^.*\/(src|test|routes)\//, '$1/')}:${place.line}:${place.column}`,
    );
    button.addEventListener('click', () => {
      void fetch(
        `/__open-in-editor?file=${encodeURIComponent(`${place.file}:${place.line}:${place.column}`)}`,
      );
    });
    return button;
  };

  const drawOverview = async (): Promise<void> => {
    const list = roots();
    const ids = [...new Set(list.map((scope) => scope.m!))];
    const infos = await Promise.all(ids.map((id) => componentInfo(state, id)));
    const loads = [...state.loads.values()];
    const code = codeBytes(state);
    const unused = loads.filter((load) => PRELOADS.has(load.reason) && !load.used).length;
    const blocks = [...state.blocks.values()];
    const handlers = state.log.filter((entry) => entry.kind === 'handler').length;
    const calls = state.log.filter((entry) => entry.kind === 'call').length;
    const table = element(
      'table',
      { class: 'rows' },
      row(['component', 'file', 'instances', 'scopes', 'parts loaded'], 'th'),
    );
    ids.forEach((id, index) => {
      const info = infos[index];
      const instances = list.filter((scope) => scope.m === id);
      const name = element('button', { class: 'link', title: 'Show its scopes' }, info?.name ?? id);
      name.addEventListener('click', () => {
        selected = id;
        selectedScope = instances[0]?.id;
        tab = 'scopes';
        draw();
      });
      const parts = loads.filter((load) => load.component === id).map((load) => load.part);
      table.append(
        row([
          name,
          source(info),
          String(instances.length),
          String(instances.reduce((sum, scope) => sum + countScopes(scope), 0)),
          element('span', { class: 'mono' }, parts.join(', ') || '—'),
        ]),
      );
    });
    body.replaceChildren(
      element(
        'div',
        { class: 'kv', style: 'margin-bottom: 12px' },
        element('span', {}, 'Page'),
        element('span', { class: 'mono' }, location.href),
        element('span', {}, 'brumate'),
        element('span', { class: 'mono' }, state.meta.version ?? 'unknown'),
        element('span', {}, 'Vite'),
        element('span', { class: 'mono' }, state.meta.vite ?? 'unknown'),
        element('span', {}, 'Open for'),
        element('span', { class: 'mono' }, seconds(performance.now())),
      ),
      element(
        'div',
        { class: 'cards' },
        card('Components', String(ids.length), `${state.scopes?.size ?? 0} scopes in the browser`),
        card(
          'Client code',
          code ? kilobytes(code) : String(loads.length),
          `${loads.length} parts loaded${unused ? `, ${unused} preloads unused` : ''}`,
        ),
        card('Page state', kilobytes(stateBytes()), 'state records from the server'),
        card(
          'Blocks',
          String(blocks.length),
          `${blocks.filter((block) => block.state === 'waiting').length} waiting, ${blocks.filter((block) => block.state === 'rendered').length} rendered`,
        ),
        card('Handlers run', String(handlers), `${calls} server function calls`),
      ),
      element('h3', {}, 'Components on the page'),
      ids.length > 0
        ? table
        : element('div', { class: 'empty' }, 'No components with client state yet.'),
    );
  };

  /** A slot with its name, type and value. A value that JSON can hold can be edited. */
  const drawSlot = (scope: Scope, slot: number, name: string): HTMLElement => {
    const value = scope.s[slot];
    const cell = element('td');
    const line = element(
      'tr',
      { class: 'slot' },
      element('td', { class: 'name' }, name),
      element('td', { class: 'type' }, typeOf(value)),
      cell,
    );
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
      cell.append(input);
      queueMicrotask(() => input.focus());
      return line;
    }
    const canEdit = editable(value) && state.set !== undefined;
    const text = element('span', { class: canEdit ? 'value' : 'value fixed' }, preview(value));
    if (canEdit) {
      text.title = 'Click to edit. Enter JSON, or text for a string.';
      text.addEventListener('click', () => {
        editing = { scope: scope.id, slot };
        draw();
      });
    }
    cell.append(text);
    return line;
  };

  const drawScopes = async (): Promise<void> => {
    const list = roots();
    const infos = await Promise.all(list.map((scope) => componentInfo(state, scope.m!)));
    if (list.length === 0) {
      body.replaceChildren(
        element('div', { class: 'empty' }, 'No scopes yet. The first event loads them.'),
      );
      return;
    }
    const current = (selectedScope !== undefined && state.scopes?.get(selectedScope)) || list[0]!;
    const search = element('input', {
      type: 'search',
      placeholder: 'Filter components and values',
      'aria-label': 'Filter scopes',
    });
    search.value = filter;
    search.addEventListener('input', () => {
      filter = search.value;
      void drawScopes().then(() => {
        const next = body.querySelector<HTMLInputElement>('input[type="search"]');
        next?.focus();
        next?.setSelectionRange(filter.length, filter.length);
      });
    });
    const tree = element('div', { class: 'list' }, search);
    const visit = (scope: Scope, info: ComponentInfo | undefined, depth: number): void => {
      const label =
        scope.m === undefined
          ? `${info?.scopes[scope.k]?.label ?? 'scope'}${scope.h ? ' · hidden' : ''}`
          : (info?.name ?? scope.m);
      const classes = ['tree-row'];
      if (scope.m !== undefined) {
        classes.push('component');
      }
      if (state.written.has(scope.id)) {
        classes.push('written');
      }
      const button = element(
        'button',
        {
          class: classes.join(' '),
          style: `padding-left: ${6 + depth * 14}px`,
          'aria-current': String(scope === current),
        },
        element('span', {}, label),
        element(
          'span',
          { class: 'file' },
          scope.m === undefined ? `#${scope.id}` : (info?.file ?? ''),
        ),
      );
      button.addEventListener('click', () => {
        selectedScope = scope.id;
        selected = rootOf(scope).m;
        draw();
      });
      button.addEventListener('mouseenter', () => outline(scope.id));
      button.addEventListener('mouseleave', () => outline());
      tree.append(button);
      for (const child of scope.children) {
        if (child.m === undefined) {
          visit(child, info, depth + 1);
        }
      }
    };
    const needle = filter.trim().toLowerCase();
    list.forEach((scope, index) => {
      const info = infos[index];
      if (
        needle &&
        !`${info?.name ?? scope.m} ${info?.file ?? ''}`.toLowerCase().includes(needle) &&
        !scope.s.some((value) => preview(value).toLowerCase().includes(needle))
      ) {
        return;
      }
      visit(scope, info, 0);
    });

    // The scope that is selected, with its slots.
    const component = rootOf(current);
    const info = known.get(component.m ?? '');
    const plan = info?.scopes[current.k];
    const slots = element('table', { class: 'rows slots' }, row(['name', 'type', 'value'], 'th'));
    current.s.forEach((_, slot) =>
      slots.append(drawSlot(current, slot, plan?.slots[slot] ?? `slot ${slot}`)),
    );
    const graph = element('button', { class: 'tool' }, 'Show the graph');
    graph.addEventListener('click', () => {
      selected = component.m;
      tab = 'graph';
      draw();
    });
    const detail = element(
      'div',
      { class: `detail${state.written.has(current.id) ? ' written' : ''}` },
      element(
        'h2',
        {},
        info?.name ?? component.m ?? '',
        element('span', { class: 'sub' }, ` · ${plan?.label ?? 'scope'}`),
      ),
      element(
        'div',
        { class: 'toolbar' },
        pill(`scope ${current.id}`),
        current.h ? pill('hidden', 'yellow') : '',
        source(info),
        element('span', { class: 'spacer' }),
        graph,
      ),
      current.s.length > 0
        ? slots
        : element('div', { class: 'empty' }, 'This scope holds no values.'),
    );
    body.replaceChildren(element('div', { class: 'split' }, tree, detail));
    body.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  };

  /** What the dev server says about an anchor of a scope, with the component that has it. */
  const anchorOf = async (scope: Scope, anchor: number) => {
    const component = rootOf(scope);
    const info = component.m ? await componentInfo(state, component.m) : undefined;
    return { info, component, place: info?.anchors?.[scope.k]?.[anchor] };
  };

  /** The names that an anchor reads, with their values in the scope. */
  const drawReads = (scope: Scope, reads: string[]): Node[] =>
    reads.map((name) => {
      const value = valueOf(scope, name);
      return element(
        'span',
        { class: 'pill', style: 'margin: 0 4px 2px 0' },
        element('span', { class: 'name' }, name),
        value === undefined ? '' : ` = ${value}`,
      );
    });

  /** The handlers of an element, from its `b-on`, with the state of the code of each one. */
  const drawHandlers = (target: Element): HTMLElement => {
    const table = element(
      'table',
      { class: 'rows' },
      row(['event', 'handler', 'part', 'code', 'size'], 'th'),
    );
    for (const raw of (target.getAttribute('b-on') ?? '').split(/\s+/).filter(Boolean)) {
      const [head, ref = ''] = raw.split('=') as [string, string];
      const [type, ...modifiers] = head.split(':');
      const [component, name = ''] = ref.split('@')[0]!.split('#') as [string, string];
      const part = /^[hct]\d/.test(name) ? name : 'update';
      const load = state.loads.get(`${component}:${part}`) ?? state.loads.get(`${component}:all`);
      const info = known.get(component);
      const status = !load
        ? pill('not loaded')
        : load.end === undefined
          ? pill('loading', 'blue')
          : pill(
              `${load.failed ? 'failed' : 'loaded'} in ${ms(load.end - load.start)} (${load.reason})`,
              load.failed ? 'red' : 'green',
            );
      const bytes = bytesOf(info, load?.part ?? part);
      table.append(
        row([
          element('span', { class: 'mono' }, [type, ...modifiers].join(':')),
          element('span', { class: 'mono' }, `${info?.name ?? component} ${name}`),
          element('span', { class: 'mono' }, part),
          status,
          bytes ? kilobytes(bytes) : '',
        ]),
      );
    }
    return table;
  };

  const drawElements = async (): Promise<void> => {
    if (!picked?.isConnected) {
      const start = element('button', { class: 'tool' }, 'Pick an element');
      start.addEventListener('click', () => pick.click());
      body.replaceChildren(
        element('h2', {}, 'Elements'),
        element(
          'p',
          { class: 'sub' },
          'Pick an element of the page to see the component that renders it, its place in the file, its handlers and the values that update it.',
        ),
        start,
      );
      return;
    }
    const tag = `<${picked.tagName.toLowerCase()}>`;
    const content = element('div');
    const anchored = picked.closest('[b-b]');
    const [id = '', anchorText = '0'] = anchored?.getAttribute('b-b')!.split(':') ?? [];
    const scope = anchored ? scopeOf(id) : undefined;
    if (scope) {
      const anchor = Number(anchorText);
      const { info, component, place } = await anchorOf(scope, anchor);
      const scopeButton = element(
        'button',
        { class: 'link', title: 'Show the scope' },
        `scope ${scope.id}${info?.scopes[scope.k] ? ` · ${info.scopes[scope.k]!.label}` : ''}`,
      );
      scopeButton.addEventListener('click', () => {
        selectedScope = scope.id;
        tab = 'scopes';
        draw();
      });
      content.append(
        element(
          'h2',
          {},
          picked === anchored ? (place?.label ?? tag) : `${tag} in ${place?.label ?? 'an element'}`,
          element('span', { class: 'sub' }, ` · ${info?.name ?? component.m}`),
        ),
        element(
          'div',
          { class: 'kv' },
          element('span', {}, 'source'),
          element('span', {}, place?.at ? source(info, place.at) : '—'),
          element('span', {}, 'scope'),
          element('span', {}, scopeButton),
          element('span', {}, 'anchor'),
          element('span', { class: 'mono' }, String(anchor)),
          element('span', {}, 'reads'),
          element(
            'span',
            {},
            ...(place && place.reads.length > 0 ? drawReads(scope, place.reads) : ['—']),
          ),
        ),
      );
      const handled = picked.closest('[b-on]');
      if (handled && anchored!.contains(handled)) {
        content.append(element('h3', {}, 'Handlers'), drawHandlers(handled));
      }
    } else {
      content.append(
        element('h2', {}, tag),
        element(
          'div',
          { class: 'empty' },
          anchored
            ? `Scope ${id} is not in the browser yet.`
            : 'Nothing in the browser updates this element or the elements around it.',
        ),
      );
    }
    // The inserts and blocks inside the element, which have markers instead of `b-b`.
    const markers: { data: string; scope: Scope; anchor: number }[] = [];
    const walker = document.createTreeWalker(picked, NodeFilter.SHOW_COMMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const data = (node as Comment).data;
      const match = /^[tb](-?[\d.]+):(\d+)/.exec(data);
      const markerScope = match && scopeOf(match[1]!);
      if (markerScope) {
        markers.push({ data, scope: markerScope, anchor: Number(match![2]) });
      }
    }
    const places = await Promise.all(
      markers.map((marker) => anchorOf(marker.scope, marker.anchor)),
    );
    const inside = element('table', { class: 'rows' }, row(['marker', 'source', 'reads'], 'th'));
    markers.forEach((marker, index) => {
      const { info, place } = places[index]!;
      inside.append(
        row([
          element('span', { class: 'mono' }, place?.label ?? marker.data),
          place?.at ? source(info, place.at) : '',
          element('span', {}, ...drawReads(marker.scope, place?.reads ?? [])),
        ]),
      );
    });
    if (markers.length > 0) {
      content.append(element('h3', {}, 'Inside it'), inside);
    }
    body.replaceChildren(content);
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
        element('div', { class: 'toolbar' }, chooser(id)),
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
    // A markup node is named by what it is and its place in the file, such as `insert 9:42`.
    const parts = nodes.map((node) => {
      const at = /^(.*) (\d+:\d+)$/.exec(node.label);
      const owner = node.slot === undefined ? undefined : scopeOfNode.get(node.scope);
      const value = owner && node.slot !== undefined ? preview(owner.s[node.slot]) : undefined;
      return {
        name: at ? at[1]! : node.label,
        meta: value === undefined ? (at ? `${node.kind} · ${at[2]}` : node.kind) : `= ${value}`,
        value,
        at: at?.[2],
      };
    });
    const widthOf = (index: number): number =>
      Math.min(
        262,
        Math.max(
          112,
          26 + 7 * Math.max(clip(parts[index]!.name).length, clip(parts[index]!.meta).length),
        ),
      );
    const position = layoutGraph(nodes, edges, widthOf);
    // What the clicked node reads, and what reads it, all the way.
    const related = new Set<number>();
    if (graphNode !== undefined && graphNode < nodes.length) {
      related.add(graphNode);
      for (const [from, to] of [
        [0, 1],
        [1, 0],
      ] as const) {
        const queue = [graphNode];
        while (queue.length > 0) {
          const next = queue.pop()!;
          for (const edge of edges) {
            if (edge[from] === next && !related.has(edge[to])) {
              related.add(edge[to]);
              queue.push(edge[to]);
            }
          }
        }
      }
    }
    const graphWidth = Math.max(0, ...position.map((place) => place.x + place.width)) + 16;
    const graphHeight = Math.max(0, ...position.map((place) => place.y)) + 56;
    const layer = svg('g', { class: 'layer' });
    for (const [from, to] of edges) {
      const a = position[from]!;
      const b = position[to]!;
      const x1 = a.x + a.width;
      const y1 = a.y + 19;
      const x2 = b.x - 3;
      const y2 = b.y + 19;
      const bend = Math.max(28, (x2 - x1) / 2);
      const classes = ['edge'];
      if (hot.has(from) && hot.has(to)) {
        classes.push('hot-edge');
      } else if (related.size > 0) {
        classes.push(related.has(from) && related.has(to) ? 'lit' : 'faded');
      }
      layer.append(
        svg('path', {
          class: classes.join(' '),
          d: `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`,
          'marker-end': 'url(#arrow)',
        }),
      );
    }
    nodes.forEach((node, index) => {
      const { x, y, width: nodeWidth } = position[index]!;
      const part = parts[index]!;
      const classes = ['node', `k-${node.kind}`];
      if (hot.has(index)) {
        classes.push('hot');
      }
      if (graphNode === index) {
        classes.push('selected');
      }
      if (related.size > 0 && !related.has(index)) {
        classes.push('faded');
      }
      const name = svg('text', { class: 'name', x: x + 12, y: y + 16 });
      name.textContent = clip(part.name);
      const meta = svg('text', { class: 'meta', x: x + 12, y: y + 30 });
      meta.textContent = clip(part.meta);
      const title = svg('title', {});
      title.textContent = `${node.kind} ${node.label}${part.value === undefined ? '' : ` = ${part.value}`}`;
      const group = svg(
        'g',
        { class: classes.join(' '), 'data-node': index },
        svg('rect', { class: 'box', x, y, width: nodeWidth, height: 38, rx: 7 }),
        svg('rect', { class: 'kind', x: x + 1, y: y + 6, width: 3, height: 26, rx: 1.5 }),
        name,
        meta,
        title,
      );
      group.addEventListener('click', (event) => {
        event.stopPropagation();
        graphNode = graphNode === index ? undefined : index;
        draw();
      });
      layer.append(group);
    });
    const canvas = svg(
      'svg',
      { role: 'img', 'aria-label': `Graph of ${info.name}` },
      svg(
        'defs',
        {},
        svg(
          'marker',
          {
            id: 'arrow',
            viewBox: '0 0 8 8',
            refX: 7,
            refY: 4,
            markerWidth: 6,
            markerHeight: 6,
            orient: 'auto',
          },
          svg('path', { d: 'M0,0 L8,4 L0,8 z', fill: '#8a8280' }),
        ),
      ),
      layer,
    );
    const frame = element('div', { class: 'graph-view' }, canvas);
    const apply = (): void => {
      layer.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.scale})`);
    };
    const fit = (): void => {
      const box = frame.getBoundingClientRect();
      if (box.width === 0) {
        return;
      }
      view.scale = Math.min(
        1.2,
        Math.max(0.3, Math.min(box.width / graphWidth, box.height / graphHeight)),
      );
      view.x = (box.width - graphWidth * view.scale) / 2;
      view.y = Math.max(0, (box.height - graphHeight * view.scale) / 2);
      apply();
    };
    const zoomAt = (factor: number, px: number, py: number): void => {
      const next = Math.min(3, Math.max(0.2, view.scale * factor));
      view.x = px - ((px - view.x) * next) / view.scale;
      view.y = py - ((py - view.y) * next) / view.scale;
      view.scale = next;
      apply();
    };
    // Drag to pan, and scroll to zoom around the pointer.
    frame.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const box = frame.getBoundingClientRect();
        zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - box.left, event.clientY - box.top);
      },
      { passive: false },
    );
    frame.addEventListener('pointerdown', (event) => {
      if ((event.target as Element).closest('.node, button')) {
        return;
      }
      const start = { x: event.clientX - view.x, y: event.clientY - view.y };
      frame.classList.add('dragging');
      const move = (next: PointerEvent): void => {
        view.x = next.clientX - start.x;
        view.y = next.clientY - start.y;
        apply();
      };
      const up = (): void => {
        frame.classList.remove('dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    canvas.addEventListener('click', () => {
      if (graphNode !== undefined) {
        graphNode = undefined;
        draw();
      }
    });
    const zoomButton = (label: string, title: string, factor: number): HTMLElement => {
      const button = element('button', { title }, label);
      button.addEventListener('click', () => {
        const box = frame.getBoundingClientRect();
        zoomAt(factor, box.width / 2, box.height / 2);
      });
      return button;
    };
    const fitButton = element('button', { title: 'Fit the graph in view' }, 'Fit');
    fitButton.addEventListener('click', fit);
    frame.append(
      element(
        'div',
        { class: 'zoom' },
        zoomButton('−', 'Zoom out', 1 / 1.2),
        zoomButton('+', 'Zoom in', 1.2),
        fitButton,
      ),
    );

    // The side: the node that was clicked, or how to read the graph.
    const side = element('div', { class: 'graph-side' });
    if (graphNode !== undefined && graphNode < nodes.length) {
      const node = nodes[graphNode]!;
      const part = parts[graphNode]!;
      const list = (indexes: number[]): Node =>
        indexes.length > 0
          ? element(
              'div',
              {},
              ...indexes.map((index) => element('div', { class: 'mono' }, nodes[index]!.label)),
            )
          : element('div', { class: 'sub' }, 'nothing');
      const color =
        node.kind === 'memo'
          ? 'purple'
          : node.kind === 'effect'
            ? 'green'
            : node.slot === undefined
              ? ''
              : 'blue';
      side.append(
        element('h2', {}, part.name),
        element(
          'div',
          { class: 'toolbar' },
          pill(node.kind, color),
          part.at ? source(info, part.at) : '',
        ),
        ...(part.value === undefined
          ? []
          : [element('h3', {}, 'Value'), element('div', { class: 'mono' }, part.value)]),
        element('h3', {}, 'Reads'),
        list(edges.filter(([, to]) => to === graphNode).map(([from]) => from)),
        element('h3', {}, 'Read by'),
        list(edges.filter(([from]) => from === graphNode).map(([, to]) => to)),
      );
    } else {
      side.append(
        element('h2', {}, info.name),
        element(
          'p',
          { class: 'sub', style: 'margin-top: 0' },
          'What changes in the browser, and what reads what, left to right. Click a node to follow it. Drag to pan, and scroll to zoom.',
        ),
        element(
          'div',
          { class: 'legend', style: 'flex-direction: column; align-items: flex-start; gap: 4px' },
          key('var(--blue)', 'signals and props'),
          key('var(--purple)', 'memos'),
          key('var(--faint)', 'markup'),
          key('var(--green)', 'effects'),
          key('var(--yellow)', 'what a change reached'),
        ),
      );
    }
    body.replaceChildren(
      element(
        'div',
        { class: 'toolbar' },
        chooser(id),
        element('span', { class: 'sub' }, `${nodes.length} nodes · ${edges.length} edges`),
      ),
      nodes.length > 0
        ? element('div', { class: 'graph-wrap' }, frame, side)
        : element('div', { class: 'empty' }, 'Nothing in this component changes in the browser.'),
    );
    // A new component fits the view. Otherwise the pan and zoom stay.
    if (view.fitted === id) {
      apply();
    } else {
      view = { x: 0, y: 0, scale: 1, fitted: id };
      apply();
      requestAnimationFrame(fit);
    }
    // Draws again when the marks of the last write expire.
    if (hot.size > 0) {
      clearTimeout(cooling);
      cooling = setTimeout(() => state.changed?.(), HOT_MS);
    }
  };

  const drawLog = (): void => {
    const filters = element('div', { class: 'toolbar filters' });
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
      filters.append(element('label', { class: `kind-${kind}` }, box, kind));
    }
    const search = element('input', {
      type: 'search',
      placeholder: 'Search the log',
      'aria-label': 'Search the log',
    });
    search.value = logSearch;
    search.addEventListener('input', () => {
      logSearch = search.value;
      drawLog();
      const next = body.querySelector<HTMLInputElement>('input[type="search"]');
      next?.focus();
      next?.setSelectionRange(logSearch.length, logSearch.length);
    });
    const pause = element(
      'button',
      { class: 'tool', 'aria-pressed': String(paused) },
      paused ? 'Resume' : 'Pause',
    );
    pause.addEventListener('click', () => {
      paused = !paused;
      frozen = paused ? [...state.log] : undefined;
      draw();
    });
    const clear = element('button', { class: 'tool' }, 'Clear');
    clear.addEventListener('click', () => {
      state.log.length = 0;
      frozen = paused ? [] : undefined;
      draw();
    });
    filters.append(search, pause, clear);
    const needle = logSearch.trim().toLowerCase();
    const entries = (frozen ?? state.log).filter(
      (entry) => shown.has(entry.kind) && (!needle || textOf(entry).toLowerCase().includes(needle)),
    );
    const list = element('table', { class: 'rows' });
    for (const entry of entries.toReversed()) {
      list.append(
        element(
          'tr',
          { class: `entry ${entry.kind}` },
          element('td', { class: 'time' }, seconds(entry.time)),
          element('td', { class: `kind-${entry.kind}`, style: 'width: 1%' }, entry.kind),
          element('td', {}, textOf(entry)),
        ),
      );
    }
    body.replaceChildren(
      filters,
      entries.length > 0 ? list : element('div', { class: 'empty' }, 'Nothing to show.'),
    );
  };

  const drawLoading = async (): Promise<void> => {
    const loads = [...state.loads.values()].toSorted((a, b) => a.start - b.start);
    await Promise.all(
      [...new Set(loads.map((load) => load.component))].map((id) => componentInfo(state, id)),
    );
    const unused = loads.filter((load) => PRELOADS.has(load.reason) && !load.used).length;
    const end = Math.max(1, ...loads.map((load) => load.end ?? performance.now()));
    const total = codeBytes(state);
    const table = element(
      'table',
      { class: 'rows' },
      row(['component', 'part', 'why', 'took', 'size', `when, 0 to ${seconds(end)}`], 'th'),
    );
    for (const load of loads) {
      const info = known.get(load.component);
      const marks = load.failed
        ? 'failed'
        : PRELOADS.has(load.reason) && !load.used
          ? 'unused'
          : '';
      const stop = load.end ?? performance.now();
      const bytes = bytesOf(info, load.part);
      const tr = element(
        'tr',
        {},
        element('td', {}, info?.name ?? load.component),
        element('td', { class: 'mono' }, load.part),
        element('td', {}, pill(load.reason, reasonColor(load.reason))),
        element('td', { class: 'mono' }, load.end === undefined ? '…' : ms(load.end - load.start)),
        element('td', { class: 'mono' }, bytes ? kilobytes(bytes) : ''),
        element(
          'td',
          { class: 'bar-cell' },
          element(
            'div',
            { class: 'bar-track' },
            element('span', {
              class: `bar ${barClass(load)}`,
              style: `left:${(load.start / end) * 100}%;width:${((stop - load.start) / end) * 100}%`,
              title: `${seconds(load.start)} to ${seconds(stop)}`,
            }),
          ),
        ),
      );
      if (marks) {
        tr.className = marks;
        tr.title =
          marks === 'unused' ? 'Preloaded, and nothing has run it yet' : 'It failed to load';
      }
      table.append(tr);
    }
    body.replaceChildren(
      element(
        'div',
        { class: 'cards' },
        card(
          'Parts loaded',
          String(loads.length),
          total ? `${kilobytes(total)} from the dev server` : 'sizes come with the requests',
        ),
        card('Unused preloads', String(unused), 'loaded, and nothing ran them yet'),
      ),
      element(
        'div',
        { class: 'legend', style: 'margin: 10px 0 6px' },
        key('var(--blue)', 'event or block'),
        key('var(--purple)', 'preload'),
        element(
          'span',
          {},
          element('i', {
            style:
              'background: repeating-linear-gradient(45deg, var(--purple) 0 2px, transparent 2px 4px); box-shadow: inset 0 0 0 1px var(--purple)',
          }),
          'unused preload',
        ),
        key('var(--faint)', 'a write, state and others'),
        element('span', { class: 'sub' }, 'Sizes are of the dev server, which does not minify.'),
      ),
      loads.length > 0 ? table : element('div', { class: 'empty' }, 'No code loaded yet.'),
    );
  };

  const drawBlocks = (): void => {
    const blocks = [...state.blocks.values()];
    const table = element(
      'table',
      { class: 'rows' },
      row(['block', 'id', 'trigger', 'state', 'fired', 'rendered', ''], 'th'),
    );
    for (const block of blocks) {
      const action = element('span');
      if (block.state === 'waiting' && (block.kind === 'defer' || block.kind === 'client')) {
        const fire = element('button', { class: 'tool', title: 'Fire the trigger now' }, 'Fire');
        fire.addEventListener('click', () => {
          state.fire?.(block);
          draw();
        });
        action.append(fire);
      }
      let took = '';
      if (block.rendered !== undefined) {
        took =
          block.fired === undefined
            ? seconds(block.rendered)
            : `+${ms(block.rendered - block.fired)}`;
      }
      table.append(
        row([
          pill(blockLabel(block), block.kind === '$client' ? 'blue' : 'accent'),
          element('span', { class: 'mono' }, block.id),
          block.trigger ?? '',
          pill(block.state, STATE_COLORS[block.state]),
          block.fired === undefined ? '' : seconds(block.fired),
          took,
          action,
        ]),
      );
    }
    body.replaceChildren(
      element('h2', {}, 'Blocks that render after the page'),
      element(
        'p',
        { class: 'sub', style: 'margin-top: 0' },
        'Streaming bodies come with the page. Waiting ones wait for their trigger, and Fire runs it now.',
      ),
      blocks.length > 0
        ? table
        : element('div', { class: 'empty' }, 'No blocks that render later on this page.'),
    );
  };

  const drawReport = async (): Promise<void> => {
    const id = selected ?? roots()[0]?.m;
    const info = id ? await componentInfo(state, id) : undefined;
    body.replaceChildren(
      ...(info
        ? [
            element('div', { class: 'toolbar' }, chooser(id), source(info)),
            element('pre', { class: 'report' }, info.text),
          ]
        : [element('div', { class: 'empty' }, 'No component yet.')]),
    );
  };

  let queued = false;
  const draw = (): void => {
    drawChrome();
    if (tab === 'log') {
      drawLog();
      return;
    }
    if (tab === 'blocks') {
      drawBlocks();
      return;
    }
    const drawn =
      tab === 'overview'
        ? drawOverview()
        : tab === 'errors'
          ? drawErrors()
          : tab === 'scopes'
            ? drawScopes()
            : tab === 'elements'
              ? drawElements()
              : tab === 'loading'
                ? drawLoading()
                : tab === 'graph'
                  ? drawGraph()
                  : drawReport();
    // Marks of writes show once, on the next draw of the scopes.
    void drawn.then(() => {
      drawChrome();
      if (tab === 'scopes') {
        state.written.clear();
      }
    });
  };
  // Changes come in bursts, so the panel draws once per frame. It waits while a value is edited
  // or a search is typed.
  state.changed = () => {
    const typing = root.activeElement?.matches?.('input[type="search"]');
    if (!queued && !editing && !typing && !(paused && tab === 'log')) {
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (panel) {
          draw();
        }
      });
    }
  };
  showTab = (next) => {
    tab = next;
    draw();
  };
  draw();
}
