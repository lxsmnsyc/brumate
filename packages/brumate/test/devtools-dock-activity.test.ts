// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { DevtoolsHooks } from '../src/runtime/client.ts';
import { installDevtools } from '../src/runtime/devtools.ts';
import { togglePanel } from '../src/runtime/devtools-panel.ts';
import { tickStep } from '../src/runtime/devtools-panel/activity.ts';

const DEVTOOLS = Symbol.for('brumate.devtools');

function hooks(): DevtoolsHooks {
  return (globalThis as Record<symbol, DevtoolsHooks | undefined>)[DEVTOOLS]!;
}

function open(): { state: ReturnType<typeof installDevtools>; shadow: ShadowRoot } {
  document.querySelector('brumate-devtools')?.remove();
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).startsWith('/_brumate/')
      ? new Response('{}', { headers: { 'server-timing': 'brumate;dur=4;desc="server"' } })
      : Response.json({
          name: 'Cart',
          file: 'src/Cart.brm',
          scopes: {},
          text: '',
        })) as typeof fetch;
  const state = installDevtools('/inspect');
  const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
  return { state, shadow };
}

function show(shadow: ShadowRoot): void {
  (shadow.querySelector('[data-ws="activity"]') as HTMLElement).click();
}

function rows(shadow: ShadowRoot): string[] {
  const texts: string[] = [];
  for (const row of shadow.querySelectorAll('.ent')) {
    texts.push(row.textContent!);
  }
  return texts;
}

