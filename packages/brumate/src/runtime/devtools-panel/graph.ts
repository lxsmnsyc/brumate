// The graph of a component: its layout and its drawing.

import type { Scope } from '../client.ts';
import { preview } from '../devtools.ts';
import { element, iconButton, key, pill, svg } from './dom.ts';
import { clip } from './format.ts';
import { place } from './info.ts';
import type { ComponentInfo } from './info.ts';
import type { DockContext } from './workspace.ts';

/** How long a write marks the nodes of the graph. */
export const HOT_MS = 1500;

/** The colour of a node in the graph. Other kinds are blue when they hold a value. */
export function nodeColor(kind: string, slot: number | undefined): string {
  if (kind === 'memo') {
    return 'purple';
  }
  if (kind === 'effect') {
    return 'green';
  }
  return slot === undefined ? '' : 'blue';
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
  getWidth: (index: number) => number,
): { x: number; y: number; width: number }[] {
  // Depth of each node: the longest path from a value that nothing feeds.
  const depth: number[] = [];
  for (let index = 0; index < nodes.length; index++) {
    depth.push(0);
  }
  for (let round = 0, changed = true; changed && round < nodes.length; round++) {
    changed = false;
    for (const [from, to] of edges) {
      if (depth[from]! + 1 > depth[to]!) {
        depth[to] = depth[from]! + 1;
        changed = true;
      }
    }
  }
  // Group the nodes in columns by depth, and keep the columns that hold a node.
  const columns: number[][] = [];
  for (let index = 0; index < nodes.length; index++) {
    (columns[depth[index]!] ??= []).push(index);
  }
  const filled: number[][] = [];
  for (const column of columns) {
    if (column) {
      filled.push(column);
    }
  }
  const order = new Map<number, number>();
  for (const column of filled) {
    for (const [index, node] of column.entries()) {
      order.set(node, index);
    }
  }
  const before: number[][] = [];
  const after: number[][] = [];
  for (let index = 0; index < nodes.length; index++) {
    before.push([]);
    after.push([]);
  }
  for (const [from, to] of edges) {
    after[from]!.push(to);
    before[to]!.push(from);
  }
  function average(list: number[], fallback: number): number {
    if (list.length === 0) {
      return fallback;
    }
    let sum = 0;
    for (const node of list) {
      sum += order.get(node)!;
    }
    return sum / list.length;
  }
  // Sweep back and forth, ordering each column by the average place of its neighbours.
  for (let sweep = 0; sweep < 8; sweep++) {
    const forward = sweep % 2 === 0;
    const sequence = forward ? filled.slice(1) : filled.slice(0, -1).toReversed();
    for (const column of sequence) {
      const weight = new Map<number, number>();
      for (const node of column) {
        weight.set(node, average(forward ? before[node]! : after[node]!, order.get(node)!));
      }
      column.sort((a, b) => weight.get(a)! - weight.get(b)!);
      for (const [index, node] of column.entries()) {
        order.set(node, index);
      }
    }
  }
  const ROW = 50;
  const GAP = 72;
  let tallest = 1;
  for (const column of filled) {
    tallest = Math.max(tallest, column.length);
  }
  const result: { x: number; y: number; width: number }[] = [];
  let x = 16;
  for (const column of filled) {
    let width = -Infinity;
    for (const node of column) {
      width = Math.max(width, getWidth(node));
    }
    // Each column is centred against the tallest one.
    const top = 16 + ((tallest - column.length) * ROW) / 2;
    for (const [index, node] of column.entries()) {
      result[node] = { x, y: top + index * ROW, width };
    }
    x += width + GAP;
  }
  return result;
}

