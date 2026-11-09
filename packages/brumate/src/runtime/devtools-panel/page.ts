// The Page workspace: the overview, the state that the page sent, the blocks and the report.

import type { Scope } from '../client.ts';
import { findRootScope } from '../devtools.ts';
import type { BlockEntry } from '../devtools.ts';
import { card, element, iconButton, pill, row } from './dom.ts';
import { kilobytes, measureSize, seconds, ms, stateBytes } from './format.ts';
import {
  collectModules,
  componentInfo,
  countBlocks,
  countScopes,
  known,
  loadComponents,
  roots,
  source,
} from './info.ts';
import { chooser, drawTabOf } from './workspace.ts';
import type { DockContext, Workspace } from './workspace.ts';

const STATE_COLORS: Record<BlockEntry['state'], string> = {
  waiting: '',
  loading: 'blue',
  streaming: 'blue',
  rendered: 'green',
  failed: 'red',
};

function blockLabel(block: BlockEntry): string {
  return block.kind === '$client' ? '$client' : `#${block.kind}`;
}

export async function drawOverview(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state, shell } = ctx;
  const list = roots(state);
  const ids = [...collectModules(list)];
  const infos = await loadComponents(state, ids);
  const blocks = [...state.blocks.values()];
  let handlers = 0;
  let calls = 0;
  for (const entry of state.log) {
    if (entry.kind === 'handler') {
      handlers++;
    } else if (entry.kind === 'call') {
      calls++;
    }
  }
  const table = element(
    'table',
    { class: 'rows' },
    row(['component', 'file', 'instances', 'scopes'], 'th'),
  );
  for (const [index, id] of ids.entries()) {
    const info = infos[index];
    const instances: Scope[] = [];
    let scopeCount = 0;
    for (const scope of list) {
      if (scope.m === id) {
        instances.push(scope);
        scopeCount += countScopes(scope);
      }
    }
    const name = element('button', { class: 'link', title: 'Show its scopes' }, info?.name ?? id);
    name.addEventListener('click', () => {
      shell.selected = id;
      shell.selectedScope = instances[0]?.id;
      shell.tab = 'scopes';
      ctx.draw();
    });
    table.append(row([name, source(info), String(instances.length), String(scopeCount)]));
  }
  into.replaceChildren(
    element(
      'div',
      { class: 'kv', style: 'margin-bottom: 12px' },
      element('span', {}, 'Page'),
      element('span', { class: 'mono' }, location.href),
      element('span', {}, 'brumate'),
      element('span', { class: 'mono' }, state.meta.version ?? 'unknown'),
      element('span', {}, 'Vite'),
      element('span', { class: 'mono' }, state.meta.vite ?? 'unknown'),
      element('span', {}, 'Open for'),
      element('span', { class: 'mono' }, seconds(performance.now())),
    ),
    element(
      'div',
      { class: 'cards' },
      card('Components', String(ids.length), `${state.scopes?.size ?? 0} scopes in the browser`),
      card('Page state', kilobytes(stateBytes()), 'state records from the server'),
      card(
        'Blocks',
        String(blocks.length),
        `${countBlocks(blocks, 'waiting')} waiting, ${countBlocks(blocks, 'rendered')} rendered`,
      ),
      card('Handlers run', String(handlers), `${calls} server function calls`),
    ),
    element('h3', {}, 'Components on the page'),
    ids.length > 0
      ? table
      : element('div', { class: 'empty' }, 'No components with client state yet.'),
  );
}