describe('the Activity workspace', () => {
  it('rounds the steps of the ruler', () => {
    expect(tickStep(0.3)).toBeCloseTo(0.5);
    expect(tickStep(180)).toBe(200);
    expect(tickStep(1000)).toBe(1000);
  });

  it('shows handlers, calls, effects and navigations in one log with filters', async () => {
    const { state, shadow } = open();
    const scope = { id: 3, k: 1, m: 'Cart_1', s: [], children: [] } as never;
    hooks().handler!('Cart_1#h2', document.createElement('button'), new Event('click'));
    hooks().effect!(scope, 'e2', 'run', 1);
    hooks().navigated!({
      url: 'http://localhost/cart',
      kind: 'push',
      kept: [],
      replaced: [],
      full: true,
      start: performance.now(),
      time: 12,
    });
    togglePanel(shadow, state);
    show(shadow);
    await expect.poll(() => rows(shadow).length).toBe(4);
    const text = rows(shadow).join('|');
    expect(text).toContain('Handler');
    expect(text).toContain('Effect');
    expect(text).toContain('/cart');
    // A filter chip hides its kind.
    const chip = [...shadow.querySelectorAll<HTMLElement>('.act .chip')].find(
      (item) => item.textContent === 'Effect',
    )!;
    chip.click();
    await expect.poll(() => rows(shadow).join('|')).not.toContain('Effect');
    expect(chip.isConnected).toBe(false);
    togglePanel(shadow, state);
  });

  it('pauses the log, and clears it', async () => {
    const { state, shadow } = open();
    hooks().handler!('Cart_1#h2', document.createElement('button'), new Event('click'));
    togglePanel(shadow, state);
    show(shadow);
    await expect.poll(() => rows(shadow).length).toBe(1);
    const tool = (label: string): HTMLElement =>
      [...shadow.querySelectorAll<HTMLElement>('.act .tools button')].find((item) =>
        item.textContent!.includes(label),
      )!;
    tool('Pause').click();
    await expect.poll(() => tool('Resume')).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 5));
    hooks().handler!('Cart_1#h3', document.createElement('button'), new Event('click'));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(rows(shadow)).toHaveLength(1);
    tool('Resume').click();
    await expect.poll(() => rows(shadow).length).toBe(2);
    tool('Clear').click();
    await expect.poll(() => rows(shadow).length).toBe(0);
    expect(shadow.querySelector('.act .log')!.textContent).toContain('Nothing yet');
    togglePanel(shadow, state);
  });

  it('lists a call with its name, status and time, and opens its detail in the split', async () => {
    const { state, shadow } = open();
    const begun = performance.now();
    hooks().handled!({
      ref: 'Cart_1#h2',
      element: document.createElement('button'),
      event: 'click',
      begun,
      ready: begun + 1,
      end: begun + 2,
      result: undefined,
    });
    await fetch('/_brumate/Cart_1%23save', { method: 'POST' });
    togglePanel(shadow, state);
    show(shadow);
    await expect.poll(() => shadow.querySelector('.ent.call')).not.toBeNull();
    const call = shadow.querySelector<HTMLElement>('.ent.call')!;
    expect(call.textContent).toContain('Cart save()');
    expect(call.textContent).toContain('200');
    expect(call.textContent).toMatch(/\d+ ms/);
    // With no call selected, the log has the whole width: there is no detail pane and no handle.
    expect(shadow.querySelector('.split.activity > .detail')).toBeNull();
    expect(shadow.querySelector('.split.activity > .handle')).toBeNull();
    expect(shadow.querySelector('.split.activity > .act')).not.toBeNull();
    expect(shadow.textContent).not.toContain('Select a server call');
    call.click();
    await expect
      .poll(() => shadow.querySelector('.split.activity > .detail .call-detail'))
      .not.toBeNull();
    // The log is the first column and the detail sits beside it.
    expect(shadow.querySelector('.split.activity > .list > .act')).not.toBeNull();
    expect(shadow.querySelector('.ent.call')!.getAttribute('aria-current')).toBe('true');
    // The same row, or the close button, closes it.
    shadow.querySelector<HTMLElement>('.act-close')!.click();
    await expect.poll(() => shadow.querySelector('.call-detail')).toBeNull();
    expect(shadow.querySelector('.split.activity > .detail')).toBeNull();
    togglePanel(shadow, state);
  });

  it('keeps the scroll of the log that the user left, and the detail it drew', async () => {
    const { state, shadow } = open();
    const begun = performance.now();
    hooks().handled!({
      ref: 'Cart_1#h2',
      element: document.createElement('button'),
      event: 'click',
      begun,
      ready: begun + 1,
      end: begun + 2,
      result: undefined,
    });
    await fetch('/_brumate/Cart_1%23save', { method: 'POST' });
    togglePanel(shadow, state);
    show(shadow);
    await expect.poll(() => shadow.querySelector('.ent.call')).not.toBeNull();
    // The record of the call arrives after the answer; the detail draws again for it once.
    await expect.poll(() => state.timeline[0]!.calls[0]!.record).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 30));
    // The user scrolls up in the log.
    const log = shadow.querySelector<HTMLElement>('.act .log')!;
    Object.defineProperty(log, 'scrollHeight', { value: 1000 });
    Object.defineProperty(log, 'clientHeight', { value: 100 });
    log.scrollTop = 200;
    log.dispatchEvent(new Event('scroll'));
    shadow.querySelector<HTMLElement>('.ent.call')!.click();
    await expect.poll(() => shadow.querySelector('.call-detail')).not.toBeNull();
    const detail = shadow.querySelector('.call-detail');
    // Activity on the page draws the workspace again.
    hooks().handler!('Cart_1#h3', document.createElement('button'), new Event('click'));
    await expect.poll(() => shadow.querySelectorAll('.ent').length).toBeGreaterThan(2);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(shadow.querySelector<HTMLElement>('.act .log')!.scrollTop).toBe(200);
    // The same detail element stays, with whatever it holds.
    expect(shadow.querySelector('.call-detail')).toBe(detail);
    togglePanel(shadow, state);
  });

  it('shows the timing of a call that no handler made', async () => {
    const { state, shadow } = open();
    await fetch('/_brumate/Cart_1%23save', { method: 'POST' });
    togglePanel(shadow, state);
    show(shadow);
    await expect.poll(() => shadow.querySelector('.ent.call')).not.toBeNull();
    expect(state.timeline).toHaveLength(0);
    const call = shadow.querySelector('.ent.call')!;
    expect(call.textContent).toContain('Cart save()');
    expect(call.textContent).toContain('200');
    expect(call.textContent).toMatch(/\d+ ms/);
    togglePanel(shadow, state);
  });
});
