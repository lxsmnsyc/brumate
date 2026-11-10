// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { DevtoolsHooks, Scope } from '../src/runtime/client.ts';

const DEVTOOLS = Symbol.for('brumate.devtools');
import {
  installDevtools,
  moveBlock,
  preview,
  reportError,
  type BlockEntry,
  type BlockEvent,
} from '../src/runtime/devtools.ts';
import { openPanel, togglePanel } from '../src/runtime/devtools-panel.ts';

function hooks(): DevtoolsHooks {
  return (globalThis as Record<symbol, DevtoolsHooks | undefined>)[DEVTOOLS]!;
}

describe('devtools', () => {
  it('logs what the core reports, and shows scopes with the names of their slots', async () => {
    const state = installDevtools('/inspect');
    const host = document.querySelector('brumate-devtools')!;
    expect(host.shadowRoot!.querySelector('button.open')!.textContent).toBe('brumate');
    // Without a version from the plugin, the tab shows the name.

    const root: Scope = { id: 0, k: 0, m: 'Counter_1', s: [1], children: new Set() };
    const item: Scope = { id: 1, k: 1, p: root, s: ['a'], children: new Set() };
    // The body of a hidden `#offscreen` block.
    const hidden: Scope = { id: 2, k: 2, p: root, s: [], children: new Set() };
    hidden.h = { scope: hidden, ranges: [] } as unknown as Scope['h'];
    root.children!.add(item);
    root.children!.add(hidden);
    hooks().attach!({
      scopes: new Map([
        [0, root],
        [1, item],
        [2, hidden],
      ]),
      set: () => {},
    });
    hooks().handler!('Counter_1#h0', document.createElement('button'), new Event('click'));
    hooks().write!(root, 0, 2);
    root.s[0] = 2;
    expect(state.log.map((entry) => entry.text)).toEqual([
      'click on <button>: Counter_1#h0',
      'scope 0 slot 0 = 2',
    ]);

    globalThis.fetch = (async () =>
      Response.json({
        name: 'Counter',
        file: 'src/Counter.brm',
        scopes: {
          0: { label: 'component', slots: ['count'] },
          1: { label: 'body of #for', slots: ['item'] },
          2: { label: 'body of #offscreen', slots: [] },
        },
        text: 'Counter report',
      })) as typeof fetch;
    togglePanel(host.shadowRoot!, state);
    const shadow = host.shadowRoot!;
    openPanel(shadow, state, 'overview');
    const body = (): string => shadow.querySelector('.body')!.textContent!;
    // The first tab is the page: its numbers and its environment.
    await expect.poll(body).toContain('Environment');
    openPanel(shadow, state, 'scopes');
    await expect.poll(body).toContain('body of #offscreen · hidden');
    expect(body()).toContain('body of #for');
    const values = (): string[] =>
      [...shadow.querySelectorAll('.slot')].map(
        (line) => line.textContent! + (line.querySelector('input') as HTMLInputElement).value,
      );
    expect(values()).toEqual(['countnumber2']);
    // A scope of the tree shows its slots.
    const forRow = [...shadow.querySelectorAll('.tree-row')].find((line) =>
      line.textContent!.startsWith('body of #for'),
    ) as HTMLElement;
    forRow.click();
    await expect.poll(values).toEqual(['itemstring"a"']);
    togglePanel(host.shadowRoot!, state);
    expect(host.shadowRoot!.querySelector('.panel')).toBeNull();
  });

  it('previews values in a short form', () => {
    expect(preview('x'.repeat(50))).toBe(`"${'x'.repeat(40)}…"`);
    expect(preview([1, 2])).toBe('Array(2)');
    expect(preview({ a: 1, b: 2, c: 3, d: 4 })).toBe('{a, b, c}');
    expect(preview(new Map())).toBe('Map');
  });

  it('edits a value, draws the graph with what a write reached, and filters the log', async () => {
    document.body.innerHTML = '';
    document.querySelector('brumate-devtools')?.remove();
    const writes: [number, unknown][] = [];
    const opened: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/__open-in-editor')) {
        opened.push(decodeURIComponent(String(input).split('file=')[1]!));
        return new Response(null);
      }
      if (String(input).startsWith('/_brumate/')) {
        return new Response(null, { status: 204, headers: { 'x-brumate-redirect': '/done' } });
      }
      return Response.json({
        name: 'Counter',
        file: 'src/Counter.brm',
        path: '/app/src/Counter.brm',
        scopes: { 0: { label: 'component', slots: ['count', 'double'] } },
        graph: {
          nodes: [
            { kind: 'signal', label: 'count', scope: 0, slot: 0, at: { line: 5, column: 7 } },
            {
              kind: 'memo',
              label: 'double',
              scope: 0,
              slot: 1,
              at: { line: 3, column: 9, file: '/app/src/counting.brm.ts' },
            },
            { kind: 'binding', label: 'insert', scope: 0, at: { line: 11, column: 4 } },
            { kind: 'binding', label: 'insert', scope: 0, at: { line: 12, column: 4 } },
          ],
          edges: [
            [0, 1],
            [1, 2],
            [0, 3],
          ],
        },
        text: 'Counter report',
      });
    }) as typeof fetch;
    const state = installDevtools('/inspect');
    const host = document.querySelector('brumate-devtools')!;
    const shadow = host.shadowRoot!;
    const root: Scope = { id: 7, k: 0, m: 'Counter_2', s: [1, 2], children: new Set() };
    hooks().attach!({
      scopes: new Map([[7, root]]),
      set: (scope, slot, value) => {
        writes.push([slot, value]);
        scope.s[slot] = value;
      },
    });
    togglePanel(shadow, state);
    const body = (): HTMLElement => shadow.querySelector('.body')!;
    openPanel(shadow, state, 'scopes');
    await expect
      .poll(() => (shadow.querySelector('.slot input') as HTMLInputElement | null)?.value)
      .toBe('1');

    // A value is an input; a change writes it as JSON.
    await expect.poll(() => shadow.querySelector('.slot input')).not.toBeNull();
    const input = shadow.querySelector('.slot input') as HTMLInputElement;
    input.value = '41';
    input.dispatchEvent(new Event('change'));
    expect(writes).toEqual([[0, 41]]);

    // A write marks its node and the nodes that read it.
    hooks().write!(root, 0, 42);
    openPanel(shadow, state, 'graph');
    await expect.poll(() => shadow.querySelectorAll('svg g.node.hot').length).toBe(4);
    expect(shadow.querySelectorAll('svg g.node').length).toBe(4);
    expect(shadow.querySelectorAll('svg path.edge.hot-edge').length).toBe(3);

    // A node shows its place, and its link opens the editor there: in the file of the
    // component, or in the file of the module that gave the code.
    const nodeBox = (index: number): Element => shadow.querySelectorAll('svg g.node')[index]!;
    expect(nodeBox(2).textContent).toContain('11:4');
    expect(nodeBox(2).querySelector('title')!.textContent).toContain('line 11');
    for (const [index, file] of [
      [0, '/app/src/Counter.brm:5:7'],
      [1, '/app/src/counting.brm.ts:3:9'],
    ] as const) {
      nodeBox(index).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const find = (): HTMLElement | undefined =>
        [...shadow.querySelectorAll<HTMLElement>('.graph-side button')].find((button) =>
          button.textContent!.startsWith('line '),
        );
      await expect.poll(() => find()?.textContent).toBe(`line ${index === 0 ? 5 : 3}`);
      const link = find()!;
      link.click();
      expect(opened.at(-1)).toBe(file);
    }
    // Nodes that share a label are listed with their place.
    nodeBox(0).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect
      .poll(() => shadow.querySelector('.graph-side')?.textContent)
      .toContain('insert 12:4');
    expect(shadow.querySelector('.graph-side')!.textContent).toContain('double');

    // A server function call is logged, and the log shows writes by the name of their slot.
    await fetch('/_brumate/Counter_2%23save', { method: 'POST' });
    openPanel(shadow, state, 'log');
    await expect.poll(() => body().textContent).toContain('Counter save()');
    expect(body().textContent).toContain('redirect → /done');
    expect(body().textContent).toContain('Counter count = 42');
    const writeChip = [...shadow.querySelectorAll<HTMLElement>('.act .chip')].find(
      (chip) => chip.textContent === 'Write',
    )!;
    writeChip.click();
    await expect.poll(() => body().textContent).not.toContain('Counter count = 42');
    togglePanel(shadow, state);
  });

  it('selects the row of the component that renders a picked element', async () => {
    document.body.innerHTML =
      '<div b-b="5:0" b-on="click:prevent=Counter_3#h1"><span class="inner">hi</span> <!--t5:1-->2<!--/t--></div>';
    document.querySelector('brumate-devtools')?.remove();
    globalThis.fetch = (async () =>
      Response.json({
        name: 'Counter',
        file: 'src/Counter.brm',
        scopes: { 0: { label: 'component', slots: ['count', 'double'] } },
        text: '',
      })) as typeof fetch;
    const state = installDevtools('/inspect');
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    const root: Scope = { id: 5, k: 0, m: 'Counter_3', s: [1, 2], children: new Set() };
    hooks().attach!({ scopes: new Map([[5, root]]), set: () => {} });
    togglePanel(shadow, state);

    const pick = [...shadow.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === 'Pick an element',
    )!;
    pick.click();
    document.querySelector('[b-b]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const selected = (): string =>
      shadow.querySelector('.tree-row[aria-current="true"]')?.textContent ?? '';
    await expect.poll(selected).toContain('Counter');
    expect((shadow.querySelector('.slot input') as HTMLInputElement).value).toBe('1');
    togglePanel(shadow, state);
  });

  it('sizes the values of the page state, with the code that reads each', async () => {
    document.querySelector('brumate-devtools')?.remove();
    globalThis.fetch = (async () =>
      Response.json({
        name: 'Rows',
        file: 'Rows.brm',
        scopes: {
          1: { label: 'component', slots: ['rows', 'title'], readers: [['for 3:1'], []] },
        },
        text: '',
      })) as typeof fetch;
    const state = installDevtools('/inspect');
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    const scope = {
      id: 0,
      k: 1,
      m: 'Rows_1',
      s: [Array.from({ length: 200 }, (_, index) => ({ id: index, text: `row ${index}` })), 'Hi'],
      children: [],
    } as unknown as Scope;
    hooks().attach!({ scopes: new Map([[0, scope]]), set: () => {} });
    togglePanel(shadow, state);
    openPanel(shadow, state, 'state');
    const rows = (): string[] =>
      [...shadow.querySelectorAll('.rows tr')].map((tr) => tr.textContent ?? '');
    await expect.poll(() => rows().length).toBe(3);
    // The largest value first, marked, with the code that reads it.
    expect(rows()[1]).toMatch(/^Rowscomponentrows1\d+\.\d kBfor 3:1$/);
    expect(shadow.querySelectorAll('tr.large')).toHaveLength(1);
    expect(rows()[2]).toContain('title');
    togglePanel(shadow, state);
  });

  it('counts the runs and cleanups of effects, and marks one that runs too often', async () => {
    document.querySelector('brumate-devtools')?.remove();
    globalThis.fetch = (async () =>
      Response.json({ name: 'Clock', file: 'Clock.brm', scopes: {}, text: '' })) as typeof fetch;
    const state = installDevtools('/inspect');
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    const scope = { id: 3, k: 1, m: 'Clock_1', s: [], children: [] } as unknown as Scope;
    for (let run = 0; run < 12; run++) {
      hooks().effect!(scope, 'e2', 'run', 1);
      hooks().effect!(scope, 'e2', 'cleanup', 0);
    }
    hooks().effect!(scope, 'e2', 'run', 1);
    hooks().effect!(scope, 'c4', 'run', 2);
    hooks().effect!(scope, 'c4', 'cleanup', 0);
    expect(state.effects.get('3:e2')).toMatchObject({ runs: 13, cleanups: 12, active: true });
    expect(state.effects.get('3:c4')).toMatchObject({ runs: 1, cleanups: 1, active: false });
    togglePanel(shadow, state);
    openPanel(shadow, state, 'effects');
    // One row for each run, 13 and 1, and the newest run of a busy effect is marked.
    await expect.poll(() => shadow.querySelectorAll('.ent').length).toBe(14);
    const busy = [...shadow.querySelectorAll('.ent')].filter((row) => row.querySelector('.bad'));
    expect(busy).toHaveLength(1);
    togglePanel(shadow, state);
  });

  it('shows what each client navigation kept and replaced', async () => {
    document.querySelector('brumate-devtools')?.remove();
    const state = installDevtools('/inspect');
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    hooks().navigated!({
      url: 'http://localhost/issues/2',
      kind: 'push',
      kept: ['/_layout {}'],
      replaced: [{ slot: 'children', from: '/index {}', to: '/issues/[id] {"id":"2"}' }],
      full: false,
      shift: 3,
      start: 0,
      time: 40,
    });
    hooks().navigated!({
      url: 'http://localhost/',
      kind: 'form',
      kept: [],
      replaced: [],
      full: true,
      start: 50,
      time: 20,
    });
    togglePanel(shadow, state);
    openPanel(shadow, state, 'navigation');
    const text = (): string => shadow.querySelector('.body')!.textContent!;
    // The oldest first, as the log reads.
    await expect.poll(text).toMatch(/\/issues\/2 push.*\/ form.*whole page/);
    expect(text()).toContain('kept /_layout {}');
    expect(text()).toContain('replaced children: /index {} → /issues/[id] {"id":"2"}');
    togglePanel(shadow, state);
  });

  it('shows the fallback of a body again, and the body back', () => {
    document.querySelector('brumate-devtools')?.remove();
    const state = installDevtools('/inspect');
    document.body.insertAdjacentHTML('beforeend', '<div id="spot"><p>Body</p></div>');
    const spot = document.getElementById('spot')!;
    const body = spot.firstChild!;
    const fallback = document.createElement('p');
    fallback.textContent = 'Loading';
    // What the swap of the dev server keeps for boundary 5.
    (globalThis as { $bD?: unknown }).$bD = { 5: { f: [fallback], b: [body] } };
    const block = { kind: 'loading', id: '5', state: 'rendered', seen: 0 } as const;
    const entry = { ...block } as Parameters<NonNullable<typeof state.showFallback>>[0];
    expect(state.showFallback!(entry, true)).toBe(true);
    expect(spot.innerHTML).toBe('<p>Loading</p>');
    expect(state.showFallback!(entry, false)).toBe(true);
    expect(spot.innerHTML).toBe('<p>Body</p>');
    delete (globalThis as { $bD?: unknown }).$bD;
    spot.remove();
  });

  it('follows the blocks of the page, and fires a trigger now', async () => {
    document.querySelector('brumate-devtools')?.remove();
    document.body.innerHTML = [
      '<!--l1-->Loading<!--/l-->',
      '<template b-b="0:1" b-defer="visible:2:/"></template><!--l2-->Later<!--/l-->',
      '<template b-b="0:2" b-client="idle=Map_1#k3"></template><!--b0:2-->Map<!--/b-->',
      '<template b-b="0:3" b-client="load=Map_1#c4"></template>',
    ].join('');
    const state = installDevtools('/inspect');
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    const handled: string[] = [];
    hooks().attach!({
      scopes: new Map(),
      set: () => {},
      handle: async (_element, ref) => {
        handled.push(ref);
      },
    });
    const states = () =>
      Object.fromEntries(
        [...state.blocks.values()].map((block) => [`${block.kind} ${block.id}`, block.state]),
      );
    expect(states()).toEqual({
      'defer 2': 'waiting',
      'loading 1': 'streaming',
      'client 0:2': 'waiting',
      '$client 0:3': 'waiting',
    });

    // The body of `#loading` arrives, `#client` renders, and `$client` runs.
    const comments = [...document.body.childNodes].filter(
      (node) => node.nodeType === 8,
    ) as Comment[];
    comments[0]!.remove();
    comments[1]!.remove();
    comments.find((node) => node.data === 'b0:2')!.data = 'b0:2:1';
    hooks().handler!('Map_1#c4', document.querySelector('[b-client$="#c4"]')!);
    await expect.poll(() => states()['loading 1']).toBe('rendered');
    expect(states()['client 0:2']).toBe('rendered');
    expect(states()['$client 0:3']).toBe('rendered');

    togglePanel(shadow, state);
    openPanel(shadow, state, 'blocks');
    const body = (): string => shadow.querySelector('.body')!.textContent!;
    expect(body()).toContain('#defer2visiblewaiting');
    // Fire asks the server for the body of `#defer` now.
    const requests: string[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Headers(init?.headers).get('x-brumate-defer')!);
      return new Response('', { status: 404 });
    }) as typeof fetch;
    (shadow.querySelector('.body button') as HTMLElement).click();
    await expect.poll(() => requests).toEqual(['2 0:1']);
    expect(state.blocks.get('defer:2')!.fired).toBeTypeOf('number');
    // The server sent no body, so the fallback stays and the block failed.
    await expect.poll(() => states()['defer 2']).toBe('failed');
    togglePanel(shadow, state);
  });

  it('collects errors, counts them on the button, and opens the panel for an error of the server', async () => {
    document.querySelector('brumate-devtools')?.remove();
    document.body.innerHTML = '';
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).startsWith('/__brumate/source')
        ? new Response('<script>\n  const a = 1;\n  throw new Error("Boom");\n</script>\n')
        : Response.json({})) as typeof fetch;
    const state = installDevtools('/inspect', '/_brumate', { version: '1.2.3', vite: '8.0.0' });
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    const count = (): string => shadow.querySelector('button.open .count')!.textContent!;
    // The tab shows the version of brumate.
    expect(shadow.querySelector('button.open .version')!.textContent).toBe('1.2.3');

    // An error of a browser extension is not an error of the page.
    dispatchEvent(
      new ErrorEvent('error', { message: 'Other', filename: 'chrome-extension://abc/x.js' }),
    );
    reportError(
      state,
      { message: 'In the browser', stack: 'Error\n    at f (http://localhost:3000/src/a.ts:1:1)' },
      'browser',
    );
    expect(state.errors.map((error) => error.source)).toEqual(['browser']);
    expect(count()).toBe('1 issue');
    expect(shadow.querySelector('.panel')).toBeNull();

    reportError(
      state,
      {
        message: 'Declare $signal with let',
        plugin: 'brumate',
        frame: '> 3 |   throw',
        loc: { file: '/app/src/Page.brm', line: 3, column: 3 },
      },
      'server',
    );
    expect(state.errors.at(-1)!.source).toBe('compile');
    await expect.poll(() => shadow.querySelector('.panel')).not.toBeNull();
    const body = (): string => shadow.querySelector('.body')!.textContent!;
    await expect.poll(body).toContain('Declare $signal with let');
    // The code around the place, highlighted, with its line marked.
    await expect
      .poll(() => shadow.querySelector('.code .error-line')?.textContent)
      .toContain('throw');
    expect(shadow.querySelector('.head .ver')!.textContent).toBe('1.2.3');
    togglePanel(shadow, state);
  });

  it('outlines the elements that change, by how often they change', async () => {
    document.querySelector('brumate-devtools')?.remove();
    document.body.innerHTML = '<p class="count">1</p><p class="other">a</p>';
    const state = installDevtools('/inspect');
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    const count = document.querySelector('.count')!;
    count.getBoundingClientRect = () => new DOMRect(10, 20, 100, 30);
    state.setFlash!(true);
    const canvas = shadow.querySelector('canvas.flashes');
    expect(canvas).not.toBeNull();
    count.textContent = '2';
    await new Promise((resolve) => setTimeout(resolve, 50));
    // The outlines are drawn on the canvas, not added as elements.
    expect(shadow.querySelector('.flash')).toBeNull();
    // The choice stays.
    expect(localStorage.getItem('brumate:devtools:flash')).toBe('1');
    state.setFlash!(false);
    expect(localStorage.getItem('brumate:devtools:flash')).toBe('0');
    expect(shadow.querySelector('.flash')).toBeNull();
  });

  it('shows a card of the element under the pointer while picking', async () => {
    document.querySelector('brumate-devtools')?.remove();
    document.body.innerHTML = '<button class="go" b-b="9:0" b-on="click=Counter_4#h1">Go</button>';
    globalThis.fetch = (async () =>
      Response.json({
        name: 'Counter',
        file: 'src/Counter.brm',
        scopes: { 0: { label: 'component', slots: ['count'] } },
        anchors: { 0: { 0: { label: '<button>', at: '7:1', reads: ['count'] } } },
        text: '',
      })) as typeof fetch;
    const state = installDevtools('/inspect');
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    const root: Scope = { id: 9, k: 0, m: 'Counter_4', s: [3], children: new Set() };
    hooks().attach!({ scopes: new Map([[9, root]]), set: () => {} });
    togglePanel(shadow, state);
    const pick = [...shadow.querySelectorAll('.head button')].find(
      (button) => button.getAttribute('aria-label') === 'Pick an element',
    ) as HTMLElement;
    pick.click();
    document
      .querySelector('.go')!
      .dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    const card = (): string => shadow.querySelector('.inspect-card')?.textContent ?? '';
    await expect.poll(card).toContain('src/Counter.brm:7:1');
    expect(card()).toContain('button.go');
    expect(card()).toContain('click');
    expect(card()).toContain('count = 3');
    // Escape stops picking, and the card goes.
    dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(shadow.querySelector('.inspect-card')).toBeNull();
    // Closing the panel stops picking too, as the card has no styles without it.
    pick.click();
    togglePanel(shadow, state);
    document
      .querySelector('.go')!
      .dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(shadow.querySelector('.inspect-card')).toBeNull();
    expect(document.documentElement.style.cursor).toBe('');
  });

  it('times handlers, with the server calls and the updates that ran meanwhile', async () => {
    document.querySelector('brumate-devtools')?.remove();
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).startsWith('/_brumate/')
        ? new Response('{}', {
            headers: { 'server-timing': 'brumate;dur=12.5;desc="server function"' },
          })
        : Response.json({
            name: 'Cart',
            file: 'src/Cart.brm',
            scopes: {},
            text: '',
          })) as typeof fetch;
    const state = installDevtools('/inspect');
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    let finish!: () => void;
    const begun = performance.now();
    hooks().handled!({
      ref: 'Cart_1#h2',
      element: document.createElement('button'),
      event: 'click',
      begun,
      ready: begun + 1,
      end: begun + 2,
      result: new Promise<void>((resolve) => (finish = resolve)),
    });
    await fetch('/_brumate/Cart_1%23save', { method: 'POST' });
    hooks().updated!(3, performance.now(), performance.now() + 1);
    finish();
    await expect.poll(() => state.timeline[0]?.settled).toBeTypeOf('number');
    const [run] = state.timeline;
    expect(run!.label).toBe('click on <button>');
    expect(run!.calls).toMatchObject([{ name: 'Cart_1#save', status: 200, server: 12.5 }]);
    expect(run!.updates.map((update) => update.count)).toEqual([3]);
    togglePanel(shadow, state);
    openPanel(shadow, state, 'timeline');
    const body = (): string => shadow.querySelector('.body')!.textContent!;
    await expect.poll(body).toContain('click on <button>');
    expect(body()).toContain('Cart h2');
    expect(body()).toContain('Cart save()');
    togglePanel(shadow, state);
  });
});