async function drawState(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state } = ctx;
  const scopes: Scope[] = [];
  const ids = new Set<string>();
  for (const scope of state.scopes?.values() ?? []) {
    // The scopes that the browser made are not in the state that the server sent.
    if (typeof scope.id !== 'number' || scope.id >= 0) {
      scopes.push(scope);
      const id = findRootScope(scope).m ?? '';
      if (id) {
        ids.add(id);
      }
    }
  }
  await loadComponents(state, ids);
  // The slots of every instance of a scope add up, such as the items of a list.
  const slots = new Map<
    string,
    { component: string; k: number; slot: number; bytes: number; count: number }
  >();
  for (const scope of scopes) {
    const component = findRootScope(scope).m ?? '';
    for (const [slot, value] of scope.s.entries()) {
      const key = `${component}:${scope.k}:${slot}`;
      const entry = slots.get(key) ?? { component, k: scope.k, slot, bytes: 0, count: 0 };
      entry.bytes += measureSize(value);
      entry.count++;
      slots.set(key, entry);
    }
  }
  const sorted = [...slots.values()].toSorted((a, b) => b.bytes - a.bytes);
  const first = document.querySelector('script[b-state][b-scopes]')?.textContent?.length ?? 0;
  const table = element(
    'table',
    { class: 'rows' },
    row(['component', 'scope', 'value', 'instances', 'about', 'read in the browser by'], 'th'),
  );
  for (const entry of sorted.slice(0, 200)) {
    const info = known.get(entry.component);
    const layout = info?.scopes[entry.k];
    const readers = layout?.readers?.[entry.slot] ?? [];
    const tr = element(
      'tr',
      {},
      element('td', {}, info?.name ?? entry.component),
      element('td', { class: 'mono' }, layout?.label ?? String(entry.k)),
      element('td', { class: 'mono' }, layout?.slots[entry.slot] ?? `slot ${entry.slot}`),
      element('td', { class: 'mono' }, String(entry.count)),
      element('td', { class: 'mono', style: 'white-space: nowrap' }, kilobytes(entry.bytes)),
      element('td', { class: 'mono' }, readers.join(', ') || '—'),
    );
    // A large value is worth a look: does the browser need all of it?
    if (entry.bytes > 1024) {
      tr.className = 'large';
      tr.title = 'More than 1 kB. Send only the fields that the browser reads.';
    }
    table.append(tr);
  }
  into.replaceChildren(
    element(
      'div',
      { class: 'cards' },
      card('Page state', kilobytes(stateBytes()), 'every state record of the page'),
      card('First record', kilobytes(first), 'the state that the page started with'),
      card('Values', String(slots.size), `in ${scopes.length} scopes`),
    ),
    element(
      'div',
      { class: 'legend', style: 'margin: 10px 0 6px' },
      element(
        'span',
        { class: 'sub' },
        'A value is sent because code in the browser reads it. Sizes are about what the state takes, and a value of many instances adds them up.',
      ),
    ),
    slots.size > 0 ? table : element('div', { class: 'empty' }, 'The page sent no state.'),
  );
}

function drawBlocks(ctx: DockContext, into: HTMLElement): void {
  const { state } = ctx;
  const blocks = [...state.blocks.values()];
  const table = element(
    'table',
    { class: 'rows' },
    row(['block', 'id', 'trigger', 'state', 'fired', 'rendered', ''], 'th'),
  );
  for (const block of blocks) {
    const action = element('span');
    if (block.state === 'waiting' && (block.kind === 'defer' || block.kind === 'client')) {
      const fire = iconButton('bolt', 'Fire', { title: 'Fire the trigger now' });
      fire.addEventListener('click', () => {
        state.fire?.(block);
        ctx.draw();
      });
      action.append(fire);
    }
    // A body that the page swapped in, whose fallback it kept, can show its fallback again.
    const kept = (globalThis as { $bD?: Record<string, unknown> }).$bD?.[block.id];
    if (
      block.state === 'rendered' &&
      kept &&
      (block.kind === 'loading' || block.kind === 'defer')
    ) {
      const toggle = iconButton(
        block.fallback ? 'play' : 'pause',
        block.fallback ? 'Body' : 'Fallback',
        {
          title: block.fallback ? 'Show the body again' : 'Show the fallback in place of the body',
          'aria-pressed': String(block.fallback === true),
        },
      );
      toggle.addEventListener('click', () => {
        state.showFallback?.(block, !block.fallback);
        ctx.draw();
      });
      action.append(toggle);
    }
    let took = '';
    if (block.rendered !== undefined) {
      took =
        block.fired === undefined
          ? seconds(block.rendered)
          : `+${ms(block.rendered - block.fired)}`;
    }
    table.append(
      row([
        pill(blockLabel(block), block.kind === '$client' ? 'blue' : 'accent'),
        element('span', { class: 'mono' }, block.id),
        block.trigger ?? '',
        pill(block.state, STATE_COLORS[block.state]),
        block.fired === undefined ? '' : seconds(block.fired),
        took,
        action,
      ]),
    );
  }
  into.replaceChildren(
    element('h2', {}, 'Blocks that render after the page'),
    element(
      'p',
      { class: 'sub', style: 'margin-top: 0' },
      'Streaming bodies come with the page. Waiting ones wait for their trigger, and Fire runs it now. Fallback shows the fallback of a body again, to check both sides.',
    ),
    blocks.length > 0
      ? table
      : element('div', { class: 'empty' }, 'No blocks that render later on this page.'),
  );
}

async function drawReport(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state, shell } = ctx;
  const id = shell.selected ?? roots(state)[0]?.m;
  const info = id ? await componentInfo(state, id) : undefined;
  into.replaceChildren(
    ...(info
      ? [
          element('div', { class: 'toolbar' }, chooser(ctx, id), source(info)),
          element('pre', { class: 'report' }, info.text),
        ]
      : [element('div', { class: 'empty' }, 'No component yet.')]),
  );
}

export const page: Workspace = {
  id: 'page',
  label: 'Page',
  icon: 'overview',
  tabs: { overview: drawOverview, state: drawState, blocks: drawBlocks, report: drawReport },
  draw: (ctx, into) => drawTabOf(page.tabs, ctx, into),
};
