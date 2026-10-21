// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { DevtoolsHooks, Scope } from '../src/runtime/client.ts';

const DEVTOOLS = Symbol.for('brumate.devtools');
import { installDevtools, preview } from '../src/runtime/devtools.ts';
import { togglePanel } from '../src/runtime/devtools-panel.ts';

function hooks(): DevtoolsHooks {
  return (globalThis as Record<symbol, DevtoolsHooks | undefined>)[DEVTOOLS]!;
}

describe('devtools', () => {
  it('logs what the core reports, and shows scopes with the names of their slots', async () => {
    const state = installDevtools('/inspect');
    const host = document.querySelector('brumate-devtools')!;
    expect(host.shadowRoot!.querySelector('button')!.textContent).toBe('brm');

    const root: Scope = { id: 0, k: 0, m: 'Counter_1', s: [1], children: new Set() };
    const item: Scope = { id: 1, k: 1, p: root, s: ['a'], children: new Set() };
    // The body of a hidden `#offscreen` block.
    const hidden: Scope = { id: 2, k: 2, p: root, s: [], children: new Set() };
    hidden.h = { scope: hidden, ranges: [] } as unknown as Scope['h'];
    root.children.add(item);
    root.children.add(hidden);
    hooks().attach!({
      scopes: new Map([
        [0, root],
        [1, item],
        [2, hidden],
      ]),
      set: () => {},
    });
    hooks().handler!('Counter_1#h0', document.createElement('button'), new Event('click'));
    hooks().part!('Counter_1', 'h0');
    hooks().write!(root, 0, 2);
    root.s[0] = 2;
    expect(state.log.map((entry) => entry.text)).toEqual([
      'click on <button>: Counter_1#h0',
      'loaded Counter_1 h0',
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
    const body = (): string => host.shadowRoot!.querySelector('.body')!.textContent!;
    await expect.poll(body).toContain('Counter (src/Counter.brm)');
    expect(body()).toContain('count = 2');
    expect(body()).toContain('scope 1 · body of #for');
    expect(body()).toContain('item = "a"');
    expect(body()).toContain('scope 2 · body of #offscreen · hidden');
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
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/_brumate/')) {
        return new Response(null, { status: 204, headers: { 'x-brumate-redirect': '/done' } });
      }
      return Response.json({
        name: 'Counter',
        file: 'src/Counter.brm',
        scopes: { 0: { label: 'component', slots: ['count', 'double'] } },
        graph: {
          nodes: [
            { kind: 'signal', label: 'count', scope: 0, slot: 0 },
            { kind: 'memo', label: 'double', scope: 0, slot: 1 },
            { kind: 'binding', label: 'insert', scope: 0 },
          ],
          edges: [
            [0, 1],
            [1, 2],
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
    await expect.poll(() => body().textContent).toContain('count = 1');

    // A click on a value edits it, and Enter writes it as JSON.
    (shadow.querySelector('.slot .value') as HTMLElement).click();
    await expect.poll(() => shadow.querySelector('.slot input')).not.toBeNull();
    const input = shadow.querySelector('.slot input') as HTMLInputElement;
    input.value = '41';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(writes).toEqual([[0, 41]]);

    // A write marks its node and the nodes that read it.
    hooks().write!(root, 0, 42);
    (shadow.querySelector('[data-tab="graph"]') as HTMLElement).click();
    await expect.poll(() => shadow.querySelectorAll('svg g.hot').length).toBe(3);
    expect(shadow.querySelectorAll('svg g').length).toBe(3);

    // A server function call is logged, and the log shows writes by the name of their slot.
    await fetch('/_brumate/Counter_2%23save', { method: 'POST' });
    (shadow.querySelector('[data-tab="log"]') as HTMLElement).click();
    await expect.poll(() => body().textContent).toContain('Counter_2#save: redirect to /done');
    expect(body().textContent).toContain('Counter count = 42');
    const [, , writeBox] = [...shadow.querySelectorAll('.filters input')] as HTMLInputElement[];
    writeBox!.checked = false;
    writeBox!.dispatchEvent(new Event('change'));
    await expect.poll(() => body().textContent).not.toContain('Counter count = 42');
    togglePanel(shadow, state);
  });
});
