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
    root.children.add(item);
    hooks().attach!({
      scopes: new Map([
        [0, root],
        [1, item],
      ]),
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
        },
        text: 'Counter report',
      })) as typeof fetch;
    togglePanel(host.shadowRoot!, state);
    const body = (): string => host.shadowRoot!.querySelector('.body')!.textContent!;
    await expect.poll(body).toContain('Counter (src/Counter.brm)');
    expect(body()).toContain('count = 2');
    expect(body()).toContain('scope 1 · body of #for');
    expect(body()).toContain('item = "a"');
    togglePanel(host.shadowRoot!, state);
    expect(host.shadowRoot!.querySelector('.panel')).toBeNull();
  });

  it('previews values in a short form', () => {
    expect(preview('x'.repeat(50))).toBe(`"${'x'.repeat(40)}…"`);
    expect(preview([1, 2])).toBe('Array(2)');
    expect(preview({ a: 1, b: 2, c: 3, d: 4 })).toBe('{a, b, c}');
    expect(preview(new Map())).toBe('Map');
  });
});
