// The graph of a component: its layout and its drawing.

import type { Scope } from '../client.ts';
import { findRootScope, preview } from '../devtools.ts';
import { element, iconButton, svg } from './dom.ts';
import { clip } from './format.ts';
import { componentInfo, place, roots } from './info.ts';
import type { ComponentInfo } from './info.ts';
import { chooser } from './workspace.ts';
import type { DockContext } from './workspace.ts';

/** How long a write marks the nodes of the graph. */
export const HOT_MS = 1500;

/** How long a mark waits at each node it passes, so a write shows its order. */
const STEP_MS = 140;

/** The height of a node, the distance between rows, the space between columns and the margin. */
const NODE_HEIGHT = 42;
const ROW = 54;
const GAP = 56;
const PAD = 24;

/** The colour of a node in the graph: signals and props peach, memos purple, effects green, markup blue. */
export function pickNodeColor(kind: string, slot: number | undefined): string {
  if (kind === 'memo') {
    return 'var(--purple)';
  }
  if (kind === 'effect') {
    return 'var(--green)';
  }
  return slot === undefined ? 'var(--blue)' : '#ffc28f';
}

/** What the tooltip of a node calls its kind. */
function nameKind(kind: string): string {
  if (kind === 'memo' || kind === 'effect') {
    return `$${kind}`;
  }
  return kind === 'binding' ? 'markup' : kind;
}

interface Spot {
  x: number;
  y: number;
  width: number;
}

/**
 * Places the nodes of a graph in columns, left to right. A node's column is
 * its depth, the longest path from a value that nothing feeds, so a memo of
 * a memo sits one column further. An edge that skips columns passes through
 * a placeholder in each column it crosses, so no line goes through a node.
 * Within a column, rows are ordered by the average place of the neighbours,
 * a few times in each direction, so edges cross less. Each column is as wide
 * as its widest node and is centred against the tallest one.
 *
 * `routes` has, for each edge, the placeholders it passes through.
 */
