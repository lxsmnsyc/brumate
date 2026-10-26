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
// - Log: handlers, writes and server function calls.
// - Blocks: the `#loading`, `#defer`, `#client` blocks and `$client`
//   callbacks of the page, with their state. A trigger can fire now.
// - Report: the inspect report of a component.

import type { TraceEntry } from './request.ts';
import type * as Highlight from '../highlight.ts';
import type { Scope } from './client.ts';
import type { ScopeId } from './shared.ts';
import { LOGO, preview, rootOf } from './devtools.ts';
import type {
  BlockEntry,
  DevtoolsEntry,
  DevtoolsState,
  ErrorEntry,
  Interaction,
} from './devtools.ts';

/** What the dev server tells about a component: see the inspect endpoint of the plugin. */
interface ComponentInfo {
  name: string;
  file: string;
  /** Each scope of the component, by its number in the compiled component. */
  scopes: Record<number, { label: string; slots: string[]; readers?: string[][] }>;
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
button.tool { display: inline-flex; align-items: center; gap: 6px; border-color: var(--line); background: var(--surface); }
button.tool .icon { color: var(--dim); flex: none; }
button.tool:hover .icon { color: var(--text); }
button.tool.only { padding: 3px 5px; }
.link { display: inline-flex; align-items: center; gap: 4px; }
.link .icon { opacity: 0.7; }
.zoom button.tool { background: var(--raised); }
button.tool[aria-pressed="true"] { border-color: var(--accent); background: #ee7a3e22; color: #ffb48a; }
select, input[type="search"] { background: var(--raised); border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; }
.main { flex: 1; display: flex; min-height: 0; }
.nav { display: flex; flex-direction: column; gap: 1px; padding: 6px; width: 156px; flex: none; border-right: 1px solid var(--line); background: var(--surface); overflow: auto; }
.nav .tab { display: flex; justify-content: space-between; align-items: center; text-align: left; padding: 4px 8px; color: var(--dim); }
.nav .tab { gap: 8px; }
.nav .tab .label { flex: 1; }
.icon { flex: none; }
.nav .tab .icon { color: var(--faint); transition: color 0.15s; }
.nav .tab:hover .icon { color: var(--dim); }
.nav .tab[aria-selected="true"] { background: var(--raised); color: var(--text); box-shadow: 0 0 0 1px var(--line); }
.nav .tab[aria-selected="true"] .icon { color: var(--accent); }
.badge { min-width: 16px; padding: 0 5px; border-radius: 999px; background: var(--raised); color: var(--dim); font: 10px/16px var(--mono); text-align: center; }
.badge:empty { display: none; }
.tab[aria-selected="true"] .badge { background: var(--hover); }
.badge.warn { background: #ffd16622; color: var(--yellow); }
.badge.error, .tab[aria-selected="true"] .badge.error { background: #e5484d; color: #fff; }
.error-message { margin: 0 0 8px; color: var(--red); font: 600 14px/1.4 var(--mono); white-space: pre-wrap; }
.error-row { display: block; width: 100%; text-align: left; padding: 6px 8px; border-radius: 6px; }
.error-row[aria-current="true"] { background: #e5484d14; box-shadow: 0 0 0 1px #e5484d40; }
.error-row .text { display: block; color: var(--text); font: 12px var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.error-row .when { color: var(--faint); font-size: 11px; }
.code { margin: 6px 0 10px; border: 1px solid var(--line); border-radius: 8px; background: #0d1117; overflow: auto; }
.code .twinkleplop { margin: 0; padding: 8px 0; font: 12px/1.6 var(--mono); background: none; white-space: normal; }
.code .l { display: block; padding: 0 12px 0 0; white-space: pre; min-height: 1.6em; }
.code .ln { display: inline-block; width: 44px; padding-right: 12px; text-align: right; color: var(--faint); user-select: none; }
.code .l.error-line { background: #e5484d24; }
.code .l.error-line .ln { color: var(--red); }
.code .error-mark { text-decoration: wavy underline #e5484d; text-underline-offset: 3px; }
.code pre.plain { margin: 0; padding: 8px 12px; font: 12px/1.6 var(--mono); white-space: pre; }
.frames { display: flex; flex-direction: column; gap: 1px; }
.frame { display: flex; gap: 10px; width: 100%; text-align: left; padding: 3px 8px; border-radius: 5px; font: 11.5px var(--mono); }
.frame .fn { color: var(--text); white-space: nowrap; }
.frame .where { color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.frame.library .fn, .frame.library .where { color: var(--faint); }
.frame[aria-current="true"] { background: #ee7a3e14; box-shadow: 0 0 0 1px #ee7a3e40; }
.frame[aria-current="true"] .fn { color: #ffb48a; }
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
.tree-row[aria-current="true"] { background: #ee7a3e14; box-shadow: 0 0 0 1px #ee7a3e40; }
.tree-row[aria-current="true"] > span:first-child { color: #ffb48a; }
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
.navigation { padding: 8px 0; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px; }
.navigation .routes { display: flex; flex-direction: column; gap: 3px; }
tr.large td, tr.busy td { color: var(--yellow); }
tr.ended td { color: var(--faint); }
.bar-track { position: relative; height: 12px; }
.bar { position: absolute; top: 2px; height: 8px; min-width: 3px; border-radius: 3px; background: var(--blue); }
.bar.failed { background: var(--red); }
.bar.render { background: var(--accent); } .bar.memo { background: var(--green); } .bar.body { background: var(--purple); } .bar.stream { background: var(--faint); }
tr.failed td:not(.bar-cell) { color: var(--red); }
.interaction { margin-bottom: 10px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.run-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.run-head .what { font-weight: 600; }
.run-head .ref { color: var(--dim); font: 11.5px var(--mono); }
.run-row { display: grid; grid-template-columns: 170px minmax(0, 1fr) 90px; align-items: center; gap: 10px; font: 11.5px var(--mono); color: var(--dim); }
.run-row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.run-row .took { text-align: right; color: var(--text); }
.track { position: relative; height: 14px; overflow: hidden; border-radius: 4px; background-color: #ffffff08; }
.ruler { position: relative; height: 16px; color: var(--faint); font: 10.5px var(--mono); }
.ruler span { position: absolute; top: 0; transform: translateX(-50%); white-space: nowrap; }
.ruler span:first-child { transform: none; }
.ruler span.end { transform: translateX(-100%); }
.seg { position: absolute; top: 3px; height: 8px; min-width: 2px; border-radius: 3px; }
.seg.wait { background: repeating-linear-gradient(45deg, var(--faint) 0 3px, transparent 3px 6px); }
.seg.run { background: var(--blue); }
.seg.async { background: #7cb7ff55; }
.seg.call { background: #ff9ecf88; }
.seg.server { background: #ff9ecf; }
.seg.update { background: var(--green); }
.seg.failed { background: var(--red); }
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
svg .node .kind { fill: var(--faint); }
svg .node .name { fill: var(--text); font: 600 11.5px var(--mono); }
svg .node .meta { fill: var(--dim); font: 10.5px var(--mono); }
svg .node { cursor: pointer; }
svg .node:hover rect.box { stroke: var(--dim); }
svg .k-signal .kind, svg .k-prop .kind { fill: var(--blue); }
svg .k-memo .kind { fill: var(--purple); }
svg .k-effect .kind { fill: var(--green); }
svg .node.selected rect.box { stroke: var(--accent); stroke-width: 1.5; }
svg .node.hot rect.box { fill: #3a3020; stroke: var(--yellow); }
svg .node.faded { opacity: 0.3; }
svg path.edge { fill: none; stroke: #8a828066; stroke-width: 1.25; }
svg path.edge.lit { stroke: var(--accent); stroke-width: 1.75; }
svg path.edge.hot-edge { stroke: var(--yellow); stroke-width: 1.75; }
svg path.edge.faded { opacity: 0.15; }
pre.report { margin: 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); font: 11.5px/1.55 var(--mono); white-space: pre-wrap; }
.inspect-card { position: fixed; z-index: 2147483647; display: flex; flex-direction: column; gap: 5px; max-width: 340px; padding: 9px 11px; border: 1px solid var(--line, #2f2c31); border-radius: 10px; background: #19181aee; color: #ece8e4; font: 12px/1.4 system-ui, -apple-system, sans-serif; box-shadow: 0 10px 28px #0008; pointer-events: none; backdrop-filter: blur(6px); }
.inspect-card .card-head { display: flex; justify-content: space-between; gap: 12px; color: #ffb48a; }
.inspect-card .card-component { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.inspect-card .card-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.inspect-card .card-hint { margin-top: 2px; padding-top: 6px; border-top: 1px solid #2f2c31; color: #6f6862; font-size: 11px; }
.outline { position: fixed; pointer-events: none; border: 2px solid #ee7a3e; background: #ee7a3e22; border-radius: 3px; z-index: 2147483646; }
`;

type Tab =
  | 'overview'
  | 'errors'
  | 'scopes'
  | 'elements'
  | 'graph'
  | 'log'
  | 'timeline'
  | 'state'
  | 'effects'
  | 'navigation'
  | 'server'
  | 'blocks'
  | 'report';
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
const KINDS: DevtoolsEntry['kind'][] = ['handler', 'write', 'call'];
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

/**
 * The icons of the panel: strokes on a grid of 24, in the colour of the text.
 */
const ICONS = {
  overview:
    '<rect x="3.5" y="3.5" width="7" height="7" rx="1.75"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.75"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.75"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.75"/>',
  errors:
    '<path d="M10.3 4.6a2 2 0 0 1 3.4 0l7 12.2a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3z"/><path d="M12 9.5v4"/><path d="M12 16.8v.2"/>',
  scopes:
    '<rect x="9" y="3" width="6" height="5" rx="1.25"/><rect x="3" y="16" width="6" height="5" rx="1.25"/><rect x="15" y="16" width="6" height="5" rx="1.25"/><path d="M12 8v4M6 16v-2.25A1.75 1.75 0 0 1 7.75 12h8.5A1.75 1.75 0 0 1 18 13.75V16"/>',
  elements: '<path d="M5 4.5 18 10l-5.5 2L10 17.5z"/><path d="m13 13 5.5 5.5"/>',
  graph:
    '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.3 10.8 7.4-3.6M8.3 13.2l7.4 3.6"/>',
  log: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.6"/>',
  loading: '<path d="M4 6h7M8 12h9M13 18h7"/>',
  state:
    '<ellipse cx="12" cy="6" rx="7.5" ry="2.75"/><path d="M4.5 6v6c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75V6"/><path d="M4.5 12v6c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75v-6"/>',
  effects: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4h-4"/>',
  navigation:
    '<path d="M4 7h11M4 7l3.5-3.5M4 7l3.5 3.5"/><path d="M20 17H9M20 17l-3.5-3.5M20 17l-3.5 3.5"/>',
  server:
    '<rect x="4" y="4" width="16" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="16" height="6.5" rx="1.5"/><path d="M7.5 7.25h.01M7.5 16.75h.01" stroke-width="2.6"/>',
  timeline: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.6M10 3h4"/>',
  blocks:
    '<path d="M12 3.5 3.5 8 12 12.5 20.5 8z"/><path d="M3.5 12 12 16.5 20.5 12M3.5 16 12 20.5 20.5 16"/>',
  report:
    '<path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5M9 12.5h6M9 16h6"/>',
  flash:
    '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="2.5"/>',
  pick: '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  close: '<path d="m6 9.5 6 6 6-6"/>',
  trash:
    '<path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l.9 12.1a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  fit: '<path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l9-11h-6z"/>',
  open: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
} as const;

/** An icon by its name, for a button or a tab. */
function icon(name: keyof typeof ICONS, size = 14): SVGElement {
  const node = svg('svg', {
    class: 'icon',
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.8,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  node.innerHTML = ICONS[name];
  return node;
}

/** A button with an icon, and its text or, for an icon alone, its label for screen readers. */
function iconButton(
  name: keyof typeof ICONS,
  text: string,
  attributes: Record<string, string> = {},
  iconOnly = false,
): HTMLButtonElement {
  const button = element(
    'button',
    { class: `tool${iconOnly ? ' only' : ''}`, ...attributes },
    icon(name),
  );
  if (iconOnly) {
    button.setAttribute('aria-label', text);
    button.title ||= text;
  } else {
    button.append(text);
  }
  return button;
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

/** The keys and values of an object, a map or a set, or the items of an array, in a row. */
function entriesOf(value: object): unknown[] {
  if (value instanceof Map) {
    return [...value].flat();
  }
  if (value instanceof Set || Array.isArray(value)) {
    return [...value];
  }
  return Object.entries(value).flat();
}

/**
 * About how many bytes a value takes in the page state. The state is code
 * that seroval writes, which this follows closely enough to compare values.
 */
function sizeOf(value: unknown, seen = new Set<object>()): number {
  if (value === null || value === undefined) {
    return 6;
  }
  switch (typeof value) {
    case 'string':
      return value.length + 2;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value).length;
    case 'function':
      // A reference to client code: its ID and its scope.
      return 24;
    case 'object': {
      if (seen.has(value)) {
        // A reference to a value that is in the state already.
        return 6;
      }
      seen.add(value);
      if (value instanceof Date) {
        return 30;
      }
      const entries = entriesOf(value);
      let bytes = 2;
      for (const entry of entries) {
        bytes += sizeOf(entry, seen) + 1;
      }
      return bytes;
    }
    default:
      return 8;
  }
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

const STATE_COLORS: Record<BlockEntry['state'], string> = {
  waiting: '',
  loading: 'blue',
  streaming: 'blue',
  rendered: 'green',
  failed: 'red',
};

/** The colour of a node in the graph. Other kinds are blue when they hold a value. */
function nodeColor(kind: string, slot: number | undefined): string {
  if (kind === 'memo') {
    return 'purple';
  }
  if (kind === 'effect') {
    return 'green';
  }
  return slot === undefined ? '' : 'blue';
}

/** The colour of how long a run took, in milliseconds. */
function speedColor(total: number): string {
  if (total < 100) {
    return 'green';
  }
  return total < 300 ? 'yellow' : 'red';
}

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
  const open = element(
    'button',
    { class: 'link', title: 'Open in the editor' },
    label,
    icon('open', 12),
  );
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
  for (const child of scope.children ?? []) {
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
  /** The URL of the module that the browser ran, for a frame that no source map maps. */
  url?: string;
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

/** The places in the sources of frames that the browser ran, by their compiled place. */
const mapped = new Map<string, Promise<Frame>>();

/**
 * Maps the frames that the browser ran to their sources, by the source maps
 * of the dev server, so a frame of a component or a module function names
 * its own file and line. A frame that the dev server cannot map stays as it is.
 */
function mapFrames(frames: Frame[], urls: string[]): Promise<Frame[]> {
  return Promise.all(
    frames.map((frame, index) => {
      const url = urls[index];
      if (!frame.compiled || frame.library || !url) {
        return frame;
      }
      // A frame that the source map does not map shows the code that the browser ran.
      const unmapped = { ...frame, url };
      const key = `${url}:${frame.line}:${frame.column}`;
      let result = mapped.get(key);
      if (!result) {
        const query = new URLSearchParams({
          url,
          line: String(frame.line),
          column: String(frame.column),
        });
        result = fetch(`/__brumate/position?${query}`)
          .then((response) => (response.ok ? response.json() : null))
          .then((place: { file: string; line: number; column: number } | null) =>
            place ? { ...frame, ...place, compiled: false } : unmapped,
          )
          .catch(() => unmapped);
        mapped.set(key, result);
      }
      return result;
    }),
  );
}

/** The URLs that the frames of a stack name, as the dev server knows the modules. */
function frameUrls(stack: string | undefined): string[] {
  const urls: string[] = [];
  for (const line of (stack ?? '').split('\n')) {
    const match = /^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
    const file = match?.[2];
    if (!file || /^[a-z-]+-extension:/.test(file) || file.startsWith('<')) {
      continue;
    }
    if (/^https?:/.test(file)) {
      const url = new URL(file);
      urls.push(url.origin === location.origin ? url.pathname + url.search : '');
      if (url.origin !== location.origin) {
        urls.pop();
      }
    } else {
      urls.push('');
    }
  }
  return urls;
}

/** The highlighter, which loads with the first code that the Errors tab shows. */
let highlighter: Promise<typeof Highlight> | undefined;
/** The sources of files, by path. */
const sources = new Map<string, Promise<string | undefined>>();

/** The code of a module as the dev server sent it to the browser. */
function compiledOf(url: string): Promise<string | undefined> {
  let text = sources.get(url);
  if (!text) {
    text = fetch(url)
      .then((response) => (response.ok ? response.text() : undefined))
      .catch(() => undefined);
    sources.set(url, text);
  }
  return text;
}

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
  place: { file: string; line: number; column: number; url?: string },
  fallback?: string,
): Promise<HTMLElement> {
  const box = element('div', { class: 'code' });
  const [text, module] = await Promise.all([
    place.url ? compiledOf(place.url) : sourceOf(place.file),
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
  const target = place.line;
  const word = /^[\w$.]*/.exec(lines[place.line - 1]?.slice(place.column - 1) ?? '')?.[0] ?? '';
  // The colours of the theme, in the box, since the styles of the page do not reach the panel.
  box.append(element('style', {}, module.themeCSS('dark')));
  // The whole file is highlighted, so lines inside a script or a comment have their context. Then
  // only the lines around the place stay, each line one `.l` element.
  box.insertAdjacentHTML(
    'beforeend',
    module.highlightFile(place.url ? 'compiled.ts' : place.file, text, {
      line_numbers: { start: 1 },
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
  const shown = [...box.querySelectorAll('code > .l')];
  shown.forEach((line, index) => {
    if (index + 1 < start || index + 1 > end) {
      // The line break after a line goes with it.
      if (line.nextSibling?.nodeType === Node.TEXT_NODE) {
        line.nextSibling.remove();
      }
      line.remove();
    }
  });
  return box;
}

/** The name of a handler, such as `Index h16`, once the dev server said the component. */
const handlerName = (ref: string): string => {
  const [component, name = ''] = ref.split('#') as [string, string];
  return `${known.get(component)?.name ?? component} ${name}`;
};

/** A round step for the ticks of a ruler: 1, 2 or 5 times a power of ten, at least `rough`. */
function tickStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough));
  for (const factor of [1, 2, 5]) {
    if (factor * power >= rough) {
      return factor * power;
    }
  }
  return 10 * power;
}

let panel: HTMLElement | undefined;
/** Switches the tab of the open panel. */
let showTab: ((tab: Tab) => void) | undefined;
/** Stops picking, with its outline and card, when the panel closes. */
let endPick: (() => void) | undefined;

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
  const opener = root.querySelector<HTMLElement>('button.open');
  if (panel) {
    // Pick has no button, nor the styles of its card, without the panel.
    endPick?.();
    endPick = undefined;
    panel.remove();
    panel = undefined;
    state.changed = undefined;
    document.documentElement.style.removeProperty('padding-bottom');
    if (opener) {
      opener.hidden = false;
    }
    state.resize = undefined;
    state.resized = undefined;
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
      icon(name === 'scopes' ? 'scopes' : name, 15),
      element('span', { class: 'label' }, label),
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
  const pick = iconButton('pick', 'Pick', {
    'aria-pressed': 'false',
    title: 'Click an element of the page to see its scope, handlers and code',
  });
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
      flash,
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
    draw();
  };
  resize.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- It writes the height of this panel.
    const move = (next: PointerEvent): void => state.resize?.(next.clientY);
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      state.resized?.();
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
  // While picking, the element under the pointer is outlined, with a card of what brumate knows
  // about it: its component, its place in the file, its scope, its handlers and what it reads.
  const inspectCard = element('div', { class: 'inspect-card', role: 'tooltip' });
  const hoverBox = element('div', { class: 'outline' });
  let hovered: Element | undefined;
  let hoverToken = 0;
  const onHover = (event: PointerEvent): void => {
    const target = event.target as Element | null;
    if (!target?.closest || event.composedPath().includes(panel!) || target === hovered) {
      return;
    }
    hovered = target;
    void inspect(target);
  };
  const inspect = async (target: Element): Promise<void> => {
    const token = ++hoverToken;
    const rect = target.getBoundingClientRect();
    hoverBox.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
    root.append(hoverBox, inspectCard);
    const tag = target.tagName.toLowerCase();
    const classes = [...target.classList]
      .slice(0, 2)
      .map((name) => `.${name}`)
      .join('');
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
    const scope = anchored ? scopeOf(id) : undefined;
    if (scope) {
      const { info, component: owner, place } = await anchorOf(scope, Number(anchorText));
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
        for (const raw of (handled.getAttribute('b-on') ?? '').split(/\s+/).filter(Boolean)) {
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
  };
  const onEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      stopPicking();
    }
  };
  endPick = (): void => stopPicking();
  const stopPicking = (): void => {
    pick.setAttribute('aria-pressed', 'false');
    window.removeEventListener('click', onPick, true);
    window.removeEventListener('pointermove', onHover, true);
    window.removeEventListener('keydown', onEscape, true);
    document.documentElement.style.cursor = '';
    hovered = undefined;
    hoverToken++;
    hoverBox.remove();
    inspectCard.remove();
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
    window.addEventListener('pointermove', onHover, true);
    window.addEventListener('keydown', onEscape, true);
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
    routeText.textContent = location.pathname + location.search;
    stats.textContent = [
      `${new Set(list.map((scope) => scope.m)).size} components`,
      `${state.scopes?.size ?? 0} scopes`,
      `state ${kilobytes(stateBytes())}`,
    ].join(' · ');
    const waiting = [...state.blocks.values()].filter((block) => block.state === 'waiting').length;
    const counts: Partial<Record<Tab, [number, string?]>> = {
      errors: [state.errors.length, 'Errors'],
      scopes: [new Set(list.map((scope) => scope.m)).size],
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
    const clear = iconButton('trash', 'Clear');
    clear.addEventListener('click', () => {
      state.errors.length = 0;
      state.errorCount?.();
      draw();
    });
    list.append(element('div', { style: 'margin-top: 8px' }, clear));

    // The place to show: a frame that was clicked, the place of a compile error, or the first
    // frame of the app's code.
    const frames = await mapFrames(framesOf(error.stack), frameUrls(error.stack));
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
        place && !('url' in place && place.url) ? open(place) : '',
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
      icon('open', 12),
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
    const blocks = [...state.blocks.values()];
    const handlers = state.log.filter((entry) => entry.kind === 'handler').length;
    const calls = state.log.filter((entry) => entry.kind === 'call').length;
    const table = element(
      'table',
      { class: 'rows' },
      row(['component', 'file', 'instances', 'scopes'], 'th'),
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
      table.append(
        row([
          name,
          source(info),
          String(instances.length),
          String(instances.reduce((sum, scope) => sum + countScopes(scope), 0)),
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
      for (const child of scope.children ?? []) {
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
    const graph = iconButton('graph', 'Show the graph');
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

  /** The handlers of an element, from its `b-on`. */
  const drawHandlers = (target: Element): HTMLElement => {
    const table = element('table', { class: 'rows' }, row(['event', 'handler'], 'th'));
    for (const raw of (target.getAttribute('b-on') ?? '').split(/\s+/).filter(Boolean)) {
      const [head, ref = ''] = raw.split('=') as [string, string];
      const [type, ...modifiers] = head.split(':');
      const [component, name = ''] = ref.split('@')[0]!.split('#') as [string, string];
      const info = known.get(component);
      table.append(
        row([
          element('span', { class: 'mono' }, [type, ...modifiers].join(':')),
          element('span', { class: 'mono' }, `${info?.name ?? component} ${name}`),
        ]),
      );
    }
    return table;
  };

  const drawElements = async (): Promise<void> => {
    if (!picked?.isConnected) {
      const start = iconButton('pick', 'Pick an element');
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
      for (const child of scope.children ?? []) {
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
      let meta = at ? `${node.kind} · ${at[2]}` : node.kind;
      if (value !== undefined) {
        meta = `= ${value}`;
      }
      return {
        name: at ? at[1]! : node.label,
        meta,
        value,
        at: at?.[2],
      };
    });
    const widthOf = (index: number): number =>
      Math.min(
        262,
        Math.max(
          112,
          36 + 7 * Math.max(clip(parts[index]!.name).length, clip(parts[index]!.meta).length),
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
      const name = svg('text', { class: 'name', x: x + 23, y: y + 16 });
      name.textContent = clip(part.name);
      const meta = svg('text', { class: 'meta', x: x + 23, y: y + 30 });
      meta.textContent = clip(part.meta);
      const title = svg('title', {});
      title.textContent = `${node.kind} ${node.label}${part.value === undefined ? '' : ` = ${part.value}`}`;
      const group = svg(
        'g',
        { class: classes.join(' '), 'data-node': index },
        svg('rect', { class: 'box', x, y, width: nodeWidth, height: 38, rx: 7 }),
        svg('circle', { class: 'kind', cx: x + 13, cy: y + 12.5, r: 3.5 }),
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
    const zoomButton = (name: 'plus' | 'minus', title: string, factor: number): HTMLElement => {
      const button = iconButton(name, title, {}, true);
      button.addEventListener('click', () => {
        const box = frame.getBoundingClientRect();
        zoomAt(factor, box.width / 2, box.height / 2);
      });
      return button;
    };
    const fitButton = iconButton('fit', 'Fit the graph in view', {}, true);
    fitButton.addEventListener('click', fit);
    frame.append(
      element(
        'div',
        { class: 'zoom' },
        zoomButton('minus', 'Zoom out', 1 / 1.2),
        zoomButton('plus', 'Zoom in', 1.2),
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
      const color = nodeColor(node.kind, node.slot);
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
    const pause = iconButton(paused ? 'play' : 'pause', paused ? 'Resume' : 'Pause', {
      'aria-pressed': String(paused),
    });
    pause.addEventListener('click', () => {
      paused = !paused;
      frozen = paused ? [...state.log] : undefined;
      draw();
    });
    const clear = iconButton('trash', 'Clear');
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

  const drawState = async (): Promise<void> => {
    const scopes = [...(state.scopes?.values() ?? [])].filter(
      // The scopes that the browser made are not in the state that the server sent.
      (scope) => typeof scope.id !== 'number' || scope.id >= 0,
    );
    const ids = [...new Set(scopes.map((scope) => rootOf(scope).m ?? ''))].filter(Boolean);
    await Promise.all(ids.map((id) => componentInfo(state, id)));
    // The slots of every instance of a scope add up, such as the items of a list.
    const slots = new Map<
      string,
      { component: string; k: number; slot: number; bytes: number; count: number }
    >();
    for (const scope of scopes) {
      const component = rootOf(scope).m ?? '';
      scope.s.forEach((value, slot) => {
        const key = `${component}:${scope.k}:${slot}`;
        const entry = slots.get(key) ?? { component, k: scope.k, slot, bytes: 0, count: 0 };
        entry.bytes += sizeOf(value);
        entry.count++;
        slots.set(key, entry);
      });
    }
    const sorted = [...slots.values()].toSorted((a, b) => b.bytes - a.bytes);
    const first = document.querySelector('script[b-state][b-scopes]')?.textContent?.length ?? 0;
    const table = element(
      'table',
      { class: 'rows' },
      row(['component', 'scope', 'value', 'instances', 'about', 'read in the browser by'], 'th'),
    );
    for (const entry of sorted.slice(0, 200)) {
      const info = known.get(entry.component);
      const layout = info?.scopes[entry.k];
      const readers = layout?.readers?.[entry.slot] ?? [];
      const tr = element(
        'tr',
        {},
        element('td', {}, info?.name ?? entry.component),
        element('td', { class: 'mono' }, layout?.label ?? String(entry.k)),
        element('td', { class: 'mono' }, layout?.slots[entry.slot] ?? `slot ${entry.slot}`),
        element('td', { class: 'mono' }, String(entry.count)),
        element('td', { class: 'mono', style: 'white-space: nowrap' }, kilobytes(entry.bytes)),
        element('td', { class: 'mono' }, readers.join(', ') || '—'),
      );
      // A large value is worth a look: does the browser need all of it?
      if (entry.bytes > 1024) {
        tr.className = 'large';
        tr.title = 'More than 1 kB. Send only the fields that the browser reads.';
      }
      table.append(tr);
    }
    body.replaceChildren(
      element(
        'div',
        { class: 'cards' },
        card('Page state', kilobytes(stateBytes()), 'every state record of the page'),
        card('First record', kilobytes(first), 'the state that the page started with'),
        card('Values', String(slots.size), `in ${scopes.length} scopes`),
      ),
      element(
        'div',
        { class: 'legend', style: 'margin: 10px 0 6px' },
        element(
          'span',
          { class: 'sub' },
          'A value is sent because code in the browser reads it. Sizes are about what the state takes, and a value of many instances adds them up.',
        ),
      ),
      slots.size > 0 ? table : element('div', { class: 'empty' }, 'The page sent no state.'),
    );
  };

  /** The effects and `$client` callbacks, with how often each ran and when its cleanup ran. */
  const drawEffects = async (): Promise<void> => {
    const effects = [...state.effects.values()];
    await Promise.all(
      [...new Set(effects.map((effect) => effect.component))].map((id) => componentInfo(state, id)),
    );
    const now = performance.now();
    // Runs in the last second, which is how an effect that runs too often shows.
    const lastSecond = (recent: number[]): number => recent.filter((at) => now - at < 1000).length;
    const sorted = effects.toSorted(
      (a, b) => lastSecond(b.recent) - lastSecond(a.recent) || b.runs - a.runs,
    );
    const table = element(
      'table',
      { class: 'rows' },
      row(
        ['component', 'scope', 'name', 'runs', 'last second', 'time', 'cleanups', 'last run'],
        'th',
      ),
    );
    for (const effect of sorted) {
      const info = known.get(effect.component);
      const recent = lastSecond(effect.recent);
      const last = effect.recent.at(-1);
      const tr = element(
        'tr',
        {},
        element('td', {}, info?.name ?? effect.component),
        element('td', { class: 'mono' }, info?.scopes[effect.k]?.label ?? String(effect.scope)),
        element(
          'td',
          {},
          pill(
            effect.name.startsWith('c') ? '$client' : '$effect',
            effect.name.startsWith('c') ? 'purple' : 'blue',
          ),
          ' ',
          element('span', { class: 'mono' }, effect.name),
        ),
        element('td', { class: 'mono' }, String(effect.runs)),
        element('td', { class: 'mono' }, String(recent)),
        element('td', { class: 'mono' }, ms(effect.time)),
        element('td', { class: 'mono' }, String(effect.cleanups)),
        element('td', { class: 'mono' }, last === undefined ? '' : `${seconds(now - last)} ago`),
      );
      if (recent >= 10) {
        tr.className = 'busy';
        tr.title = 'It ran 10 times or more in the last second. Check what it reads.';
      } else if (!effect.active) {
        tr.className = 'ended';
        tr.title = 'Its cleanup ran, and it has not run again, such as in a scope that went.';
      }
      table.append(tr);
    }
    const active = effects.filter((effect) => effect.active).length;
    body.replaceChildren(
      element(
        'div',
        { class: 'cards' },
        card('Active', String(active), `of ${effects.length} that ran`),
        card(
          'Runs',
          String(effects.reduce((sum, effect) => sum + effect.runs, 0)),
          'since the page loaded',
        ),
        card(
          'Busy',
          String(effects.filter((effect) => lastSecond(effect.recent) >= 10).length),
          'ran 10 times or more in the last second',
        ),
      ),
      effects.length > 0
        ? table
        : element('div', { class: 'empty' }, 'No effect or $client callback has run yet.'),
    );
  };

  /**
   * The client navigations of the page, newest first: the routes that
   * stayed, those that were replaced, or the whole page, and how far the
   * IDs of the new page moved.
   */
  const drawNavigation = async (): Promise<void> => {
    const list = state.navigations.toReversed();
    const items = list.map((navigation) => {
      const path = new URL(navigation.url).pathname + new URL(navigation.url).search;
      const routes = element('div', { class: 'routes' });
      if (navigation.full) {
        routes.append(
          element(
            'div',
            { class: 'sub' },
            navigation.kind === 'form'
              ? 'The whole page: a form changes what can show anywhere on it.'
              : 'The whole page: its root route or its layouts did not match the page before.',
          ),
        );
      } else {
        for (const key of navigation.kept) {
          routes.append(element('div', { class: 'mono' }, pill('kept', 'green'), ' ', key));
        }
        for (const change of navigation.replaced) {
          routes.append(
            element(
              'div',
              { class: 'mono' },
              pill('replaced', 'yellow'),
              ` ${change.slot}: ${change.from} → ${change.to}`,
            ),
          );
        }
      }
      return element(
        'div',
        { class: 'navigation' },
        element(
          'div',
          { class: 'toolbar' },
          element('span', { class: 'mono' }, path),
          pill(navigation.kind, navigation.kind === 'form' ? 'purple' : 'blue'),
          element('span', { class: 'sub' }, `${ms(navigation.time)} until the page changed`),
          navigation.shift === undefined
            ? ''
            : element('span', { class: 'sub' }, `IDs moved by ${navigation.shift}`),
        ),
        routes,
      );
    });
    body.replaceChildren(
      ...(items.length > 0
        ? items
        : [
            element(
              'div',
              { class: 'empty' },
              'No client navigation yet. Follow a link of the page to see what it keeps.',
            ),
          ]),
    );
  };

  /**
   * What the server did for the last page that loaded: the render until the
   * page could stream, each memo that loaded and each server function call,
   * each `#loading` body, and the rest of the stream, on one scale. The
   * server writes it at the end of the page, in development.
   */
  const drawServer = async (): Promise<void> => {
    const script = [...document.querySelectorAll('script[b-trace]')].at(-1);
    let trace: { route: string; entries: TraceEntry[] } | undefined;
    try {
      trace = script ? JSON.parse(script.textContent ?? '') : undefined;
    } catch {
      trace = undefined;
    }
    if (!trace) {
      body.replaceChildren(
        element(
          'div',
          { class: 'empty' },
          'No trace yet. The dev server writes one at the end of each page that it renders.',
        ),
      );
      return;
    }
    const entries = trace.entries.toSorted((a, b) => a.start - b.start);
    const total = Math.max(1, ...entries.map((entry) => entry.end ?? entry.start));
    const table = element(
      'table',
      { class: 'rows' },
      row(['step', 'what', 'took', `when, 0 to ${ms(total)}`], 'th'),
    );
    for (const entry of entries) {
      const end = entry.end ?? total;
      const tr = element(
        'tr',
        {},
        element('td', {}, pill(entry.kind, entry.failed ? 'red' : '')),
        element('td', { class: 'mono' }, entry.label),
        element('td', { class: 'mono' }, entry.end === undefined ? '…' : ms(end - entry.start)),
        element(
          'td',
          { class: 'bar-cell' },
          element(
            'div',
            { class: 'bar-track' },
            element('span', {
              class: `bar ${entry.failed ? 'failed' : entry.kind}`,
              style: `left:${(entry.start / total) * 100}%;width:${((end - entry.start) / total) * 100}%`,
              title: `${ms(entry.start)} to ${ms(end)}`,
            }),
          ),
        ),
      );
      if (entry.failed) {
        tr.className = 'failed';
      }
      table.append(tr);
    }
    const render = entries.find((entry) => entry.kind === 'render');
    const count = (kind: TraceEntry['kind']): number =>
      entries.filter((entry) => entry.kind === kind).length;
    body.replaceChildren(
      element(
        'div',
        { class: 'cards' },
        card(
          'Until it streamed',
          render?.end === undefined ? '…' : ms(render.end),
          `the render of ${trace.route}`,
        ),
        card('Whole page', ms(total), 'until the last body streamed'),
        card('Memos that loaded', String(count('memo')), `${count('call')} server function calls`),
        card('Bodies', String(count('body')), '#loading bodies that streamed'),
      ),
      element(
        'div',
        { class: 'legend', style: 'margin: 10px 0 6px' },
        key('var(--accent)', 'render'),
        key('var(--green)', 'memo'),
        key('var(--blue)', 'server function call'),
        key('var(--purple)', '#loading body'),
        key('var(--faint)', 'the rest of the stream'),
        element('span', { class: 'sub' }, 'Of the last page that the dev server rendered.'),
      ),
      table,
    );
  };

  const drawTimeline = async (): Promise<void> => {
    const runs = state.timeline.toReversed().slice(0, 40);
    await Promise.all(
      [...new Set(runs.map((run) => run.ref.split('#')[0]!))].map((id) => componentInfo(state, id)),
    );
    if (runs.length === 0) {
      body.replaceChildren(
        element('h2', {}, 'Timeline'),
        element(
          'p',
          { class: 'sub' },
          'Each handler that runs shows here, with the time its code took to load, its own run, the server functions it called and the updates that followed.',
        ),
      );
      return;
    }
    const now = performance.now();
    const totals = runs.map((run) => (run.settled ?? now) - run.begun);
    const segment = (
      run: Interaction,
      scale: number,
      start: number,
      end: number,
      kind: string,
      title: string,
    ): HTMLElement => {
      // Inside the track: a bar that starts before the run, or ends after the scale, is cut.
      const left = Math.min(Math.max(((start - run.begun) / scale) * 100, 0), 100);
      const width = Math.min(Math.max(((end - start) / scale) * 100, 0), 100 - left);
      return element('span', {
        class: `seg ${kind}`,
        style: `left:${left}%;width:${width}%`,
        title,
      });
    };
    const list = element('div');
    runs.forEach((run, index) => {
      const total = totals[index]!;
      const last = Math.max(
        run.settled ?? now,
        ...run.calls.map((call) => call.end ?? now),
        ...run.updates.map((update) => update.end),
      );
      // The scale ends at a round tick past the last bar, so the ruler reads in round numbers.
      const step = tickStep(Math.max(last - run.begun, 1) / 4);
      const scale = Math.ceil(Math.max(last - run.begun, 1) / step) * step;
      const ticks = element('div', { class: 'ruler' });
      for (let time = 0; time <= scale + step / 2; time += step) {
        const at = (time / scale) * 100;
        ticks.append(
          element('span', { class: at > 99 ? 'end' : '', style: `left:${at}%` }, ms(time)),
        );
      }
      // Lines through the tracks at each tick.
      const grid = `background-image: repeating-linear-gradient(to right, #ffffff1a 0 1px, transparent 1px ${(step / scale) * 100}%)`;
      const handler = element(
        'div',
        { class: 'track', style: grid },
        ...(run.ready - run.begun > 0.5
          ? [
              segment(
                run,
                scale,
                run.begun,
                run.ready,
                'wait',
                `waiting for its code and the handlers before it: ${ms(run.ready - run.begun)}`,
              ),
            ]
          : []),
        segment(
          run,
          scale,
          run.ready,
          run.end,
          run.failed ? 'failed' : 'run',
          `its run: ${ms(run.end - run.ready)}`,
        ),
        ...(run.settled !== undefined && run.settled - run.end > 0.5
          ? [
              segment(
                run,
                scale,
                run.end,
                run.settled,
                'async',
                `its promise: ${ms(run.settled - run.end)}`,
              ),
            ]
          : []),
      );
      const rows: HTMLElement[] = [
        element('div', { class: 'run-row' }, element('span'), ticks, element('span')),
        element(
          'div',
          { class: 'run-row' },
          element('span', { class: 'name' }, 'handler'),
          handler,
          element('span', { class: 'took' }, run.settled === undefined ? '…' : ms(total)),
        ),
      ];
      for (const call of run.calls) {
        const end = call.end ?? now;
        const parts = [
          segment(
            run,
            scale,
            call.start,
            end,
            call.status === 'failed' ? 'failed' : 'call',
            `the round trip: ${ms(end - call.start)}`,
          ),
        ];
        if (call.server !== undefined) {
          // The time on the server, in the middle of the round trip.
          const middle = call.start + (end - call.start - call.server) / 2;
          parts.push(
            segment(
              run,
              scale,
              middle,
              middle + call.server,
              'server',
              `on the server: ${ms(call.server)}`,
            ),
          );
        }
        rows.push(
          element(
            'div',
            { class: 'run-row' },
            element('span', { class: 'name', title: call.name }, `call ${handlerName(call.name)}`),
            element('div', { class: 'track', style: grid }, ...parts),
            element(
              'span',
              { class: 'took' },
              call.end === undefined
                ? '…'
                : `${ms(end - call.start)}${call.server === undefined ? '' : ` (${ms(call.server)})`}`,
            ),
          ),
        );
      }
      // The batches of updates share a row, each on its own bar.
      if (run.updates.length > 0) {
        const count = run.updates.reduce((sum, update) => sum + update.count, 0);
        const took = run.updates.reduce((sum, update) => sum + update.end - update.start, 0);
        const batches = run.updates.length;
        rows.push(
          element(
            'div',
            { class: 'run-row' },
            element(
              'span',
              { class: 'name' },
              `${count} ${count === 1 ? 'update' : 'updates'}${batches > 1 ? `, ${batches} batches` : ''}`,
            ),
            element(
              'div',
              { class: 'track', style: grid },
              ...run.updates.map((update) =>
                segment(
                  run,
                  scale,
                  update.start,
                  update.end,
                  'update',
                  `${update.count} ${update.count === 1 ? 'update' : 'updates'} and their effects: ${ms(update.end - update.start)}`,
                ),
              ),
            ),
            element('span', { class: 'took' }, ms(took)),
          ),
        );
      }
      const speed = speedColor(total);
      list.append(
        element(
          'div',
          { class: 'interaction' },
          element(
            'div',
            { class: 'run-head' },
            element('span', { class: 'what' }, run.label),
            element('span', { class: 'ref' }, handlerName(run.ref)),
            element('span', { class: 'spacer' }),
            run.failed ? pill('failed', 'red') : '',
            pill(
              run.settled === undefined ? 'running' : ms(total),
              run.settled === undefined ? 'blue' : speed,
            ),
            element('span', { class: 'sub' }, seconds(run.begun)),
          ),
          ...rows,
        ),
      );
    });
    const settled = totals.filter((_, index) => runs[index]!.settled !== undefined);
    const clear = iconButton('trash', 'Clear');
    clear.addEventListener('click', () => {
      state.timeline.length = 0;
      draw();
    });
    body.replaceChildren(
      element(
        'div',
        { class: 'cards' },
        card('Handlers', String(state.timeline.length), 'the last 40 show here'),
        card(
          'Slowest',
          settled.length > 0 ? ms(Math.max(...settled)) : '—',
          'from the event to the end of its promise',
        ),
        card(
          'Server calls',
          String(runs.reduce((sum, run) => sum + run.calls.length, 0)),
          'made by these handlers',
        ),
      ),
      element(
        'div',
        { class: 'toolbar', style: 'margin-top: 8px' },
        element(
          'div',
          { class: 'legend' },
          element(
            'span',
            {},
            element('i', {
              style:
                'background: repeating-linear-gradient(45deg, var(--faint) 0 2px, transparent 2px 4px)',
            }),
            'waiting for code',
          ),
          key('var(--blue)', 'run'),
          key('#7cb7ff55', 'its promise'),
          key('#ff9ecf88', 'server call'),
          key('#ff9ecf', 'on the server'),
          key('var(--green)', 'updates'),
        ),
        element('span', { class: 'spacer' }),
        clear,
      ),
      list,
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
        const fire = iconButton('bolt', 'Fire', { title: 'Fire the trigger now' });
        fire.addEventListener('click', () => {
          state.fire?.(block);
          draw();
        });
        action.append(fire);
      }
      // A body that the page swapped in, whose fallback it kept, can show its fallback again.
      const kept = (globalThis as { $bD?: Record<string, unknown> }).$bD?.[block.id];
      if (
        block.state === 'rendered' &&
        kept &&
        (block.kind === 'loading' || block.kind === 'defer')
      ) {
        const toggle = iconButton(
          block.fallback ? 'play' : 'pause',
          block.fallback ? 'Body' : 'Fallback',
          {
            title: block.fallback
              ? 'Show the body again'
              : 'Show the fallback in place of the body',
            'aria-pressed': String(block.fallback === true),
          },
        );
        toggle.addEventListener('click', () => {
          state.showFallback?.(block, !block.fallback);
          draw();
        });
        action.append(toggle);
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
        'Streaming bodies come with the page. Waiting ones wait for their trigger, and Fire runs it now. Fallback shows the fallback of a body again, to check both sides.',
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

  /** The draw of each tab that loads what it shows. Log and Blocks draw at once. */
  const drawTab: Record<Exclude<Tab, 'log' | 'blocks'>, () => Promise<void>> = {
    overview: drawOverview,
    errors: drawErrors,
    scopes: drawScopes,
    elements: drawElements,
    state: drawState,
    effects: drawEffects,
    navigation: drawNavigation,
    server: drawServer,
    timeline: drawTimeline,
    graph: drawGraph,
    report: drawReport,
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
    const drawing = tab;
    const drawn = drawTab[tab]();
    void drawn.then(() => {
      // A tab that waited for the dev server, and that the user left meanwhile, drew over the
      // tab that is open now, so that one draws again.
      if (tab !== drawing) {
        draw();
        return;
      }
      drawChrome();
      // Marks of writes show once, on the next draw of the scopes.
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