/** The graph of a component as a panel, from one of its instances. */
export function drawGraph(
  ctx: DockContext,
  id: string,
  instance: Scope | undefined,
  info: ComponentInfo,
): HTMLElement {
  const { state, shell } = ctx;
  const { nodes, edges } = info.graph!;
  // The current value of each value node, from the instance of the component.
  const scopeOfNode = new Map<number, Scope>();
  function visit(scope: Scope): void {
    if (!scopeOfNode.has(scope.k)) {
      scopeOfNode.set(scope.k, scope);
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
  // Nodes that a recent write reached: the written value, and what reads it.
  const now = performance.now();
  const hot = new Set<number>();
  for (const entry of state.log) {
    if (entry.write?.component === id && now - entry.time < HOT_MS) {
      for (const [index, node] of nodes.entries()) {
        if (node.scope === entry.write!.k && node.slot === entry.write!.slot) {
          hot.add(index);
        }
      }
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
  // Markup nodes share a name, so the box shows the place in the file, such as `9:42`.
  const parts: {
    name: string;
    meta: string;
    value: string | undefined;
    at: string | undefined;
  }[] = [];
  for (const node of nodes) {
    const at = node.at ? `${node.at.line}:${node.at.column}` : undefined;
    const owner = node.slot === undefined ? undefined : scopeOfNode.get(node.scope);
    const value = owner && node.slot !== undefined ? preview(owner.s[node.slot]) : undefined;
    let meta = at ? `${node.kind} · ${at}` : node.kind;
    if (value !== undefined) {
      meta = `= ${value}`;
    }
    parts.push({
      name: node.label,
      meta,
      value,
      at,
    });
  }
  function getNodeWidth(index: number): number {
    return Math.min(
      262,
      Math.max(
        112,
        36 + 7 * Math.max(clip(parts[index]!.name).length, clip(parts[index]!.meta).length),
      ),
    );
  }
  const position = layoutGraph(nodes, edges, getNodeWidth);
  // What the clicked node reads, and what reads it, all the way.
  const related = new Set<number>();
  if (shell.graphNode !== undefined && shell.graphNode < nodes.length) {
    related.add(shell.graphNode);
    for (const [from, to] of [
      [0, 1],
      [1, 0],
    ] as const) {
      const queue = [shell.graphNode];
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
  let graphWidth = 0;
  let graphHeight = 0;
  for (const spot of position) {
    graphWidth = Math.max(graphWidth, spot.x + spot.width);
    graphHeight = Math.max(graphHeight, spot.y);
  }
  graphWidth += 16;
  graphHeight += 56;
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
  for (const [index, node] of nodes.entries()) {
    const { x, y, width: nodeWidth } = position[index]!;
    const part = parts[index]!;
    const classes = ['node', `k-${node.kind}`];
    if (hot.has(index)) {
      classes.push('hot');
    }
    if (shell.graphNode === index) {
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
    title.textContent = `${node.kind} ${node.label}${part.value === undefined ? '' : ` = ${part.value}`}${part.at ? `, line ${node.at!.line}` : ''}`;
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
      shell.graphNode = shell.graphNode === index ? undefined : index;
      ctx.draw();
    });
    layer.append(group);
  }
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
  function apply(): void {
    layer.setAttribute(
      'transform',
      `translate(${shell.view.x},${shell.view.y}) scale(${shell.view.scale})`,
    );
  }
  function fit(): void {
    const box = frame.getBoundingClientRect();
    if (box.width === 0) {
      return;
    }
    shell.view.scale = Math.min(
      1.2,
      Math.max(0.3, Math.min(box.width / graphWidth, box.height / graphHeight)),
    );
    shell.view.x = (box.width - graphWidth * shell.view.scale) / 2;
    shell.view.y = Math.max(0, (box.height - graphHeight * shell.view.scale) / 2);
    apply();
  }
  function zoomAt(factor: number, px: number, py: number): void {
    const next = Math.min(3, Math.max(0.2, shell.view.scale * factor));
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
      zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - box.left, event.clientY - box.top);
    },
    { passive: false },
  );
  frame.addEventListener('pointerdown', (event) => {
    if ((event.target as Element).closest('.node, button')) {
      return;
    }
    const start = { x: event.clientX - shell.view.x, y: event.clientY - shell.view.y };
    frame.classList.add('dragging');
    function move(next: PointerEvent): void {
      shell.view.x = next.clientX - start.x;
      shell.view.y = next.clientY - start.y;
      apply();
    }
    function up(): void {
      frame.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  canvas.addEventListener('click', () => {
    if (shell.graphNode !== undefined) {
      shell.graphNode = undefined;
      ctx.draw();
    }
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
      { class: 'zoom' },
      zoomButton('minus', 'Zoom out', 1 / 1.2),
      zoomButton('plus', 'Zoom in', 1.2),
      fitButton,
    ),
  );

  // The side: the node that was clicked, or how to read the graph.
  const side = element('div', { class: 'graph-side' });
  if (shell.graphNode !== undefined && shell.graphNode < nodes.length) {
    const node = nodes[shell.graphNode]!;
    const part = parts[shell.graphNode]!;
    function list(indexes: number[]): Node {
      if (indexes.length === 0) {
        return element('div', { class: 'sub' }, 'nothing');
      }
      const labels: HTMLElement[] = [];
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
        labels.push(element('div', { class: 'mono' }, shared && at ? `${label} ${at}` : label));
      }
      return element('div', {}, ...labels);
    }
    // The nodes that this node reads, and the nodes that read it.
    const reads: number[] = [];
    const readBy: number[] = [];
    for (const [from, to] of edges) {
      if (to === shell.graphNode) {
        reads.push(from);
      }
      if (from === shell.graphNode) {
        readBy.push(to);
      }
    }
    const color = nodeColor(node.kind, node.slot);
    side.append(
      element('h2', {}, part.name),
      element(
        'div',
        { class: 'toolbar' },
        pill(node.kind, color),
        node.at ? place(info, node.at) : '',
      ),
      ...(part.value === undefined
        ? []
        : [element('h3', {}, 'Value'), element('div', { class: 'mono' }, part.value)]),
      element('h3', {}, 'Reads'),
      list(reads),
      element('h3', {}, 'Read by'),
      list(readBy),
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
  const wrap = element('div', { class: 'graph-wrap' }, frame, side);
  // A new component fits the view. Otherwise the pan and zoom stay.
  if (shell.view.fitted === id) {
    apply();
  } else {
    shell.view = { x: 0, y: 0, scale: 1, fitted: id };
    apply();
    requestAnimationFrame(fit);
  }
  // Draws again when the marks of the last write expire.
  if (hot.size > 0) {
    clearTimeout(shell.cooling);
    shell.cooling = setTimeout(() => state.changed?.(), HOT_MS);
  }
  return wrap;
}
