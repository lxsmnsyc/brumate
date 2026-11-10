// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { DevtoolsHooks, Scope } from '../src/runtime/client.ts';
import { installDevtools, reportError } from '../src/runtime/devtools.ts';
import { openPanel, togglePanel } from '../src/runtime/devtools-panel.ts';

function hooks(): DevtoolsHooks {
  return (globalThis as Record<symbol, DevtoolsHooks | undefined>)[Symbol.for('brumate.devtools')]!;
}

function open(): { state: ReturnType<typeof installDevtools>; shadow: ShadowRoot } {
  document.querySelector('brumate-devtools')?.remove();
  document.body.innerHTML = '';
  globalThis.fetch = (async () =>
    Response.json({
      name: 'Rows',
      file: 'Rows.brm',
      scopes: { 1: { label: 'component', slots: ['rows', 'title'], readers: [['for 3:1'], []] } },
      text: 'Rows report',
    })) as typeof fetch;
  const state = installDevtools('/inspect', '/_brumate', { version: '1.2.3', vite: '8.0.0' });
  const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
  return { state, shadow };
}

describe('the Page workspace', () => {
  it('shows the numbers, the page state with its size, the blocks and the environment', async () => {
    const { state, shadow } = open();
    const scope = {
      id: 0,
      k: 1,
      m: 'Rows_1',
      s: [Array.from({ length: 200 }, (_, index) => ({ id: index, text: `row ${index}` })), 'Hi'],
      children: [],
    } as unknown as Scope;
    hooks().attach!({ scopes: new Map([[0, scope]]), set: () => {} });
    // An error of the server opens the panel.
    reportError(state, { message: 'Boom' }, 'server');
    await expect.poll(() => shadow.querySelector('.panel')).not.toBeNull();
    openPanel(shadow, state, 'overview');
    const body = (): string => shadow.querySelector('.body')!.textContent!;
    await expect.poll(body).toContain('Environment');
    const metrics = [...shadow.querySelectorAll('.pg .metric .l')].map((node) => node.textContent);
    expect(metrics).toEqual(['Components', 'Page state', 'Handlers run', 'Open for']);
    // The page state shows its size, the bar names the component, and the largest value comes first.
    expect(body()).toContain('Rows ');
    expect(shadow.querySelectorAll('.pg .stack span')).toHaveLength(1);
    expect(shadow.querySelectorAll('.pg tr.large')).toHaveLength(1);
    // The environment holds the versions from the build, and the actions go to other workspaces.
    expect(shadow.querySelector('.pg .env')!.textContent).toContain('1.2.3');
    expect(shadow.querySelector('.pg .env')!.textContent).toContain('8.0.0');
    expect(shadow.querySelector('.pg .acts')!.textContent).toContain('1 issue');
    // The parts of the old panel that the prototype does not have are gone.
    expect(shadow.querySelector('[data-tab="report"]')).toBeNull();
    expect(shadow.querySelector('pre.report')).toBeNull();
    expect(body()).not.toContain('Components on the page');
    togglePanel(shadow, state);
  });

  it('lists the blocks with their states', async () => {
    document.querySelector('brumate-devtools')?.remove();
    document.body.innerHTML =
      '<template b-b="0:1" b-defer="visible:2:/"></template><!--l2-->Later<!--/l-->';
    globalThis.fetch = (async () => Response.json({})) as typeof fetch;
    const state = installDevtools('/inspect');
    const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
    hooks().attach!({ scopes: new Map(), set: () => {} });
    if (!shadow.querySelector('.panel')) {
      togglePanel(shadow, state);
    }
    openPanel(shadow, state, 'blocks');
    const body = (): string => shadow.querySelector('.body')!.textContent!;
    expect(body()).toContain('#defer2visiblewaiting');
    expect(shadow.querySelector('.pg .sec .n')).not.toBeNull();
    expect(shadow.querySelector('.pg button.tool')!.textContent).toContain('Trigger now');
    togglePanel(shadow, state);
  });
});