export function arrangeGraph(
  nodes: unknown[],
  edges: [number, number][],
  getWidth: (index: number) => number,
): { position: Spot[]; routes: Spot[][] } {
  const count = nodes.length;
  // Depth of each node: the longest path from a value that nothing feeds, in topological order.
  // A node in a cycle never reaches zero inputs, so it keeps the depth its other inputs gave it.
  const depth: number[] = [];
  const waiting: number[] = [];
  const nextOf: number[][] = [];
  for (let index = 0; index < count; index++) {
    depth.push(0);
    waiting.push(0);
    nextOf.push([]);
  }
  for (const [from, to] of edges) {
    nextOf[from]!.push(to);
    waiting[to]!++;
  }
  const ready: number[] = [];
  for (let index = 0; index < count; index++) {
    if (waiting[index] === 0) {
      ready.push(index);
    }
  }
  for (let next = ready.pop(); next !== undefined; next = ready.pop()) {
    for (const to of nextOf[next]!) {
      depth[to] = Math.max(depth[to]!, depth[next]! + 1);
      if (--waiting[to]! === 0) {
        ready.push(to);
      }
    }
  }
  // A placeholder for each column that an edge crosses, shared by the edges of one source, so
  // there are at most as many as nodes times columns. Items after `count` are placeholders.
  const level = depth.slice();
  const links: [number, number][] = [];
  const through: number[][] = [];
  const placeholders = new Map<number, number>();
  for (const [from, to] of edges) {
    const via: number[] = [];
    let last = from;
    for (let column = depth[from]! + 1; column < depth[to]!; column++) {
      const key = from * (count + 1) + column;
      let item = placeholders.get(key);
      if (item === undefined) {
        item = level.length;
        level.push(column);
        placeholders.set(key, item);
        links.push([last, item]);
      }
      via.push(item);
      last = item;
    }
    links.push([last, to]);
    through.push(via);
  }
  // Group the items in columns by depth, and keep the columns that hold an item.
  const columns: number[][] = [];
  for (let index = 0; index < level.length; index++) {
    (columns[level[index]!] ??= []).push(index);
  }
  const filled: number[][] = [];
  for (const column of columns) {
    if (column) {
      filled.push(column);
    }
  }
  const order = new Map<number, number>();
  for (const column of filled) {
    for (const [index, item] of column.entries()) {
      order.set(item, index);
    }
  }
  const before: number[][] = [];
  const after: number[][] = [];
  for (let index = 0; index < level.length; index++) {
    before.push([]);
    after.push([]);
  }
  for (const [from, to] of links) {
    after[from]!.push(to);
    before[to]!.push(from);
  }
  function average(list: number[], fallback: number): number {
    if (list.length === 0) {
      return fallback;
    }
    let sum = 0;
    for (const item of list) {
      sum += order.get(item)!;
    }
    return sum / list.length;
  }
  // Sweep back and forth, ordering each column by the average place of its neighbours.
  for (let sweep = 0; sweep < 8; sweep++) {
    const forward = sweep % 2 === 0;
    const sequence = forward ? filled.slice(1) : filled.slice(0, -1).toReversed();
    for (const column of sequence) {
      const weight = new Map<number, number>();
      for (const item of column) {
        weight.set(item, average(forward ? before[item]! : after[item]!, order.get(item)!));
      }
      column.sort((a, b) => weight.get(a)! - weight.get(b)!);
      for (const [index, item] of column.entries()) {
        order.set(item, index);
      }
    }
  }
  let tallest = 1;
  for (const column of filled) {
    tallest = Math.max(tallest, column.length);
  }
  const spots: Spot[] = [];
  let x = PAD;
  for (const column of filled) {
    let width = 0;
    for (const item of column) {
      if (item < count) {
        width = Math.max(width, getWidth(item));
      }
    }
    // Each column is centred against the tallest one.
    const top = PAD + ((tallest - column.length) * ROW) / 2;
    for (const [index, item] of column.entries()) {
      spots[item] = { x, y: top + index * ROW, width };
    }
    x += width + GAP;
  }
  const routes: Spot[][] = [];
  for (const via of through) {
    const route: Spot[] = [];
    for (const item of via) {
      route.push(spots[item]!);
    }
    routes.push(route);
  }
  return { position: spots.slice(0, count), routes };
}

/** The place of each node, as `arrangeGraph` puts it. */
export function layoutGraph(
  nodes: unknown[],
  edges: [number, number][],
  getWidth: (index: number) => number,
): Spot[] {
  return arrangeGraph(nodes, edges, getWidth).position;
}

/** The path of an edge: from the right side of its source, through its placeholders, to its target. */
function drawEdge(from: Spot, via: Spot[], to: Spot): string {
  const half = NODE_HEIGHT / 2;
  let x = from.x + from.width;
  let y = from.y + half;
  let d = `M${x},${y}`;
  for (const spot of via) {
    const middle = (x + spot.x) / 2;
    d += ` C${middle},${y} ${middle},${spot.y + half} ${spot.x},${spot.y + half} L${spot.x + spot.width},${spot.y + half}`;
    x = spot.x + spot.width;
    y = spot.y + half;
  }
  const end = to.x - 7;
  const middle = (x + end) / 2;
  return `${d} C${middle},${y} ${middle},${to.y + half} ${end},${to.y + half}`;
}

/** The colour class of a value in its text. */
function classifyValue(value: string): string {
  if (value.startsWith('"')) {
    return 'str';
  }
  if (value === 'true' || value === 'false') {
    return 'bool';
  }
  return /^-?\d/.test(value) ? 'num' : 'dim';
}

