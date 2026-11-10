// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { DevtoolsHooks, Scope } from '../src/runtime/client.ts';
import { installDevtools } from '../src/runtime/devtools.ts';
import { openPanel, togglePanel } from '../src/runtime/devtools-panel.ts';
import { drawGraph, arrangeGraph, layoutGraph } from '../src/runtime/devtools-panel/graph.ts';
import { createShell } from '../src/runtime/devtools-panel/workspace.ts';
import type { DockContext } from '../src/runtime/devtools-panel/workspace.ts';

const DEVTOOLS = Symbol.for('brumate.devtools');

function hooks(): DevtoolsHooks {
  return (globalThis as Record<symbol, DevtoolsHooks | undefined>)[DEVTOOLS]!;
}

function width(): number {
  return 100;
}

describe('layoutGraph', () => {
  it('puts a node in the column of its longest path, not of its kind', () => {
    // 0 -> 1 -> 2, and 0 -> 2: node 2 reads a memo, so it sits two columns away.
    const spots = layoutGraph(
      [0, 1, 2],
      [
        [0, 1],
        [1, 2],
        [0, 2],
      ],
      width,
    );
    expect(spots[0]!.x).toBeLessThan(spots[1]!.x);
    expect(spots[1]!.x).toBeLessThan(spots[2]!.x);
  });

  it('routes an edge that skips a column through it, away from the node there', () => {
    const { position, routes } = arrangeGraph(
      [0, 1, 2],
      [
        [0, 1],
        [1, 2],
        [0, 2],
      ],
      width,
    );
    expect(routes[0]).toEqual([]);
    expect(routes[1]).toEqual([]);
    expect(routes[2]!.length).toBe(1);
    // The placeholder is in the column of node 1, on another row.
    expect(routes[2]![0]!.x).toBe(position[1]!.x);
    expect(routes[2]![0]!.y).not.toBe(position[1]!.y);
  });

  it('orders a column to cross less', () => {
    // Sources 0 and 1 feed 3 and 2 in that order: 2 reads 1, 3 reads 0.
    const spots = layoutGraph(
      [0, 1, 2, 3],
      [
        [0, 3],
        [1, 2],
      ],
      width,
    );
    expect(spots[3]!.y < spots[2]!.y).toBe(spots[0]!.y < spots[1]!.y);
  });

  it('centres a column against the tallest one', () => {
    const spots = layoutGraph(
      [0, 1, 2],
      [
        [0, 2],
        [1, 2],
      ],
      width,
    );
    expect(spots[2]!.y).toBeCloseTo((spots[0]!.y + spots[1]!.y) / 2);
  });

  it('sizes a column by its widest node', () => {
    const spots = layoutGraph([0, 1, 2], [[0, 2]], (index) => (index === 1 ? 160 : 100));
    expect(spots[0]!.width).toBe(160);
    expect(spots[1]!.width).toBe(160);
    expect(spots[2]!.width).toBe(100);
  });
});

