// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DevtoolsHooks, Scope } from '../src/runtime/client.ts';
import { installDevtools, reportError } from '../src/runtime/devtools.ts';
import { openPanel, togglePanel } from '../src/runtime/devtools-panel.ts';
import { filterItems } from '../src/runtime/devtools-panel/search.ts';
import type { SearchItem } from '../src/runtime/devtools-panel/search.ts';

const DEVTOOLS = Symbol.for('brumate.devtools');

function hooks(): DevtoolsHooks {
  return (globalThis as Record<symbol, DevtoolsHooks | undefined>)[DEVTOOLS]!;
}

function setup(): { state: ReturnType<typeof installDevtools>; shadow: ShadowRoot } {
  document.querySelector('brumate-devtools')?.remove();
  document.body.innerHTML = '';
  globalThis.fetch = (async () =>
    Response.json({
      name: 'Counter',
      file: 'src/Counter.brm',
      scopes: { 0: { label: 'component', slots: ['count'] } },
      text: '',
    })) as typeof fetch;
  const state = installDevtools('/inspect', '/_brumate', { version: '1.2.3', vite: '8.0.0' });
  const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
  const root: Scope = { id: 0, k: 0, m: 'Counter_1', s: [1], children: new Set() };
  hooks().attach!({ scopes: new Map([[0, root]]), set: () => {} });
  return { state, shadow };
}

