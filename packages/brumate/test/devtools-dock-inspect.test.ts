// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import type { DevtoolsHooks, Scope } from '../src/runtime/client.ts';
import { installDevtools } from '../src/runtime/devtools.ts';
import { togglePanel } from '../src/runtime/devtools-panel.ts';
import { findCurrent } from '../src/runtime/devtools-panel/inspect.ts';
import { createShell } from '../src/runtime/devtools-panel/workspace.ts';
import type { DockContext } from '../src/runtime/devtools-panel/workspace.ts';

const DEVTOOLS = Symbol.for('brumate.devtools');

let opened: { shadow: ShadowRoot; state: ReturnType<typeof installDevtools> } | undefined;

afterEach(() => {
  if (opened?.shadow.querySelector('.panel')) {
    togglePanel(opened.shadow, opened.state);
  }
});

function hooks(): DevtoolsHooks {
  return (globalThis as Record<symbol, DevtoolsHooks | undefined>)[DEVTOOLS]!;
}

interface Page {
  state: ReturnType<typeof installDevtools>;
  shadow: ShadowRoot;
  root: Scope;
  item: Scope;
  other: Scope;
  writes: [number, unknown][];
}

/** A page with a Cart (a root and a `#for` body) and a Note, with the dev server answering for both. */
function open(): Page {
  document.body.innerHTML = '';
  document.querySelector('brumate-devtools')?.remove();
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).includes('Note')
      ? Response.json({
          name: 'Note',
          file: 'src/Note.brm',
          scopes: { 0: { label: 'component', slots: ['text'] } },
          text: '',
        })
      : Response.json({
          name: 'Cart',
          file: 'src/Cart.brm',
          path: '/app/src/Cart.brm',
          scopes: {
            0: { label: 'component', slots: ['items', 'count'], readers: [['for 3:1'], ['text']] },
            1: { label: 'body of #for', slots: ['item'] },
          },
          graph: {
            nodes: [
              { kind: 'signal', label: 'count', scope: 0, slot: 1 },
              { kind: 'binding', label: 'insert', scope: 0 },
            ],
            edges: [[0, 1]],
          },
          text: '',
        })) as typeof fetch;
  const state = installDevtools('/inspect');
  const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
  const root: Scope = { id: 0, k: 0, m: 'Cart_1', s: [['a'], 3], children: new Set() };
  const item: Scope = { id: 1, k: 1, p: root, s: ['a'], children: new Set() };
  root.children!.add(item);
  const other: Scope = { id: 2, k: 0, m: 'Note_1', s: ['hi'], children: new Set() };
  const writes: [number, unknown][] = [];
  hooks().attach!({
    scopes: new Map([
      [0, root],
      [1, item],
      [2, other],
    ]),
    set: (scope, slot, value) => {
      writes.push([slot, value]);
      scope.s[slot] = value;
    },
  });
  togglePanel(shadow, state);
  opened = { shadow, state };
  (shadow.querySelector('[data-tab="scopes"]') as HTMLElement).click();
  return { state, shadow, root, item, other, writes };
}

function rows(shadow: ShadowRoot): HTMLElement[] {
  return [...shadow.querySelectorAll<HTMLElement>('.tree-row')];
}

function current(shadow: ShadowRoot): string {
  return (
    shadow.querySelector(
      '.tree-row[aria-current="true"] .name, .tree-row[aria-current="true"] .blk',
    )?.textContent ?? ''
  );
}

function setup(): { ctx: Pick<DockContext, 'state' | 'shell'>; list: Scope[] } {
  const cart: Scope = { id: 0, k: 0, m: 'Cart_1', s: [], children: new Set() };
  const cart2: Scope = { id: 3, k: 0, m: 'Cart_1', s: [], children: new Set() };
  const note: Scope = { id: 2, k: 0, m: 'Note_1', s: [], children: new Set() };
  const list = [cart, cart2, note];
  const scopes = new Map<number, Scope>();
  for (const scope of list) {
    scopes.set(scope.id as number, scope);
  }
  const state = { scopes } as unknown as DockContext['state'];
  return { ctx: { state, shell: createShell('scopes') }, list };
}

describe('which scope Inspect shows', () => {
  it('starts at the first component', () => {
    const { ctx, list } = setup();
    expect(findCurrent(ctx, list)).toBe(list[0]);
  });

  it('follows a scope that the call detail sets alone', () => {
    const { ctx, list } = setup();
    ctx.shell.selected = 'Cart_1';
    ctx.shell.selectedScope = 0;
    findCurrent(ctx, list);
    ctx.shell.selectedScope = 2;
    expect(findCurrent(ctx, list)).toBe(list[2]);
    // It stays after the next draw.
    expect(findCurrent(ctx, list)).toBe(list[2]);
  });

  it('follows a module that Issues or the module select sets alone', () => {
    const { ctx, list } = setup();
    ctx.shell.selectedScope = 0;
    findCurrent(ctx, list);
    ctx.shell.selected = 'Note_1';
    expect(findCurrent(ctx, list)).toBe(list[2]);
    expect(findCurrent(ctx, list)).toBe(list[2]);
  });

  it('follows the scope when Page sets the module and the scope together', () => {
    const { ctx, list } = setup();
    findCurrent(ctx, list);
    ctx.shell.selected = 'Cart_1';
    ctx.shell.selectedScope = 3;
    expect(findCurrent(ctx, list)).toBe(list[1]);
  });
});