const GRAPH_STYLE = `
.gwrap { position: relative; height: calc(100% - 42px); min-height: 180px; margin-top: 8px; border-top: 1px solid var(--line); overflow: hidden; cursor: grab; touch-action: none; background: radial-gradient(circle, #ffffff0d 1px, transparent 1.2px) 0 0 / 18px 18px; }
.gwrap.dragging { cursor: grabbing; }
.gwrap > svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.gwrap .node { cursor: pointer; outline: none; }
.gwrap .node rect.box { fill: var(--raised); stroke: #36333a; stroke-width: 1; transition: fill 0.2s, stroke 0.2s; }
.gwrap .node:hover rect.box { stroke: #4a464f; }
.gwrap .node:focus-visible rect.box { stroke: var(--accent); }
.gwrap .node .name { fill: var(--text); font: 500 12px var(--mono); }
.gwrap .node .meta { fill: var(--dim); font: 11px var(--mono); }
.gwrap .node .meta.str { fill: var(--green); }
.gwrap .node .meta.num { fill: var(--blue); }
.gwrap .node .meta.bool { fill: var(--purple); }
.gwrap .node.selected rect.box { fill: #ee7a3e14; stroke: #ee7a3e80; }
.gwrap .node.hot rect.box { animation: graph-mark 0.2s both; }
.gwrap path.gedge.hot-edge { animation: graph-mark-edge 0.2s both; }
@keyframes graph-mark { to { fill: #ffd16624; stroke: #ffd166; } }
@keyframes graph-mark-edge { to { stroke: #ffd166; stroke-width: 1.6; } }
.gwrap .node.faded { opacity: 0.35; }
.gwrap path.gedge { fill: none; stroke: #4a464f; stroke-width: 1.2; transition: stroke 0.2s, opacity 0.2s; }
.gwrap path.gedge.lit { stroke: var(--accent); stroke-width: 1.6; }
.gwrap path.gedge.faded { opacity: 0.25; }
.gtools { position: absolute; left: 12px; bottom: 12px; display: flex; gap: 2px; padding: 3px; border-radius: 9px; background: var(--bg); box-shadow: 0 0 0 1px #36333a, 0 8px 20px #0007; }
.gtools button { width: 26px; height: 26px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 0; }
.graph-side { position: absolute; top: 10px; right: 10px; bottom: 10px; width: 250px; overflow: auto; padding: 14px 16px; border: 0; border-radius: 10px; background: var(--bg); box-shadow: 0 0 0 1px #36333a, 0 12px 32px #0009; cursor: default; }
.graph-side h4 { margin: 0; display: flex; align-items: center; gap: 8px; font: 600 13px var(--mono); }
.graph-side h4 i { flex: none; width: 8px; height: 8px; border-radius: 2px; }
.graph-side h4 button { margin-left: auto; width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 0; }
.graph-side .kind { margin-top: 4px; display: flex; align-items: center; gap: 8px; color: var(--dim); font: 11.5px var(--mono); }
.graph-side .gv { margin-top: 10px; font: 12px var(--mono); overflow-wrap: anywhere; }
.graph-side .sec { margin: 16px 0 6px; color: var(--faint); font-size: 11px; }
.graph-side .lk { display: flex; align-items: center; gap: 7px; width: calc(100% + 16px); height: 26px; margin: 0 -8px; padding: 0 8px; border: 0; border-radius: 6px; font: 11.5px var(--mono); text-align: left; }
.graph-side .lk i { flex: none; width: 7px; height: 7px; border-radius: 2px; }
.graph-side .lk span { margin-left: auto; color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.graph-side .str { color: var(--green); }
.graph-side .num { color: var(--blue); }
.graph-side .bool { color: var(--purple); }
.graph-side .dim { color: var(--dim); }
`;

/** A cross, to close the side. */
function drawCross(): SVGElement {
  return svg(
    'svg',
    {
      width: 14,
      height: 14,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'aria-hidden': 'true',
    },
    svg('path', { d: 'M6 6l12 12M18 6 6 18' }),
  );
}

/** The arrowhead of an edge, in the colour of its stroke, so it follows the stroke when that changes. */
function drawArrow(name: string): SVGElement {
  return svg(
    'marker',
    {
      id: name,
      viewBox: '0 0 8 8',
      refX: 1,
      refY: 4,
      markerWidth: 8,
      markerHeight: 8,
      orient: 'auto',
    },
    svg('path', { d: 'M0,0.5 L7,4 L0,7.5 z', fill: 'context-stroke' }),
  );
}

