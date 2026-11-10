// The Inspect workspace: the components of the page as a tree, and the detail of the selected one
// with a Values | Graph switch.

import type { Scope } from '../client.ts';
import { findRootScope, preview } from '../devtools.ts';
import type { ScopeId } from '../shared.ts';
import { element, icon } from './dom.ts';
import { readType } from './format.ts';
import { known, loadComponents, roots, source } from './info.ts';
import type { ComponentInfo } from './info.ts';
import { drawTabOf } from './workspace.ts';
import type { DockContext, Workspace } from './workspace.ts';

/** What Inspect remembers, in `shell.work.inspect`. */
interface InspectWork {
  /** The view of the detail. */
  mode: 'values' | 'graph';
  /** The scopes whose children the tree hides. */
  closed: Set<ScopeId>;
  /** The control that takes the focus after the next draw. */
  focus: string | undefined;
  /** The scope and the module that the last draw showed, to tell which of the two the shell changed. */
  seenScope: ScopeId | undefined;
  seenModule: string | undefined;
}

const INSPECT_STYLE = `
.ins { --bg2: #161517; --line2: #36333a; --sel: #ee7a3e14; --ring: #ee7a3e47; --accent-text: #ffb48a; }
.ins > .list { padding: 8px; gap: 1px; }
.ins .filter { display: block; margin: 0 0 6px; }
.ins .filter input { width: 100%; box-sizing: border-box; height: 30px; padding: 0 10px; border-radius: 7px; background: var(--bg2); border: 0; box-shadow: inset 0 0 0 1px var(--line); outline: none; }
.ins .filter input:focus-visible { box-shadow: inset 0 0 0 1px var(--ring); outline: none; }
.ins .tree-row { box-sizing: border-box; display: flex; align-items: center; justify-content: flex-start; gap: 7px; width: 100%; height: 28px; margin: 0; padding: 0 8px; border: 0; border-radius: 7px; text-align: left; white-space: nowrap; font-weight: 400; transition: background 0.12s; }
.ins .tree-row:hover { background: var(--hover); }
.ins .tree-row:focus-visible { outline: none; box-shadow: inset 0 0 0 1px var(--ring); }
.ins .tree-row[aria-current="true"] { background: var(--sel); box-shadow: inset 0 0 0 1px var(--ring); }
.ins .tree-row[aria-current="true"] .name { color: var(--accent-text); }
.ins .tree-row .ind { flex: none; align-self: stretch; background: linear-gradient(90deg, transparent 5px, var(--line) 5px, var(--line) 6px, transparent 6px) 0 0 / 14px 100% repeat-x; }
.ins .tree-row .tw { flex: none; width: 12px; height: 12px; display: grid; place-items: center; color: var(--faint); border-radius: 3px; }
.ins .tree-row .tw svg { transition: transform 0.12s; }
.ins .tree-row .tw.shut svg { transform: rotate(-90deg); }
.ins .tree-row .tw:hover { color: var(--text); }
.ins .tree-row .name { font-weight: 500; }
.ins .tree-row .blk { font: 11.5px var(--mono); color: var(--purple); }
.ins .tree-row .meta { margin-left: auto; font: 10.5px var(--mono); color: var(--faint); }
.ins .heat { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--yellow); opacity: 0; }
.ins .heat.on { animation: ins-heat 1.1s ease-out; }
@keyframes ins-heat { 0% { opacity: 1; transform: scale(1.7); } 100% { opacity: 0; } }
.ins > .detail.gmode { display: flex; flex-direction: column; padding-bottom: 0; }
.ins .title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ins .title h3 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.015em; }
.ins .title h3 .sub { font-size: 12px; font-weight: 400; color: var(--faint); }
.ins .path { font: 11.5px var(--mono); color: var(--dim); }
.ins .path:hover { color: var(--blue); }
.ins .seg { display: inline-flex; gap: 2px; padding: 2px; margin-left: auto; border-radius: 8px; background: var(--bg2); box-shadow: inset 0 0 0 1px var(--line); }
.ins .seg button { height: 24px; padding: 0 10px; border: 0; border-radius: 6px; color: var(--dim); font-size: 11.5px; font-weight: 500; transition: background 0.12s, color 0.12s; }
.ins .seg button:hover { color: var(--text); }
.ins .seg button[aria-pressed="true"] { background: var(--hover); color: var(--text); box-shadow: inset 0 0 0 1px var(--line2); }
.ins .seg button:focus-visible { outline: none; box-shadow: inset 0 0 0 1px var(--ring); }
.ins .tags { display: flex; gap: 6px; margin: 10px 0 0; flex-wrap: wrap; }
.ins .tag { font: 11px/20px var(--mono); padding: 0 7px; border-radius: 6px; background: var(--hover); color: var(--dim); }
.ins .tag.y { color: var(--yellow); background: #ffd16618; }
.ins .sec { font-size: 11px; font-weight: 600; color: var(--faint); margin: 22px 0 8px; display: flex; align-items: baseline; gap: 8px; }
.ins .sec .n { font: 10.5px var(--mono); font-weight: 400; }
.ins .vals { display: grid; grid-template-columns: max-content max-content minmax(0, 1fr) max-content; column-gap: 16px; align-items: center; }
.ins .slot { display: contents; }
.ins .vals > *, .ins .slot > * { padding: 5px 0; border-top: 1px solid var(--line); min-width: 0; }
.ins .vals > :first-child > *, .ins .vals > .rd:nth-child(2) { border-top: 0; }
.ins .slot .k { font: 11.5px var(--mono); color: #ffc28f; }
.ins .slot .ty { font: 11px var(--mono); color: var(--faint); }
.ins .slot .rd { font: 11px var(--mono); color: var(--faint); text-align: right; }
.ins .slot .value { color: var(--text); display: block; width: 100%; box-sizing: border-box; margin-left: -6px; padding: 3px 6px; border: 0; border-radius: 5px; text-align: left; font: 11.5px var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: text; transition: background 0.12s, box-shadow 0.12s; }
.ins .slot .value:hover { background: var(--bg2); }
.ins .slot .value:focus-visible { background: var(--bg2); outline: none; box-shadow: inset 0 0 0 1px var(--ring); }
.ins .slot .value.fixed { cursor: default; }
.ins .slot .value.fixed:hover { background: none; }
.ins .slot .value.fixed { color: var(--dim); }
.ins .slot .value.str { color: var(--green); }
.ins .slot .value.num { color: var(--blue); }
.ins .slot .value.bool { color: var(--purple); }
.ins .slot input.value { background: transparent; outline: none; }
.ins .slot input.value:focus { background: var(--bg2); box-shadow: inset 0 0 0 1px var(--ring); }
.ins .graph { flex: 1; min-height: 240px; margin: 14px -14px 0; border-top: 1px solid var(--line); display: flex; flex-direction: column; position: relative; overflow: hidden; }
.ins .graph > * { flex: 1; min-height: 0; }
`;

