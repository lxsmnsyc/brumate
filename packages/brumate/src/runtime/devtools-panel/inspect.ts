// The Inspect workspace: the components of the page and their scopes, the element that Pick found, and the graph.

import type { Scope } from '../client.ts';
import { findRootScope, preview } from '../devtools.ts';
import { element, iconButton, pill, row } from './dom.ts';
import { readType } from './format.ts';
import { drawGraphTab } from './graph.ts';
import { drawReads, findAnchor, findScope, known, loadComponents, roots, source } from './info.ts';
import type { ComponentInfo } from './info.ts';
import { drawTabOf } from './workspace.ts';
import type { DockContext, Workspace } from './workspace.ts';

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

/** A slot with its name, type and value. A value that JSON can hold can be edited. */
function drawSlot(ctx: DockContext, scope: Scope, slot: number, name: string): HTMLElement {
  const { state, shell } = ctx;
  const value = scope.s[slot];
  const cell = element('td');
  const line = element(
    'tr',
    { class: 'slot' },
    element('td', { class: 'name' }, name),
    element('td', { class: 'type' }, readType(value)),
    cell,
  );
  if (shell.editing?.scope === scope.id && shell.editing.slot === slot) {
    const input = element('input', { 'aria-label': `New value of ${name}` });
    input.value = JSON.stringify(value) ?? '';
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        shell.editing = undefined;
        state.set?.(scope, slot, parseValue(input.value));
        ctx.draw();
      } else if (event.key === 'Escape') {
        shell.editing = undefined;
        ctx.draw();
      }
    });
    cell.append(input);
    queueMicrotask(() => input.focus());
    return line;
  }
  const canEdit = editable(value) && state.set !== undefined;
  const text = element('span', { class: canEdit ? 'value' : 'value fixed' }, preview(value));
  if (canEdit) {
    text.title = 'Click to edit. Enter JSON, or text for a string.';
    text.addEventListener('click', () => {
      shell.editing = { scope: scope.id, slot };
      ctx.draw();
    });
  }
  cell.append(text);
  return line;
}

export async function drawScopes(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state, shell } = ctx;
  const list = roots(state);
  const listed: string[] = [];
  for (const scope of list) {
    listed.push(scope.m!);
  }
  const infos = await loadComponents(state, listed);
  if (list.length === 0) {
    into.replaceChildren(
      element('div', { class: 'empty' }, 'No scopes yet. The first event loads them.'),
    );
    return;
  }
  const current =
    (shell.selectedScope !== undefined && state.scopes?.get(shell.selectedScope)) || list[0]!;
  const search = element('input', {
    type: 'search',
    placeholder: 'Filter components and values',
    'aria-label': 'Filter scopes',
  });
  search.value = shell.filter;
  search.addEventListener('input', () => {
    shell.filter = search.value;
    void drawScopes(ctx, into).then(() => {
      const next = into.querySelector<HTMLInputElement>('input[type="search"]');
      next?.focus();
      next?.setSelectionRange(shell.filter.length, shell.filter.length);
    });
  });
  const {
    box,
    first: tree,
    second: detail,
  } = ctx.split({ key: 'scopes', min: [200, 300], start: 280 });
  tree.append(search);
  function visit(scope: Scope, info: ComponentInfo | undefined, depth: number): void {
    const label =
      scope.m === undefined
        ? `${info?.scopes[scope.k]?.label ?? 'scope'}${scope.h ? ' · hidden' : ''}`
        : (info?.name ?? scope.m);
    const classes = ['tree-row'];
    if (scope.m !== undefined) {
      classes.push('component');
    }
    if (state.written.has(scope.id)) {
      classes.push('written');
    }
    const button = element(
      'button',
      {
        class: classes.join(' '),
        style: `padding-left: ${6 + depth * 14}px`,
        'aria-current': String(scope === current),
      },
      element('span', {}, label),
      element(
        'span',
        { class: 'file' },
        scope.m === undefined ? `#${scope.id}` : (info?.file ?? ''),
      ),
    );
    button.addEventListener('click', () => {
      shell.selectedScope = scope.id;
      shell.selected = findRootScope(scope).m;
      ctx.draw();
    });
    button.addEventListener('mouseenter', () => ctx.outline(scope.id));
    button.addEventListener('mouseleave', () => ctx.outline());
    tree.append(button);
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

  // The scope that is shell.selected, with its slots.
  const component = findRootScope(current);
  const info = known.get(component.m ?? '');
  const plan = info?.scopes[current.k];
  const slots = element('table', { class: 'rows slots' }, row(['name', 'type', 'value'], 'th'));
  for (let slot = 0; slot < current.s.length; slot++) {
    slots.append(drawSlot(ctx, current, slot, plan?.slots[slot] ?? `slot ${slot}`));
  }
  const graph = iconButton('graph', 'Show the graph');
  graph.addEventListener('click', () => {
    shell.selected = component.m;
    shell.tab = 'graph';
    ctx.draw();
  });
  if (state.written.has(current.id)) {
    detail.classList.add('written');
  }
  detail.append(
    element(
      'h2',
      {},
      info?.name ?? component.m ?? '',
      element('span', { class: 'sub' }, ` · ${plan?.label ?? 'scope'}`),
    ),
    element(
      'div',
      { class: 'toolbar' },
      pill(`scope ${current.id}`),
      current.h ? pill('hidden', 'yellow') : '',
      source(info),
      element('span', { class: 'spacer' }),
      graph,
    ),
    current.s.length > 0
      ? slots
      : element('div', { class: 'empty' }, 'This scope holds no values.'),
  );
  into.replaceChildren(box);
  into.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
}

