// The search of the dock (Cmd+K): components, issues and actions in one list.

import type { Scope } from '../client.ts';
import { element, svg } from './dom.ts';
import { collectModules, known, loadComponents, roots } from './info.ts';
import type { DockContext } from './workspace.ts';

/** One line of the list. */
export interface SearchItem {
  group: string;
  label: string;
  hint: string;
  run(): void;
}

/** The most lines of one group. */
const PER_GROUP = 6;

export interface Search {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

/** The ID of the first instance of a component. */
function firstScope(list: Scope[], id: string): Scope['id'] | undefined {
  for (const scope of list) {
    if (scope.m === id) {
      return scope.id;
    }
  }
  return undefined;
}

/** The lines for components and issues. The entry adds the actions. */
export function collectItems(ctx: DockContext): SearchItem[] {
  const { state, shell } = ctx;
  const items: SearchItem[] = [];
  const list = roots(state);
  for (const id of collectModules(list)) {
    const info = known.get(id);
    items.push({
      group: 'Components',
      label: info?.name ?? id,
      hint: info?.file ?? '',
      run() {
        shell.selected = id;
        shell.selectedScope = firstScope(list, id);
        shell.graphNode = undefined;
        ctx.select('inspect');
      },
    });
  }
  for (const entry of state.errors.toReversed()) {
    items.push({
      group: 'Issues',
      label: entry.message.split('\n')[0]!,
      hint: entry.source,
      run() {
        shell.selectedError = entry;
        shell.selectedFrame = -1;
        ctx.select('issues');
      },
    });
  }
  return items;
}

/** Filters the lines by the query, at most a few of each group. */
export function filterItems(items: SearchItem[], query: string): SearchItem[] {
  const text = query.trim().toLowerCase();
  const counts = new Map<string, number>();
  const found: SearchItem[] = [];
  for (const item of items) {
    if (
      text &&
      !item.label.toLowerCase().includes(text) &&
      !item.hint.toLowerCase().includes(text)
    ) {
      continue;
    }
    const count = counts.get(item.group) ?? 0;
    if (count < PER_GROUP) {
      counts.set(item.group, count + 1);
      found.push(item);
    }
  }
  return found;
}

/** The search of a dock. `actions` gives the lines for what the dock can do. */
export function createSearch(ctx: DockContext, actions: () => SearchItem[]): Search {
  const { root } = ctx;
  let scrim: HTMLElement | undefined;
  let before: Element | null = null;

  function open(): void {
    if (scrim) {
      return;
    }
    before = root.activeElement;
    const magnifier = svg('svg', {
      viewBox: '0 0 24 24',
      width: 16,
      height: 16,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'aria-hidden': 'true',
    });
    magnifier.innerHTML = '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>';
    const input = element('input', {
      type: 'text',
      role: 'combobox',
      'aria-expanded': 'true',
      'aria-controls': 'dock-search-list',
      'aria-label': 'Search the dock',
      placeholder: 'Components, issues, actions',
      autocomplete: 'off',
      spellcheck: 'false',
    });
    const results = element('div', { class: 'res', role: 'listbox', id: 'dock-search-list' });
    const pal = element(
      'div',
      { class: 'pal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Search the dock' },
      element('div', { class: 'in' }, magnifier, input, element('kbd', {}, 'esc')),
      results,
      element(
        'div',
        { class: 'end' },
        element('span', {}, element('kbd', {}, '↑'), element('kbd', {}, '↓'), ' move'),
        element('span', {}, element('kbd', {}, '↵'), ' open'),
        element('span', { class: 'grow' }),
        element('span', {}, `brumate ${ctx.state.meta.version ?? ''}`.trim()),
      ),
    );
    const layer = element('div', { class: 'scrim' }, pal);
    scrim = layer;

    let items = [...collectItems(ctx), ...actions()];
    let found: SearchItem[] = [];
    let hit = 0;

    function draw(): void {
      found = filterItems(items, input.value);
      hit = Math.max(0, Math.min(hit, found.length - 1));
      results.replaceChildren();
      if (found.length === 0) {
        results.append(element('div', { class: 'none' }, 'No match.'));
        input.removeAttribute('aria-activedescendant');
        return;
      }
      let group = '';
      for (const [index, item] of found.entries()) {
        if (item.group !== group) {
          group = item.group;
          results.append(element('div', { class: 'grp' }, group));
        }
        const line = element(
          'div',
          {
            class: 'it',
            role: 'option',
            id: `dock-search-${index}`,
            'aria-selected': String(index === hit),
          },
          element('span', {}, item.label),
          element('span', { class: 'h' }, item.hint),
        );
        line.addEventListener('click', () => choose(index));
        line.addEventListener('pointermove', () => {
          if (hit !== index) {
            hit = index;
            draw();
          }
        });
        results.append(line);
      }
      input.setAttribute('aria-activedescendant', `dock-search-${hit}`);
      results.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
    }
    function choose(index: number): void {
      const item = found[index];
      close(false);
      item?.run();
    }
    input.addEventListener('input', () => {
      hit = 0;
      draw();
    });
    input.addEventListener('keydown', (event) => {
      // The dock handles Escape too, and must not close with the search.
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        hit = Math.max(0, Math.min(hit + (event.key === 'ArrowDown' ? 1 : -1), found.length - 1));
        draw();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        choose(hit);
      }
    });
    // The search holds the focus: Tab stays in the field, as in a modal dialog.
    layer.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        input.focus();
      }
    });
    layer.addEventListener('pointerdown', (event) => {
      if (event.target === layer) {
        close(true);
      }
    });
    root.append(layer);
    draw();
    input.focus();
    // The names of components come from the dev server. The lines show again when they arrive.
    void loadComponents(ctx.state, collectModules(roots(ctx.state))).then(() => {
      if (scrim === layer) {
        items = [...collectItems(ctx), ...actions()];
        draw();
      }
    });
  }

  /** Closes the search. Focus goes back to where it was, unless a line moved it on. */
  function close(restore = true): void {
    scrim?.remove();
    scrim = undefined;
    if (restore && before instanceof HTMLElement && before.isConnected) {
      before.focus();
    }
    before = null;
  }

  return { open, close: () => close(true), isOpen: () => scrim !== undefined };
}