/** A value that can be edited as text: what JSON can hold. */
function editable(value: unknown): boolean {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return true;
  }
  if (typeof value !== 'object' || value instanceof Element) {
    return false;
  }
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

/** Reads what a person typed: JSON, or else the text as a string. */
function parseValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function findWork(ctx: Pick<DockContext, 'shell'>): InspectWork {
  const { work } = ctx.shell;
  let mine = work.inspect as InspectWork | undefined;
  if (!mine) {
    mine = {
      mode: 'values',
      closed: new Set(),
      focus: undefined,
      seenScope: undefined,
      seenModule: undefined,
    };
    work.inspect = mine;
  }
  return mine;
}

/** A slot as a row of the values: name, type, value and what reads it. The reads sit outside the slot. */
function drawSlot(
  ctx: DockContext,
  scope: Scope,
  slot: number,
  name: string,
  readers: string[],
): HTMLElement[] {
  const { state } = ctx;
  const work = findWork(ctx);
  const value = scope.s[slot];
  const cell = element('div', { class: 'v' });
  const line = element(
    'div',
    { class: 'slot' },
    element('div', { class: 'k' }, name),
    element('div', { class: 'ty' }, readType(value)),
    cell,
  );
  const reads = element('div', { class: 'rd' }, readers.join(', '));
  const canEdit = editable(value) && state.set !== undefined;
  const kinds: Record<string, string> = { string: 'str', number: 'num', boolean: 'bool' };
  const classes = ['value'];
  if ((typeof value) in kinds) {
    classes.push(kinds[typeof value]!);
  }
  if (!canEdit) {
    cell.append(element('span', { class: `${classes.join(' ')} fixed` }, preview(value)));
    return [line, reads];
  }
  // The input is always there and commits on change, which also fires when the focus leaves.
  const input = element('input', {
    class: classes.join(' '),
    'aria-label': `Value of ${name}`,
    title: 'Enter JSON, or text for a string.',
    spellcheck: 'false',
    'data-focus': `value-${slot}`,
  });
  input.value = JSON.stringify(value) ?? '';
  // The draw waits while the text differs from this, so a person can type.
  input.defaultValue = input.value;
  // Writes the text once: a second call with the same text does nothing.
  function commit(): void {
    if (input.value === input.defaultValue) {
      return;
    }
    input.defaultValue = input.value;
    state.set?.(scope, slot, parseValue(input.value));
    ctx.draw();
  }
  // Change also fires when the focus leaves, so the draw keeps the focus where it went.
  input.addEventListener('change', commit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      work.focus = `value-${slot}`;
      commit();
      work.focus = undefined;
    } else if (event.key === 'Escape') {
      input.value = input.defaultValue;
    }
  });
  cell.append(input);
  return [line, reads];
}