describe('dock inspect', () => {
  it('lists the components with their scopes, and selects one by a click', async () => {
    const { shadow } = open();
    await expect.poll(() => rows(shadow).length).toBe(3);
    expect(rows(shadow).map((row) => row.querySelector('.meta')!.textContent)).toEqual([
      '2 scopes',
      '#1',
      '1 scope',
    ]);
    expect(current(shadow)).toBe('Cart');
    rows(shadow)[2]!.click();
    await expect.poll(() => current(shadow)).toBe('Note');
    expect(shadow.querySelector('.title h3')!.textContent).toContain('Note');
  });

  it('marks the selected row with a fill and a ring, and no coloured left edge', async () => {
    const { shadow } = open();
    await expect.poll(() => rows(shadow).length).toBe(3);
    const style = shadow.querySelector('style[data-inspect]')!.textContent!;
    expect(style).toContain(
      '.tree-row[aria-current="true"] { background: var(--sel); box-shadow: inset 0 0 0 1px var(--ring); }',
    );
    expect(style).not.toMatch(/border-left|inset 3px/);
    expect(shadow.querySelectorAll('style[data-inspect]').length).toBe(1);
  });

  it('shows the values with their readers', async () => {
    const { shadow } = open();
    await expect.poll(() => shadow.querySelectorAll('.slot').length).toBe(2);
    const slots = [...shadow.querySelectorAll('.slot')].map((slot) => slot.textContent);
    expect(slots).toEqual(['itemsarray', 'countnumber']);
    const texts = [...shadow.querySelectorAll<HTMLInputElement>('.slot input')].map(
      (input) => input.value,
    );
    expect(texts).toEqual(['["a"]', '3']);
    const readers = [...shadow.querySelectorAll('.vals > .rd')].map((cell) => cell.textContent);
    expect(readers).toEqual(['for 3:1', 'text']);
  });

  it('commits an edited value on change, and keeps no state when the focus leaves', async () => {
    const { shadow, writes, state } = open();
    await expect.poll(() => shadow.querySelectorAll('.slot input').length).toBe(2);
    const input = (): HTMLInputElement =>
      shadow.querySelectorAll<HTMLInputElement>('.slot input')[1]!;
    input().focus();
    input().value = '41';
    // While the text is not committed, a redraw leaves the input alone.
    state.changed?.();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(input().value).toBe('41');
    input().dispatchEvent(new Event('change'));
    expect(writes).toEqual([[1, 41]]);
    await expect.poll(() => input().value).toBe('41');
    // The focus stays on the value after the commit.
    expect(shadow.activeElement).toBe(input());
    // Text that is not JSON is a string.
    input().value = 'hi';
    input().dispatchEvent(new Event('change'));
    expect(writes.at(-1)).toEqual([1, 'hi']);
    // Leaving the field commits through change, and later draws are not blocked.
    input().value = '7';
    rows(shadow)[2]!.focus();
    input().dispatchEvent(new Event('change'));
    expect(writes.at(-1)).toEqual([1, 7]);
    await expect.poll(() => (shadow.activeElement as HTMLElement).dataset.focus).toBe('row-2');
    state.changed?.();
    rows(shadow)[2]!.click();
    await expect.poll(() => current(shadow)).toBe('Note');
  });

  it('writes a value once when Enter and the native change both fire', async () => {
    const { shadow, writes } = open();
    await expect.poll(() => shadow.querySelectorAll('.slot input').length).toBe(2);
    const input = shadow.querySelectorAll<HTMLInputElement>('.slot input')[1]!;
    input.focus();
    input.value = '5';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    input.dispatchEvent(new Event('change'));
    expect(writes).toEqual([[1, 5]]);
  });

  it('cancels an edit with Escape', async () => {
    const { shadow, writes } = open();
    await expect.poll(() => shadow.querySelectorAll('.slot input').length).toBe(2);
    const input = shadow.querySelectorAll<HTMLInputElement>('.slot input')[1]!;
    input.value = '99';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(input.value).toBe('3');
    expect(writes).toEqual([]);
  });

  it('keeps the focus on the selected row through a redraw, and moves it with the arrow keys', async () => {
    const { shadow, state } = open();
    await expect.poll(() => rows(shadow).length).toBe(3);
    rows(shadow)[1]!.focus();
    rows(shadow)[1]!.click();
    await expect.poll(() => current(shadow)).toBe('body of #for');
    expect((shadow.activeElement as HTMLElement).getAttribute('aria-current')).toBe('true');
    // A change of the page draws the dock again.
    state.changed?.();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect((shadow.activeElement as HTMLElement).getAttribute('aria-current')).toBe('true');
    // Down goes to the next row, and up comes back.
    shadow.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    await expect.poll(() => current(shadow)).toBe('Note');
    expect((shadow.activeElement as HTMLElement).getAttribute('aria-current')).toBe('true');
    shadow.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    await expect.poll(() => current(shadow)).toBe('body of #for');
  });

  it('leaves the arrow keys of the filter to the field, and folds rows with Left and Right', async () => {
    const { shadow } = open();
    await expect.poll(() => rows(shadow).length).toBe(3);
    const search = shadow.querySelector('input[type="search"]') as HTMLInputElement;
    search.focus();
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      search.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(rows(shadow).length).toBe(3);
    expect(current(shadow)).toBe('Cart');
    // Left folds the focused row, Right opens it again.
    rows(shadow)[0]!.focus();
    rows(shadow)[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    await expect.poll(() => rows(shadow).length).toBe(2);
    rows(shadow)[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    await expect.poll(() => rows(shadow).length).toBe(3);
  });

  it('moves from the focused row, not the selected one', async () => {
    const { shadow } = open();
    await expect.poll(() => rows(shadow).length).toBe(3);
    // Cart is selected; the focus is on Note.
    rows(shadow)[2]!.focus();
    rows(shadow)[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await expect.poll(() => current(shadow)).toBe('body of #for');
  });

  it('keeps the text and the caret of the filter while it redraws', async () => {
    const { shadow } = open();
    await expect.poll(() => rows(shadow).length).toBe(3);
    const search = shadow.querySelector('input[type="search"]') as HTMLInputElement;
    search.focus();
    search.value = 'note';
    search.dispatchEvent(new Event('input'));
    await expect.poll(() => rows(shadow).length).toBe(1);
    expect(shadow.activeElement).toBe(shadow.querySelector('input[type="search"]'));
    expect((shadow.activeElement as HTMLInputElement).value).toBe('note');
  });

  it('folds the children of a component', async () => {
    const { shadow } = open();
    await expect.poll(() => rows(shadow).length).toBe(3);
    (rows(shadow)[0]!.querySelector('.tw') as HTMLElement).click();
    await expect.poll(() => rows(shadow).length).toBe(2);
    expect(shadow.querySelector('.tw.shut')).not.toBeNull();
    (rows(shadow)[0]!.querySelector('.tw') as HTMLElement).click();
    await expect.poll(() => rows(shadow).length).toBe(3);
  });

  it('switches between Values and Graph, and draws the graph through the context', async () => {
    const { shadow } = open();
    await expect.poll(() => shadow.querySelectorAll('.slot').length).toBe(2);
    const switches = [...shadow.querySelectorAll<HTMLElement>('.seg button')];
    expect(switches.map((button) => button.textContent)).toEqual(['Values', 'Graph']);
    expect(switches[0]!.getAttribute('aria-pressed')).toBe('true');
    switches[1]!.click();
    await expect.poll(() => shadow.querySelector('.ins .graph svg')).not.toBeNull();
    expect(shadow.querySelector('.slot')).toBeNull();
    expect((shadow.activeElement as HTMLElement).textContent).toBe('Graph');
    (shadow.querySelectorAll('.seg button')[0] as HTMLElement).click();
    await expect.poll(() => shadow.querySelectorAll('.slot').length).toBe(2);
  });

  it('outlines the elements of a scope while its row is hovered', async () => {
    const { shadow } = open();
    document.body.innerHTML = '<p class="n" b-b="2:0">hi</p>';
    await expect.poll(() => rows(shadow).length).toBe(3);
    rows(shadow)[2]!.dispatchEvent(new MouseEvent('mouseenter'));
    expect(shadow.querySelectorAll('.outline').length).toBe(1);
    rows(shadow)[2]!.dispatchEvent(new MouseEvent('mouseleave'));
    expect(shadow.querySelectorAll('.outline').length).toBe(0);
  });

  it('selects the row of a picked element', async () => {
    const { shadow } = open();
    document.body.innerHTML = '<p class="n" b-b="2:0">hi</p>';
    await expect.poll(() => rows(shadow).length).toBe(3);
    const pick = [...shadow.querySelectorAll('button')].find(
      (button) => button.textContent === 'Pick',
    )!;
    pick.click();
    document.querySelector('.n')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect.poll(() => current(shadow)).toBe('Note');
  });
});