/** The handlers of an element, from its `b-on`. */
function drawHandlers(target: Element): HTMLElement {
  const table = element('table', { class: 'rows' }, row(['event', 'handler'], 'th'));
  for (const raw of (target.getAttribute('b-on') ?? '').split(/\s+/)) {
    if (!raw) {
      continue;
    }
    const [head, ref = ''] = raw.split('=') as [string, string];
    const [type, ...modifiers] = head.split(':');
    const [component, name = ''] = ref.split('@')[0]!.split('#') as [string, string];
    const info = known.get(component);
    table.append(
      row([
        element('span', { class: 'mono' }, [type, ...modifiers].join(':')),
        element('span', { class: 'mono' }, `${info?.name ?? component} ${name}`),
      ]),
    );
  }
  return table;
}

async function drawElements(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state, shell } = ctx;
  if (!shell.picked?.isConnected) {
    const start = iconButton('pick', 'Pick an element');
    start.addEventListener('click', () => ctx.pick());
    into.replaceChildren(
      element('h2', {}, 'Elements'),
      element(
        'p',
        { class: 'sub' },
        'Pick an element of the page to see the component that renders it, its place in the file, its handlers and the values that update it.',
      ),
      start,
    );
    return;
  }
  const tag = `<${shell.picked.tagName.toLowerCase()}>`;
  const content = element('div');
  const anchored = shell.picked.closest('[b-b]');
  const [id = '', anchorText = '0'] = anchored?.getAttribute('b-b')!.split(':') ?? [];
  const scope = anchored ? findScope(state, id) : undefined;
  if (scope) {
    const anchor = Number(anchorText);
    const { info, component, place } = await findAnchor(state, scope, anchor);
    const scopeButton = element(
      'button',
      { class: 'link', title: 'Show the scope' },
      `scope ${scope.id}${info?.scopes[scope.k] ? ` · ${info.scopes[scope.k]!.label}` : ''}`,
    );
    scopeButton.addEventListener('click', () => {
      shell.selectedScope = scope.id;
      shell.tab = 'scopes';
      ctx.draw();
    });
    content.append(
      element(
        'h2',
        {},
        shell.picked === anchored
          ? (place?.label ?? tag)
          : `${tag} in ${place?.label ?? 'an element'}`,
        element('span', { class: 'sub' }, ` · ${info?.name ?? component.m}`),
      ),
      element(
        'div',
        { class: 'kv' },
        element('span', {}, 'source'),
        element('span', {}, place?.at ? source(info, place.at) : '—'),
        element('span', {}, 'scope'),
        element('span', {}, scopeButton),
        element('span', {}, 'anchor'),
        element('span', { class: 'mono' }, String(anchor)),
        element('span', {}, 'reads'),
        element(
          'span',
          {},
          ...(place && place.reads.length > 0 ? drawReads(scope, place.reads) : ['—']),
        ),
      ),
    );
    const handled = shell.picked.closest('[b-on]');
    if (handled && anchored!.contains(handled)) {
      content.append(element('h3', {}, 'Handlers'), drawHandlers(handled));
    }
  } else {
    content.append(
      element('h2', {}, tag),
      element(
        'div',
        { class: 'empty' },
        anchored
          ? `Scope ${id} is not in the browser yet.`
          : 'Nothing in the browser updates this element or the elements around it.',
      ),
    );
  }
  // The inserts and blocks inside the element, which have markers instead of `b-b`.
  const markers: { data: string; scope: Scope; anchor: number }[] = [];
  const walker = document.createTreeWalker(shell.picked, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Comment).data;
    const match = /^[tb](-?[\d.]+):(\d+)/.exec(data);
    const markerScope = match && findScope(state, match[1]!);
    if (markerScope) {
      markers.push({ data, scope: markerScope, anchor: Number(match![2]) });
    }
  }
  const pending: ReturnType<typeof findAnchor>[] = [];
  for (const marker of markers) {
    pending.push(findAnchor(state, marker.scope, marker.anchor));
  }
  const places = await Promise.all(pending);
  const inside = element('table', { class: 'rows' }, row(['marker', 'source', 'reads'], 'th'));
  for (const [index, marker] of markers.entries()) {
    const { info, place } = places[index]!;
    inside.append(
      row([
        element('span', { class: 'mono' }, place?.label ?? marker.data),
        place?.at ? source(info, place.at) : '',
        element('span', {}, ...drawReads(marker.scope, place?.reads ?? [])),
      ]),
    );
  }
  if (markers.length > 0) {
    content.append(element('h3', {}, 'Inside it'), inside);
  }
  into.replaceChildren(content);
}

export const inspect: Workspace = {
  id: 'inspect',
  label: 'Inspect',
  icon: 'scopes',
  tabs: { scopes: drawScopes, elements: drawElements, graph: drawGraphTab },
  draw: (ctx, into) => drawTabOf(inspect.tabs, ctx, into),
};