/**
 * The scope to show. Whichever of `shell.selectedScope` (Pick, the call detail) and `shell.selected`
 * (Page, a component chosen by its module) changed since the last draw wins, the scope first.
 */
export function findCurrent(ctx: Pick<DockContext, 'state' | 'shell'>, list: Scope[]): Scope {
  const { state, shell } = ctx;
  const work = findWork(ctx);
  const named =
    shell.selectedScope === undefined ? undefined : state.scopes?.get(shell.selectedScope);
  let current = named;
  if (shell.selectedScope === work.seenScope && shell.selected !== work.seenModule) {
    for (const scope of list) {
      if (scope.m === shell.selected) {
        current = scope;
        break;
      }
    }
  }
  current ??= list[0]!;
  shell.selectedScope = current.id;
  work.seenScope = current.id;
  work.seenModule = findRootScope(current).m;
  shell.selected = work.seenModule;
  return current;
}

/** The scopes of a component instance, itself included, without the components inside it. */
function countOwn(scope: Scope): number {
  let count = 1;
  for (const child of scope.children ?? []) {
    if (child.m === undefined) {
      count += countOwn(child);
    }
  }
  return count;
}

function hasOwnChildren(scope: Scope): boolean {
  for (const child of scope.children ?? []) {
    if (child.m === undefined) {
      return true;
    }
  }
  return false;
}

/** The name of the control that has the focus inside the body, and the caret of a text field. */
function findFocus(
  ctx: DockContext,
  into: HTMLElement,
): { key: string; from: number | null; to: number | null } | undefined {
  const active = ctx.root.activeElement as HTMLElement | null;
  const key = active && into.contains(active) ? active.dataset.focus : undefined;
  if (key === undefined) {
    return undefined;
  }
  const field = active as HTMLInputElement;
  return { key, from: field.selectionStart ?? null, to: field.selectionEnd ?? null };
}