// The allowed transitions of a block, per kind, apart from the code. An event a state does not
// list leaves it as it is.
const BLOCK_MODEL: Record<
  BlockEntry['kind'],
  {
    start: BlockEntry['state'];
    moves: Partial<Record<BlockEntry['state'], Partial<Record<BlockEvent, BlockEntry['state']>>>>;
  }
> = {
  loading: { start: 'streaming', moves: { streaming: { rendered: 'rendered' } } },
  defer: {
    start: 'waiting',
    moves: {
      waiting: { rendered: 'rendered', fired: 'loading' },
      loading: { rendered: 'rendered', settled: 'failed' },
      failed: { rendered: 'rendered', fired: 'loading' },
    },
  },
  client: { start: 'waiting', moves: { waiting: { rendered: 'rendered' } } },
  $client: { start: 'waiting', moves: { waiting: { rendered: 'rendered', fired: 'rendered' } } },
};

/** Every sequence of events up to a length. */
function sequences(length: number): BlockEvent[][] {
  const events: BlockEvent[] = ['rendered', 'fired', 'settled'];
  let result: BlockEvent[][] = [[]];
  const all: BlockEvent[][] = [[]];
  for (let step = 0; step < length; step++) {
    const longer: BlockEvent[][] = [];
    for (const sequence of result) {
      for (const event of events) {
        longer.push([...sequence, event]);
      }
    }
    all.push(...longer);
    result = longer;
  }
  return all;
}

describe('block states', () => {
  it('follow the model for every sequence of events', () => {
    for (const [kind, model] of Object.entries(BLOCK_MODEL)) {
      for (const sequence of sequences(5)) {
        const block = { kind, id: '1', state: model.start, seen: 0 } as BlockEntry;
        let expected = model.start;
        // When the block rendered: the step of the event that rendered it.
        let rendered: number | undefined;
        for (const [index, event] of sequence.entries()) {
          const next = model.moves[expected]?.[event] ?? expected;
          expect(moveBlock(block, event, index + 1), `${kind} ${sequence.join(' ')}`).toBe(
            next !== expected,
          );
          if (next === 'rendered' && expected !== 'rendered') {
            rendered = index + 1;
          }
          expected = next;
          expect(block.rendered).toBe(rendered);
          expect(block.state, `${kind} ${sequence.join(' ')}`).toBe(expected);
        }
      }
    }
  });
});