function press(init: KeyboardEventInit): void {
  dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

const panel = (shadow: ShadowRoot): HTMLElement | null => shadow.querySelector('.panel');
const selected = (shadow: ShadowRoot): string =>
  shadow.querySelector<HTMLElement>('.ws [aria-selected="true"]')!.dataset.ws!;

describe('the dock shell', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(async () => {
    const shadow = document.querySelector('brumate-devtools')?.shadowRoot;
    if (shadow && panel(shadow)) {
      // The workspace draws after the dev server answers, and must not find the dock gone.
      await new Promise((resolve) => setTimeout(resolve, 20));
      press({ key: 'Escape' });
    }
  });

  it('opens and closes with Alt+Shift+D, Escape and the grip, and focus goes back to the grip', () => {
    const { state, shadow } = setup();
    const grip = shadow.querySelector<HTMLElement>('button.open')!;
    press({ code: 'KeyD', key: 'D', altKey: true, shiftKey: true });
    return expect
      .poll(() => panel(shadow))
      .not.toBeNull()
      .then(() => {
        press({ key: 'Escape' });
        expect(panel(shadow)).toBeNull();
        expect(shadow.activeElement).toBe(grip);
        grip.click();
        return expect.poll(() => panel(shadow)).not.toBeNull();
      })
      .then(() => {
        shadow.querySelector<HTMLElement>('.head [aria-label="Close (Esc)"]')!.click();
        expect(panel(shadow)).toBeNull();
        expect(shadow.activeElement).toBe(grip);
        openPanel(shadow, state, 'errors');
        expect(selected(shadow)).toBe('issues');
      });
  });

  it('shows only the grip while closed, and opens with the version, the nav and the tools', () => {
    const { state, shadow } = setup();
    expect(panel(shadow)).toBeNull();
    const grip = shadow.querySelector<HTMLElement>('button.open')!;
    expect(grip.hidden).toBe(false);
    togglePanel(shadow, state);
    expect(grip.hidden).toBe(true);
    expect(shadow.querySelector('.head .ver')!.textContent).toBe('1.2.3');
    expect(shadow.querySelector('.head .brand')!.textContent).toContain('brumate');
    const names: (string | null)[] = [];
    for (const button of shadow.querySelectorAll('.ws button')) {
      names.push(button.textContent);
    }
    expect(names).toEqual(['Inspect', 'Activity', 'Issues', 'Page']);
    for (const label of ['Search', 'Pick an element', 'Outline updates', 'Close (Esc)']) {
      expect(shadow.querySelector(`.head [aria-label="${label}"]`)).not.toBeNull();
    }
  });

  it('switches the four workspaces, keeps the last one and counts the issues', async () => {
    const { state, shadow } = setup();
    togglePanel(shadow, state);
    expect(selected(shadow)).toBe('inspect');
    const body = shadow.querySelector('.body')!;
    for (const id of ['activity', 'issues', 'page', 'inspect']) {
      shadow.querySelector<HTMLElement>(`.ws [data-ws="${id}"]`)!.click();
      expect(selected(shadow)).toBe(id);
    }
    // Workspaces wait for the dev server before they draw.
    await expect.poll(() => body.childElementCount).toBeGreaterThan(0);
    shadow.querySelector<HTMLElement>('.ws [data-ws="page"]')!.click();
    reportError(state, { message: 'Boom' }, 'browser');
    await expect
      .poll(() => shadow.querySelector('.ws [data-ws="issues"] .c')!.textContent)
      .toBe('1');
    // The next open starts on the workspace that was open.
    togglePanel(shadow, state);
    togglePanel(shadow, state);
    expect(selected(shadow)).toBe('page');
    // The arrow keys move along the nav.
    shadow
      .querySelector('.ws')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(selected(shadow)).toBe('inspect');
  });

  it('moves to the right edge, and keeps the side and the size', () => {
    const { state, shadow } = setup();
    togglePanel(shadow, state);
    expect(panel(shadow)!.classList.contains('bottom')).toBe(true);
    const side = shadow.querySelector<HTMLElement>('.head [aria-label="Dock to the right"]')!;
    side.click();
    expect(panel(shadow)!.classList.contains('right')).toBe(true);
    expect(side.getAttribute('aria-label')).toBe('Dock to the bottom');
    expect(localStorage.getItem('brumate:devtools:side')).toBe('right');
    // Dragging the edge sets the width.
    shadow.querySelector('.edge')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    dispatchEvent(
      Object.assign(new Event('pointermove'), { clientX: window.innerWidth - 400, clientY: 0 }),
    );
    dispatchEvent(new Event('pointerup'));
    expect(localStorage.getItem('brumate:devtools:width')).toBe('400');
    expect(document.documentElement.style.paddingRight).toBe('400px');
    togglePanel(shadow, state);
    expect(document.documentElement.style.paddingRight).toBe('');
    togglePanel(shadow, state);
    expect(panel(shadow)!.classList.contains('right')).toBe(true);
    expect(panel(shadow)!.style.getPropertyValue('--w')).toBe('400px');
  });

  it('searches components, issues and actions with Cmd+K', async () => {
    const { state, shadow } = setup();
    reportError(state, { message: 'Broken thing' }, 'browser');
    togglePanel(shadow, state);
    press({ key: 'k', metaKey: true });
    const input = shadow.querySelector<HTMLInputElement>('.pal input')!;
    const lines = (): string[] => {
      const texts: string[] = [];
      for (const line of shadow.querySelectorAll('.pal .it')) {
        texts.push(line.firstChild!.textContent!);
      }
      return texts;
    };
    await expect.poll(() => lines().includes('Counter')).toBe(true);
    expect(lines()).toContain('Broken thing');
    expect(lines()).toContain('Pick an element');
    // Escape closes the search, and not the dock.
    press({ key: 'Escape' });
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(shadow.querySelector('.pal')).toBeNull();
    expect(panel(shadow)).not.toBeNull();

    // A query narrows the list, and Enter opens the first line.
    press({ key: 'k', ctrlKey: true });
    const next = shadow.querySelector<HTMLInputElement>('.pal input')!;
    next.value = 'broken';
    next.dispatchEvent(new Event('input'));
    expect(lines()).toEqual(['Broken thing']);
    next.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(shadow.querySelector('.pal')).toBeNull();
    expect(selected(shadow)).toBe('issues');

    press({ key: 'k', metaKey: true });
    const again = shadow.querySelector<HTMLInputElement>('.pal input')!;
    again.value = 'counter';
    again.dispatchEvent(new Event('input'));
    again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(selected(shadow)).toBe('inspect');
  });

  it('slides out when closed and slides back in when reopened mid-way', () => {
    const { state, shadow } = setup();
    const grip = shadow.querySelector<HTMLElement>('button.open')!;
    const style = globalThis.getComputedStyle;
    // happy-dom plays no transitions, so the test says there is one.
    globalThis.getComputedStyle = (() => ({
      transitionDuration: '0.26s',
    })) as unknown as typeof getComputedStyle;
    try {
      togglePanel(shadow, state);
      const dock = panel(shadow)!;
      togglePanel(shadow, state);
      expect(dock.classList.contains('closed')).toBe(true);
      expect(dock.isConnected).toBe(true);
      expect(grip.hidden).toBe(false);
      // Reopening mid-way cancels the removal.
      togglePanel(shadow, state);
      expect(dock.classList.contains('closed')).toBe(false);
      expect(grip.hidden).toBe(true);
      dock.dispatchEvent(Object.assign(new Event('transitionend'), { propertyName: 'transform' }));
      expect(dock.isConnected).toBe(true);
      // Closing again, the end of the slide removes the dock.
      togglePanel(shadow, state);
      dock.dispatchEvent(Object.assign(new Event('transitionend'), { propertyName: 'transform' }));
      expect(dock.isConnected).toBe(false);
    } finally {
      globalThis.getComputedStyle = style;
    }
  });

  it('takes Cmd+K always, and Ctrl+K only outside the fields of the page', () => {
    const { state, shadow } = setup();
    togglePanel(shadow, state);
    const field = document.createElement('input');
    document.body.append(field);
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, composed: true }),
    );
    expect(shadow.querySelector('.pal')).toBeNull();
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, composed: true }),
    );
    expect(shadow.querySelector('.pal')).not.toBeNull();
    // Tab stays in the search.
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    shadow.querySelector('.pal input')!.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    shadow
      .querySelector('.pal input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  it('resizes the edge with the arrow keys, and closing mid-drag leaves no listeners', () => {
    const { state, shadow } = setup();
    togglePanel(shadow, state);
    const edge = shadow.querySelector<HTMLElement>('.edge')!;
    expect(edge.getAttribute('role')).toBe('separator');
    expect(edge.tabIndex).toBe(0);
    const before = Number(edge.getAttribute('aria-valuenow'));
    edge.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(edge.getAttribute('aria-valuenow')).toBe(String(before + 16));
    expect(localStorage.getItem('brumate:devtools:height')).toBe(String(before + 16));
    edge.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }),
    );
    expect(edge.getAttribute('aria-valuenow')).toBe(String(before - 48));
    // A drag that is under way when the dock closes.
    edge.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    press({ key: 'Escape' });
    const kept = localStorage.getItem('brumate:devtools:height');
    dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 0, clientY: 10 }));
    dispatchEvent(new Event('pointerup'));
    expect(localStorage.getItem('brumate:devtools:height')).toBe(kept);
  });

  it('ends Pick that was armed while the dock slid out', () => {
    const { state, shadow } = setup();
    const style = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (() => ({
      transitionDuration: '0.26s',
    })) as unknown as typeof getComputedStyle;
    try {
      togglePanel(shadow, state);
      const dock = panel(shadow)!;
      const pick = shadow.querySelector<HTMLElement>('.head [aria-label="Pick an element"]')!;
      togglePanel(shadow, state);
      pick.click();
      expect(document.documentElement.style.cursor).toBe('crosshair');
      dock.dispatchEvent(Object.assign(new Event('transitionend'), { propertyName: 'transform' }));
      expect(dock.isConnected).toBe(false);
      expect(document.documentElement.style.cursor).toBe('');
      // The click is no longer taken by Pick.
      const target = document.createElement('button');
      document.body.append(target);
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      target.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(false);
    } finally {
      globalThis.getComputedStyle = style;
    }
  });

  it('limits each group of the search', () => {
    const items: SearchItem[] = [];
    for (let index = 0; index < 20; index++) {
      items.push({ group: 'Components', label: `C${index}`, hint: '', run() {} });
    }
    items.push({ group: 'Actions', label: 'Pick an element', hint: '', run() {} });
    expect(filterItems(items, '')).toHaveLength(7);
    const labels: string[] = [];
    for (const item of filterItems(items, 'pick')) {
      labels.push(item.label);
    }
    expect(labels).toEqual(['Pick an element']);
  });
});