describe('arrangeGraph at size', () => {
  it('shares placeholders, so they stay below nodes times columns', () => {
    const count = 300;
    let seed = 3;
    function random(): number {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }
    const edges: [number, number][] = [];
    for (let to = 1; to < count; to++) {
      edges.push([to - 1, to]);
      for (let extra = 0; extra < 4; extra++) {
        edges.push([Math.floor(random() * to), to]);
      }
    }
    const nodes = Array.from({ length: count }, () => 0);
    const { position, routes } = arrangeGraph(nodes, edges, width);
    const columns = new Set<number>();
    for (const spot of position) {
      columns.add(spot.x);
    }
    const placeholders = new Set<unknown>();
    for (const route of routes) {
      for (const spot of route) {
        placeholders.add(spot);
      }
    }
    expect(placeholders.size).toBeLessThanOrEqual(count * columns.size);
    // Every edge that spans columns has one placeholder in each column between.
    for (const [index, [from, to]] of edges.entries()) {
      const span = Math.round(
        [...columns].filter((x) => x > position[from]!.x && x < position[to]!.x).length,
      );
      expect(routes[index]!.length).toBe(span);
    }
  });

  it('ends on a cycle', () => {
    const spots = layoutGraph(
      [0, 1, 2],
      [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
      width,
    );
    expect(spots.length).toBe(3);
  });
});

describe('the Graph view', () => {
  it('draws arrowheads, a tooltip for the kind, no legend, and the lineage of a click', async () => {
    document.body.innerHTML = '';
    document.querySelector('brumate-devtools')?.remove();
    globalThis.fetch = (async () =>
      Response.json({
        name: 'Todos',
        file: 'src/Todos.brm',
        path: '/app/src/Todos.brm',
        scopes: { 0: { label: 'component', slots: ['todos', 'done', 'left', 'other'] } },
        graph: {
          nodes: [
            { kind: 'signal', label: 'todos', scope: 0, slot: 0, at: { line: 4, column: 7 } },
            { kind: 'memo', label: 'done', scope: 0, slot: 1, at: { line: 6, column: 7 } },
            { kind: 'memo', label: 'left', scope: 0, slot: 2, at: { line: 7, column: 7 } },
            { kind: 'signal', label: 'other', scope: 0, slot: 3, at: { line: 5, column: 7 } },
            { kind: 'effect', label: 'save', scope: 0, at: { line: 9, column: 3 } },
          ],
          edges: [
            [0, 1],
            [1, 2],
            [0, 2],
            [3, 4],
            [2, 4],
          ],
        },
        text: '',
      })) as typeof fetch;
    const state = installDevtools('/inspect');
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    const root: Scope = { id: 1, k: 0, m: 'Todos_1', s: ['a', 2, 1, 5], children: new Set() };
    hooks().attach!({
      scopes: new Map([[1, root]]),
      set: (scope, slot, value) => {
        scope.s[slot] = value;
      },
    });
    togglePanel(shadow, state);
    openPanel(shadow, state, 'graph');
    await expect.poll(() => shadow.querySelectorAll('svg g.node').length).toBe(5);

    // Arrowheads on every edge, the kind in the tooltip, and no legend or column headings.
    const edges = [...shadow.querySelectorAll('svg path.gedge')].toSorted(
      (a, b) => Number(a.getAttribute('data-edge')) - Number(b.getAttribute('data-edge')),
    );
    expect(edges.length).toBe(5);
    for (const edge of edges) {
      expect(edge.getAttribute('marker-end')).toMatch(/^url\(#arrow/);
    }
    expect(shadow.querySelector('.legend')).toBeNull();
    const nodeAt = (index: number): Element => shadow.querySelectorAll('svg g.node')[index]!;
    expect(nodeAt(1).querySelector('title')!.textContent).toContain('$memo');
    expect(nodeAt(4).querySelector('title')!.textContent).toContain('$effect');
    // The edge from `todos` to `left` skips a column and passes through it.
    expect(edges[2]!.getAttribute('d')).toContain(' L');

    // No node is selected, so there is no side.
    expect(shadow.querySelector('.graph-side')).toBeNull();

    // A click dims everything outside the lineage, and opens what the node reads and what reads it.
    nodeAt(1).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect.poll(() => shadow.querySelector('.graph-side')).not.toBeNull();
    const faded = [...shadow.querySelectorAll('svg g.node.faded')].map(
      (node) => node.querySelector('.name')!.textContent,
    );
    expect(faded).toEqual(['other']);
    const side = shadow.querySelector('.graph-side')!;
    expect(side.textContent).toContain('Reads');
    expect(side.textContent).toContain('todos');
    expect(side.textContent).toContain('Read by');
    expect(side.textContent).toContain('left');
    // `other -> save` is not on a path through `done`.
    expect(shadow.querySelectorAll('svg path.gedge.lit').length).toBe(3);

    // A node that nothing reads has no Read by section: empty sections are hidden.
    nodeAt(4).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect.poll(() => shadow.querySelector('.graph-side h4')?.textContent).toContain('save');
    expect(shadow.querySelector('.graph-side')!.textContent).not.toContain('Read by');

    // A click in the side opens another node, and the cross closes the side.
    (shadow.querySelector('.graph-side .lk') as HTMLElement).click();
    await expect
      .poll(() => shadow.querySelector('.graph-side h4')?.textContent)
      .not.toContain('save');
    (shadow.querySelector('.graph-side h4 button') as HTMLElement).click();
    await expect.poll(() => shadow.querySelector('.graph-side')).toBeNull();

    // Zoom buttons and fit are there, and the wheel zooms at the pointer.
    expect(shadow.querySelectorAll('.gtools button').length).toBe(3);
    const layer = shadow.querySelector('svg g.layer')!;
    const before = layer.getAttribute('transform');
    (shadow.querySelector('.gtools button[aria-label="Zoom in"]') as HTMLElement).click();
    expect(layer.getAttribute('transform')).not.toBe(before);
    (
      shadow.querySelector('.gtools button[aria-label="Fit the graph in view"]') as HTMLElement
    ).click();
    togglePanel(shadow, state);
  });

  it('shows nothing-to-draw for a graph without nodes, from a scope', () => {
    const root: Scope = { id: 1, k: 0, m: 'Empty_1', s: [], children: new Set() };
    const shell = createShell('graph');
    const ctx = {
      root: document.createElement('div').attachShadow({ mode: 'open' }),
      state: {},
      shell,
    } as unknown as DockContext;
    const empty = drawGraph(ctx, root, {
      name: 'Empty',
      file: 'src/Empty.brm',
      scopes: {},
      text: '',
      graph: { nodes: [], edges: [] },
    } as never);
    expect(empty.textContent).toBe('Nothing in this component changes in the browser.');
    expect(drawGraph(ctx, root, undefined).textContent).toBe('No graph for this component.');
  });

  it('marks a write node by node with a delay, keeps focus on a key, and pans', async () => {
    document.body.innerHTML = '';
    document.querySelector('brumate-devtools')?.remove();
    globalThis.fetch = (async () =>
      Response.json({
        name: 'Chain',
        file: 'src/Chain.brm',
        scopes: { 0: { label: 'component', slots: ['a', 'b', 'c'] } },
        graph: {
          nodes: [
            { kind: 'signal', label: 'a', scope: 0, slot: 0 },
            { kind: 'memo', label: 'b', scope: 0, slot: 1 },
            { kind: 'memo', label: 'c', scope: 0, slot: 2 },
          ],
          edges: [
            [0, 1],
            [1, 2],
          ],
        },
        text: '',
      })) as typeof fetch;
    const timeouts: number[] = [];
    const realSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((handler: TimerHandler, delay?: number, ...rest: unknown[]) => {
      timeouts.push(delay ?? 0);
      return realSetTimeout(handler, delay, ...rest);
    }) as typeof setTimeout;
    const state = installDevtools('/inspect');
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    const root: Scope = { id: 2, k: 0, m: 'Chain_1', s: [1, 2, 3], children: new Set() };
    hooks().attach!({
      scopes: new Map([[2, root]]),
      set: (scope, slot, value) => {
        scope.s[slot] = value;
      },
    });
    togglePanel(shadow, state);
    hooks().write!(root, 0, 5);
    openPanel(shadow, state, 'graph');
    await expect.poll(() => shadow.querySelectorAll('svg g.node.hot').length).toBe(3);
    const marks: number[] = [];
    for (const box of shadow.querySelectorAll('svg g.node rect.box')) {
      marks.push(
        Number.parseFloat(/animation-delay: (-?[\d.]+)ms/.exec(box.getAttribute('style')!)![1]!),
      );
    }
    // The written node is lit now (a delay of about zero or less), each one after it 140 ms later.
    expect(marks[0]!).toBeLessThanOrEqual(0);
    expect(marks[0]!).toBeGreaterThan(-1000);
    expect(marks[1]! - marks[0]!).toBeCloseTo(140, 0);
    expect(marks[2]! - marks[1]!).toBeCloseTo(140, 0);
    // The dock draws again when the last mark ends: the deepest node, two steps in, plus HOT_MS.
    globalThis.setTimeout = realSetTimeout;
    const expiry = timeouts.findLast((delay) => delay > 1000)!;
    expect(expiry).toBeGreaterThan(1500);
    expect(expiry).toBeLessThanOrEqual(280 + 1500);
    const edge = shadow.querySelector('svg path.gedge.hot-edge')!;
    expect(edge.getAttribute('style')).toContain('animation-delay');

    // Enter on a node selects it and keeps the focus on it.
    const nodeAt = (index: number): SVGElement =>
      shadow.querySelector(`svg g.node[data-node="${index}"]`)!;
    nodeAt(1).focus();
    nodeAt(1).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await expect.poll(() => shadow.querySelector('.graph-side')).not.toBeNull();
    expect(shadow.activeElement).toBe(nodeAt(1));
    expect(nodeAt(1).getAttribute('class')).toContain('selected');

    // The wheel zooms at the pointer, and a drag pans.
    const frame = shadow.querySelector('.gwrap')!;
    const layer = (): string => shadow.querySelector('svg g.layer')!.getAttribute('transform')!;
    const start = layer();
    // happy-dom's WheelEvent drops the pointer position, so a mouse event carries the wheel.
    frame.dispatchEvent(
      Object.assign(
        new MouseEvent('wheel', { clientX: 50, clientY: 40, cancelable: true, bubbles: true }),
        { deltaY: -200 },
      ),
    );
    const zoomed = layer();
    expect(zoomed).not.toBe(start);
    expect(Number.parseFloat(/scale\(([\d.]+)\)/.exec(zoomed)![1]!)).toBeGreaterThan(1);
    const before = /translate\(([^,]+),/.exec(zoomed)![1]!;
    frame.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 30 }));
    window.dispatchEvent(new MouseEvent('pointerup'));
    const after = /translate\(([^,]+),/.exec(layer())![1]!;
    expect(Number.parseFloat(after) - Number.parseFloat(before)).toBeCloseTo(50);
    togglePanel(shadow, state);
  });
});