async function drawInspect(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state, shell } = ctx;
  const work = findWork(ctx);
  const list = roots(state);
  const listed: string[] = [];
  for (const scope of list) {
    listed.push(scope.m!);
  }
  const infos = await loadComponents(state, listed);
  if (!ctx.root.querySelector('style[data-inspect]')) {
    ctx.root.append(element('style', { 'data-inspect': '' }, INSPECT_STYLE));
  }
  if (list.length === 0) {
    into.replaceChildren(
      element('div', { class: 'empty' }, 'No scopes yet. The first event loads them.'),
    );
    return;
  }
  const current = findCurrent(ctx, list);
  const component = findRootScope(current);

  // The ancestors of the current scope stay open, so the selected row shows.
  const trail = new Set<ScopeId>();
  for (let scope = current.p; scope; scope = scope.p) {
    trail.add(scope.id);
  }

  const search = element('input', {
    type: 'search',
    placeholder: 'Filter components and values',
    'aria-label': 'Filter components',
    'data-focus': 'filter',
  });
  search.value = shell.filter;
  search.addEventListener('input', () => {
    shell.filter = search.value;
    void drawInspect(ctx, into);
  });
  const {
    box,
    first: tree,
    second: detail,
  } = ctx.split({
    key: 'scopes',
    min: [200, 300],
    start: 280,
  });
  box.classList.add('ins');
  tree.append(element('label', { class: 'filter' }, search));

  const rows: [HTMLElement, Scope][] = [];
  function select(scope: Scope, focus?: boolean): void {
    shell.selectedScope = scope.id;
    shell.selected = findRootScope(scope).m;
    if (focus) {
      work.focus = `row-${scope.id}`;
    }
    ctx.draw();
  }
  function visit(scope: Scope, info: ComponentInfo | undefined, depth: number): void {
    const isComponent = scope.m !== undefined;
    const label = isComponent
      ? (info?.name ?? scope.m!)
      : `${info?.scopes[scope.k]?.label ?? 'scope'}${scope.h ? ' · hidden' : ''}`;
    const nested = hasOwnChildren(scope);
    const shut = work.closed.has(scope.id) && !trail.has(scope.id);
    const chevron = element('span', { class: shut ? 'tw shut' : 'tw' });
    if (nested) {
      chevron.append(icon('close', 12));
      chevron.addEventListener('click', (event) => {
        event.stopPropagation();
        if (work.closed.has(scope.id)) {
          work.closed.delete(scope.id);
        } else {
          // Folding selects the row, so the selection never hides inside it.
          work.closed.add(scope.id);
          shell.selectedScope = scope.id;
          shell.selected = findRootScope(scope).m;
        }
        work.focus = `row-${scope.id}`;
        ctx.draw();
      });
    }
    const meta = isComponent
      ? `${countOwn(scope)} ${countOwn(scope) === 1 ? 'scope' : 'scopes'}`
      : `#${scope.id}`;
    const button = element(
      'button',
      {
        class: isComponent ? 'tree-row component' : 'tree-row',
        'aria-current': String(scope === current),
        'data-focus': `row-${scope.id}`,
      },
      element('span', { class: 'ind', style: `width: ${depth * 14}px` }),
      chevron,
      element('span', { class: isComponent ? 'name' : 'blk' }, label),
      element('span', { class: state.written.has(scope.id) ? 'heat on' : 'heat' }),
      element('span', { class: 'meta' }, meta),
    );
    button.addEventListener('click', () => select(scope));
    button.addEventListener('mouseenter', () => ctx.outline(scope.id));
    button.addEventListener('mouseleave', () => ctx.outline());
    rows.push([button, scope]);
    tree.append(button);
    if (shut) {
      return;
    }
    for (const child of scope.children ?? []) {
      if (child.m === undefined) {
        visit(child, info, depth + 1);
      }
    }
  }
  const needle = shell.filter.trim().toLowerCase();
  for (const [index, scope] of list.entries()) {
    const info = infos[index];
    if (needle && !`${info?.name ?? scope.m} ${info?.file ?? ''}`.toLowerCase().includes(needle)) {
      // The name does not match, so look for a value that does.
      let matched = false;
      for (const value of scope.s) {
        if (preview(value).toLowerCase().includes(needle)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        continue;
      }
    }
    visit(scope, info, 0);
  }
  // The arrow keys move the selection through the rows that show, and the side arrows fold.
  tree.addEventListener('keydown', (event) => {
    // The filter keeps its own keys.
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    let at = -1;
    for (const [index, [button]] of rows.entries()) {
      if (button === event.target) {
        at = index;
        break;
      }
    }
    if (at < 0) {
      return;
    }
    const focused = rows[at]![1];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const next = rows[at + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) {
        event.preventDefault();
        select(next[1], true);
      }
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const shutNow = event.key === 'ArrowLeft';
      if (hasOwnChildren(focused) && work.closed.has(focused.id) !== shutNow) {
        event.preventDefault();
        if (shutNow) {
          work.closed.add(focused.id);
        } else {
          work.closed.delete(focused.id);
        }
        work.focus = `row-${focused.id}`;
        ctx.draw();
      }
    }
  });

  // The detail of the selected scope.
  const info = known.get(component.m ?? '');
  const plan = info?.scopes[current.k];
  const graphing = work.mode === 'graph';
  if (graphing) {
    detail.classList.add('gmode');
  }
  const views = element('span', { class: 'seg', role: 'group', 'aria-label': 'View' });
  for (const mode of ['values', 'graph'] as const) {
    const button = element(
      'button',
      { 'aria-pressed': String(work.mode === mode), 'data-focus': `mode-${mode}` },
      mode === 'values' ? 'Values' : 'Graph',
    );
    button.addEventListener('click', () => {
      work.mode = mode;
      work.focus = `mode-${mode}`;
      // The old tab bar draws the Graph tab in the graph view; leave it for the one that holds both.
      if (shell.tab === 'graph' || shell.tab === 'elements') {
        shell.tab = 'scopes';
      }
      ctx.draw();
    });
    views.append(button);
  }
  const tags = element(
    'div',
    { class: 'tags' },
    element('span', { class: 'tag' }, `scope ${current.id}`),
    element(
      'span',
      { class: 'tag' },
      `${countOwn(component)} ${countOwn(component) === 1 ? 'scope' : 'scopes'}`,
    ),
    current.h ? element('span', { class: 'tag y' }, 'hidden') : '',
  );
  detail.append(
    element(
      'div',
      { class: 'title' },
      element(
        'h3',
        {},
        info?.name ?? component.m ?? '',
        element('span', { class: 'sub' }, ` · ${plan?.label ?? 'scope'}`),
      ),
      element('span', { class: 'path' }, source(info)),
      views,
    ),
    tags,
  );
  if (graphing) {
    detail.append(element('div', { class: 'graph' }, ctx.drawGraph(component, info)));
  } else if (current.s.length === 0) {
    detail.append(
      element('div', { class: 'sec' }, 'Values', element('span', { class: 'n' }, '0')),
      element('div', { class: 'empty' }, 'This scope holds no values.'),
    );
  } else {
    const grid = element('div', { class: 'vals' });
    for (let slot = 0; slot < current.s.length; slot++) {
      grid.append(
        ...drawSlot(
          ctx,
          current,
          slot,
          plan?.slots[slot] ?? `slot ${slot}`,
          plan?.readers?.[slot] ?? [],
        ),
      );
    }
    detail.append(
      element(
        'div',
        { class: 'sec' },
        'Values',
        element('span', { class: 'n' }, String(current.s.length)),
      ),
      grid,
    );
  }

  // A value that a person is typing stays until it is committed or cancelled.
  const typing = ctx.root.activeElement;
  if (
    typing instanceof HTMLInputElement &&
    into.contains(typing) &&
    typing.dataset.focus?.startsWith('value-') &&
    typing.value !== typing.defaultValue
  ) {
    return;
  }
  const focused = findFocus(ctx, into);
  into.replaceChildren(box);
  // The control that had the focus gets it back, or the one that an action asked for.
  const wanted = work.focus ?? focused?.key;
  work.focus = undefined;
  if (wanted !== undefined) {
    const target = into.querySelector<HTMLElement>(`[data-focus="${wanted}"]`);
    target?.focus({ preventScroll: true });
    if (
      target &&
      focused?.key === wanted &&
      focused.from !== null &&
      'setSelectionRange' in target
    ) {
      (target as HTMLInputElement).setSelectionRange(focused.from, focused.to);
    }
  }
  into.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
}

export const inspect: Workspace = {
  id: 'inspect',
  label: 'Inspect',
  icon: 'scopes',
  // The old tab bar has one key per tab until dock-shell lands. They all show the one workspace; the
  // Graph tab opens it in the graph view.
  tabs: {
    scopes: drawInspect,
    elements: drawInspect,
    graph: (ctx, into) => {
      findWork(ctx).mode = 'graph';
      return drawInspect(ctx, into);
    },
  },
  draw: (ctx, into) => drawTabOf(inspect.tabs, ctx, into),
};