/** What a node reaches by the edges of an adjacency list, at any depth, with the steps it took. */
function follow(start: number, adjacent: number[][]): Map<number, number> {
  const found = new Map([[start, 0]]);
  const queue = [start];
  for (let at = 0; at < queue.length; at++) {
    const next = queue[at]!;
    for (const far of adjacent[next]!) {
      if (!found.has(far)) {
        found.set(far, found.get(next)! + 1);
        queue.push(far);
      }
    }
  }
  return found;
}

/**
 * The graph of a component as a panel, from any scope of one of its instances.
 * Without the dev server's graph, or without nodes, it shows an empty state.
 */
export function drawGraph(
  ctx: DockContext,
  scope: Scope,
  info: ComponentInfo | undefined,
): HTMLElement {
  if (!info?.graph) {
    return element('div', { class: 'empty' }, 'No graph for this component.');
  }
  const instance = findRootScope(scope);
  return drawNodes(ctx, instance.m ?? '', instance, info);
}

function drawNodes(
  ctx: DockContext,
  id: string,
  instance: Scope | undefined,
  info: ComponentInfo,
): HTMLElement {
  const { state, shell } = ctx;
  const { nodes, edges } = info.graph!;
  if (nodes.length === 0) {
    return element('div', { class: 'empty' }, 'Nothing in this component changes in the browser.');
  }
  // The styles go in the shadow root once, so they are not part of the text of the body.
  if (!ctx.root.querySelector('style[data-graph]')) {
    ctx.root.append(element('style', { 'data-graph': '' }, GRAPH_STYLE));
  }
  // The current value of each value node, from the instance of the component.
  const scopeByNode = new Map<number, Scope>();
  function visit(scope: Scope): void {
    if (!scopeByNode.has(scope.k)) {
      scopeByNode.set(scope.k, scope);
    }
    for (const child of scope.children ?? []) {
      if (child.m === undefined) {
        visit(child);
      }
    }
  }
  if (instance) {
    visit(instance);
  }
  // What each node reads and what reads it.
  const readsOf: number[][] = [];
  const readersOf: number[][] = [];
  for (let index = 0; index < nodes.length; index++) {
    readsOf.push([]);
    readersOf.push([]);
  }
  for (const [from, to] of edges) {
    readersOf[from]!.push(to);
    readsOf[to]!.push(from);
  }
  // Nodes that a recent write reached: the written value, then every node after it, each one
  // STEP_MS after the one before. A node lights at its delay and stays until `end`.
  const now = performance.now();
  const hot = new Map<number, { delay: number; end: number }>();
  // The nodes of each written slot, and what each one reaches (once for each draw).
  const written = new Map<string, number[]>();
  for (const [index, node] of nodes.entries()) {
    if (node.slot !== undefined) {
      const key = `${node.scope}:${node.slot}`;
      const list = written.get(key);
      if (list) {
        list.push(index);
      } else {
        written.set(key, [index]);
      }
    }
  }
  const reached = new Map<number, { steps: Map<number, number>; deepest: number }>();
  for (const entry of state.log) {
    if (entry.write?.component !== id) {
      continue;
    }
    const elapsed = now - entry.time;
    for (const start of written.get(`${entry.write.k}:${entry.write.slot}`) ?? []) {
      let found = reached.get(start);
      if (!found) {
        const steps = follow(start, readersOf);
        found = { steps, deepest: Math.max(...steps.values()) };
        reached.set(start, found);
      }
      // The mark has ended once the deepest node has been lit for HOT_MS.
      if (elapsed >= found.deepest * STEP_MS + HOT_MS) {
        continue;
      }
      for (const [index, steps] of found.steps) {
        const end = entry.time + steps * STEP_MS + HOT_MS;
        if (end > now && end > (hot.get(index)?.end ?? 0)) {
          hot.set(index, { delay: steps * STEP_MS - elapsed, end });
        }
      }
    }
  }
  // Markup nodes share a name, so the box shows the place in the file, such as `9:42`.
  const parts: {
    name: string;
    meta: string;
    value: string | undefined;
    at: string | undefined;
  }[] = [];
  for (const node of nodes) {
    const at = node.at ? `${node.at.line}:${node.at.column}` : undefined;
    const owner = node.slot === undefined ? undefined : scopeByNode.get(node.scope);
    const value = owner && node.slot !== undefined ? preview(owner.s[node.slot]) : undefined;
    let meta = at ? `${nameKind(node.kind)} · ${at}` : nameKind(node.kind);
    if (value !== undefined) {
      meta = value;
    }
    parts.push({ name: node.label, meta, value, at });
  }
  function getNodeWidth(index: number): number {
    return Math.min(
      262,
      Math.max(
        120,
        36 + 7 * Math.max(clip(parts[index]!.name).length, clip(parts[index]!.meta).length),
      ),
    );
  }
  const { position, routes } = arrangeGraph(nodes, edges, getNodeWidth);
  // The lineage of the clicked node: what it reads and what reads it, at any depth.
  const selected =
    shell.graphNode !== undefined && shell.graphNode < nodes.length ? shell.graphNode : undefined;
  const upstream = selected === undefined ? undefined : follow(selected, readsOf);
  const downstream = selected === undefined ? undefined : follow(selected, readersOf);
  const lineage = new Set<number>([...(upstream?.keys() ?? []), ...(downstream?.keys() ?? [])]);
  let graphWidth = 0;
  let graphHeight = 0;
  for (const spot of position) {
    graphWidth = Math.max(graphWidth, spot.x + spot.width);
    graphHeight = Math.max(graphHeight, spot.y + NODE_HEIGHT);
  }
  graphWidth += PAD;
  graphHeight += PAD;
  const layer = svg('g', { class: 'layer' });
  // Faded edges first, then the rest, then lit and hot ones, so a shared run shows the lit colour.
  const behind: SVGElement[] = [];
  const plain: SVGElement[] = [];
  const front: SVGElement[] = [];
  for (const [index, [from, to]] of edges.entries()) {
    const classes = ['gedge'];
    let style = '';
    let pile = plain;
    if (hot.has(from) && hot.has(to)) {
      classes.push('hot-edge');
      style = `animation-delay: ${hot.get(to)!.delay}ms`;
      pile = front;
    } else if (selected !== undefined) {
      // An edge is lit only on a path through the clicked node: both ends before it, or both after it.
      const through =
        (upstream!.has(from) && upstream!.has(to)) ||
        (downstream!.has(from) && downstream!.has(to));
      classes.push(through ? 'lit' : 'faded');
      pile = through ? front : behind;
    }
    pile.push(
      svg('path', {
        class: classes.join(' '),
        'data-edge': index,
        d: drawEdge(position[from]!, routes[index]!, position[to]!),
        'marker-end': 'url(#arrow)',
        ...(style ? { style } : {}),
      }),
    );
  }
  layer.append(...behind, ...plain, ...front);
  for (const [index, node] of nodes.entries()) {
    const { x, y, width: nodeWidth } = position[index]!;
    const part = parts[index]!;
    const classes = ['node'];
    if (hot.has(index)) {
      classes.push('hot');
    }
    if (selected === index) {
      classes.push('selected');
    }
    if (selected !== undefined && !lineage.has(index)) {
      classes.push('faded');
    }
    const name = svg('text', { class: 'name', x: x + 24, y: y + 19 });
    name.textContent = clip(part.name);
    const meta = svg('text', {
      class: part.value === undefined ? 'meta' : `meta ${classifyValue(part.value)}`,
      x: x + 24,
      y: y + 33,
    });
    meta.textContent = clip(part.meta);
    // The tooltip names the kind, since the graph has no legend.
    const title = svg('title', {});
    title.textContent = `${nameKind(node.kind)} ${node.label}${part.value === undefined ? '' : ` = ${part.value}`}${part.at ? `, line ${node.at!.line}` : ''}`;
    const group = svg(
      'g',
      {
        class: classes.join(' '),
        'data-node': index,
        tabindex: 0,
        role: 'button',
        'aria-label': `${nameKind(node.kind)} ${node.label}`,
      },
      svg('rect', {
        class: 'box',
        x,
        y,
        width: nodeWidth,
        height: NODE_HEIGHT,
        rx: 8,
        ...(hot.has(index) ? { style: `animation-delay: ${hot.get(index)!.delay}ms` } : {}),
      }),
      svg('circle', {
        class: 'kind',
        cx: x + 14,
        cy: y + 15,
        r: 3.5,
        fill: pickNodeColor(node.kind, node.slot),
      }),
      name,
      meta,
      title,
    );
    function choose(): void {
      select(shell.graphNode === index ? undefined : index, index);
    }
    group.addEventListener('click', (event) => {
      event.stopPropagation();
      choose();
    });
    group.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
        event.preventDefault();
        choose();
      }
    });
    layer.append(group);
  }
  const canvas = svg(
    'svg',
    { role: 'img', 'aria-label': `Graph of ${info.name}` },
    svg('defs', {}, drawArrow('arrow')),
    layer,
  );
  const frame = element('div', { class: 'gwrap' }, canvas);
  // Selects a node without the dock drawing again, which would drop the focus: this graph is
  // built anew in place of the old one, with the same pan and zoom, and the focus goes to `focus`.
  function select(index: number | undefined, focus?: number): void {
    shell.graphNode = index;
    const next = drawNodes(ctx, id, instance, info);
    frame.replaceWith(next);
    if (focus !== undefined) {
      next.querySelector<SVGElement>(`[data-node="${focus}"]`)?.focus();
    }
  }
  function apply(): void {
    layer.setAttribute(
      'transform',
      `translate(${shell.view.x},${shell.view.y}) scale(${shell.view.scale})`,
    );
  }
  function fit(): void {
    const box = frame.getBoundingClientRect();
    if (box.width === 0) {
      // The dock is not shown yet: leave the view unfitted so the next draw fits it.
      return;
    }
    shell.view.fitted = id;
    // The side covers the right of the view, so the graph fits in what is left.
    const room = box.width - (shell.graphNode === undefined ? 0 : 270);
    shell.view.scale = Math.min(
      1.1,
      Math.max(0.4, Math.min(room / graphWidth, box.height / graphHeight)),
    );
    shell.view.x = Math.max(0, (room - graphWidth * shell.view.scale) / 2);
    shell.view.y = Math.max(0, (box.height - graphHeight * shell.view.scale) / 2);
    apply();
  }
  function zoomAt(factor: number, px: number, py: number): void {
    const next = Math.min(2, Math.max(0.4, shell.view.scale * factor));
    shell.view.x = px - ((px - shell.view.x) * next) / shell.view.scale;
    shell.view.y = py - ((py - shell.view.y) * next) / shell.view.scale;
    shell.view.scale = next;
    apply();
  }
  // Drag to pan, and scroll to zoom around the pointer.
  frame.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const box = frame.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - box.left, event.clientY - box.top);
    },
    { passive: false },
  );
  frame.addEventListener('pointerdown', (event) => {
    if ((event.target as Element).closest('.node, .gtools, .graph-side')) {
      return;
    }
    const start = { x: event.clientX - shell.view.x, y: event.clientY - shell.view.y };
    let moved = false;
    frame.classList.add('dragging');
    function move(next: PointerEvent): void {
      moved = true;
      shell.view.x = next.clientX - start.x;
      shell.view.y = next.clientY - start.y;
      apply();
    }
    function up(): void {
      frame.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      // A click on the empty graph lets go of the node.
      if (!moved && shell.graphNode !== undefined) {
        select(undefined);
      }
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  function zoomButton(name: 'plus' | 'minus', title: string, factor: number): HTMLElement {
    const button = iconButton(name, title, {}, true);
    button.addEventListener('click', () => {
      const box = frame.getBoundingClientRect();
      zoomAt(factor, box.width / 2, box.height / 2);
    });
    return button;
  }
  const fitButton = iconButton('fit', 'Fit the graph in view', {}, true);
  fitButton.addEventListener('click', fit);
  frame.append(
    element(
      'div',
      { class: 'gtools' },
      zoomButton('minus', 'Zoom out', 1 / 1.2),
      zoomButton('plus', 'Zoom in', 1.2),
      fitButton,
    ),
  );

  // The side: the node that was clicked, with what it reads and what reads it.
  if (selected !== undefined) {
    const node = nodes[selected]!;
    const part = parts[selected]!;
    function list(title: string, indexes: number[]): Node[] {
      if (indexes.length === 0) {
        return [];
      }
      const links: HTMLElement[] = [];
      for (const index of indexes) {
        // Markup nodes share a label, so the list names them with their place, such as `insert 9:42`.
        const { label } = nodes[index]!;
        const at = parts[index]!.at;
        let shared = false;
        for (const [i, other] of nodes.entries()) {
          if (i !== index && other.label === label) {
            shared = true;
            break;
          }
        }
        const link = element(
          'button',
          { class: 'lk' },
          element('i', {
            style: `background: ${pickNodeColor(nodes[index]!.kind, nodes[index]!.slot)}`,
          }),
          shared && at ? `${label} ${at}` : label,
        );
        const value = parts[index]!.value;
        if (value !== undefined) {
          link.append(element('span', {}, clip(value)));
        }
        link.addEventListener('click', () => {
          select(index, index);
        });
        links.push(link);
      }
      return [element('div', { class: 'sec' }, title), ...links];
    }
    // The nodes that this node reads, and the nodes that read it.
    const reads: number[] = [];
    const readBy: number[] = [];
    for (const [from, to] of edges) {
      if (to === selected) {
        reads.push(from);
      }
      if (from === selected) {
        readBy.push(to);
      }
    }
    const close = element('button', { title: 'Close', 'aria-label': 'Close' }, drawCross());
    close.addEventListener('click', () => {
      select(undefined, selected);
    });
    const side = element(
      'aside',
      { class: 'graph-side' },
      element(
        'h4',
        {},
        element('i', { style: `background: ${pickNodeColor(node.kind, node.slot)}` }),
        part.name,
        close,
      ),
      element('div', { class: 'kind' }, nameKind(node.kind), node.at ? place(info, node.at) : ''),
      ...(part.value === undefined
        ? []
        : [element('div', { class: `gv ${classifyValue(part.value)}` }, part.value)]),
      ...list('Reads', reads),
      ...list('Read by', readBy),
    );
    frame.append(side);
  }
  // A new component fits the view. Otherwise the pan and zoom stay.
  if (shell.view.fitted === id) {
    apply();
  } else {
    shell.view = { x: 0, y: 0, scale: 1, fitted: '' };
    apply();
    requestAnimationFrame(fit);
  }
  // Draws again when the last mark expires.
  if (hot.size > 0) {
    let last = 0;
    for (const { end } of hot.values()) {
      last = Math.max(last, end);
    }
    clearTimeout(shell.cooling);
    shell.cooling = setTimeout(() => state.changed?.(), last - now);
  }
  return frame;
}

/** The Graph tab: the chooser and the graph of a component. */
export async function drawGraphTab(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state, shell } = ctx;
  const id = shell.selected ?? roots(state)[0]?.m;
  const info = id ? await componentInfo(state, id) : undefined;
  if (!id || !info) {
    into.replaceChildren(element('div', { class: 'empty' }, 'No component yet.'));
    return;
  }
  if (!info.graph) {
    into.replaceChildren(
      element('div', { class: 'toolbar' }, chooser(ctx, id)),
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
  let instance: Scope | undefined;
  for (const scope of roots(state)) {
    if (scope.m === id) {
      instance = scope;
      break;
    }
  }
  into.replaceChildren(
    element(
      'div',
      { class: 'toolbar' },
      chooser(ctx, id),
      element('span', { class: 'sub' }, `${nodes.length} nodes · ${edges.length} edges`),
    ),
    drawNodes(ctx, id, instance, info),
  );
}
