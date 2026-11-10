// The Page workspace, as the prototype draws it: four numbers, the state that the page sent, the
// blocks that render later, and the environment. Every number is read from the running page.

import { findRootScope } from '../devtools.ts';
import type { BlockEntry, DevtoolsState } from '../devtools.ts';
import { element, iconButton, key, pill, row } from './dom.ts';
import { kilobytes, measureSize, seconds, ms, stateBytes } from './format.ts';
import { collectModules, countScopes, known, loadComponents, roots } from './info.ts';
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

const PAGE_STYLE = `
.pg .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin: -12px -14px 0; border-bottom: 1px solid var(--line); }
.pg .metric { padding: 14px 18px; border-left: 1px solid var(--line); }
.pg .metric:first-child { border-left: 0; }
.pg .metric .l { color: var(--dim); }
.pg .metric .big { margin-top: 6px; font: 500 24px/1.15 var(--mono); letter-spacing: -.03em; }
.pg .metric .big small { margin-left: 3px; font-size: 12px; color: var(--faint); letter-spacing: 0; }
.pg .metric .s { margin-top: 2px; font: 11px var(--mono); color: var(--faint); }
.pg .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); margin: 0 -14px; }
.pg .cols > section { padding: 4px 18px 18px; min-width: 0; }
.pg .cols > section + section { border-left: 1px solid var(--line); }
.pg .sec { display: flex; align-items: baseline; gap: 8px; margin: 16px 0 8px; color: var(--faint); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.pg .sec .n { font: 11px var(--mono); text-transform: none; letter-spacing: 0; }
.pg .stack { display: flex; height: 8px; margin: 4px 0 10px; gap: 2px; border-radius: 4px; overflow: hidden; }
.pg .stack span { min-width: 3px; }
.pg .legend { margin-bottom: 4px; }
.pg .env { display: grid; grid-template-columns: max-content 1fr; gap: 4px 20px; font: 11.5px var(--mono); }
.pg .env > :nth-child(odd) { color: var(--faint); }
.pg .env > :nth-child(even) { overflow-wrap: anywhere; }
.pg .acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.pg .btn { height: 28px; padding: 0 12px; border-radius: 8px; background: var(--raised); box-shadow: inset 0 0 0 1px var(--line); font-weight: 500; }
.pg .btn:hover { background: var(--hover); }
`;

const SEGMENTS = ['var(--accent)', 'var(--blue)', 'var(--purple)', 'var(--green)', 'var(--yellow)'];

interface Slot {
  component: string;
  k: number;
  slot: number;
  bytes: number;
  count: number;
}

/** The slots of the scopes that the server sent. The slots of every instance add up. */
function readSlots(state: DevtoolsState): { slots: Slot[]; scopes: number } {
  const found = new Map<string, Slot>();
  let scopes = 0;
  for (const scope of state.scopes?.values() ?? []) {
    // The scopes that the browser made are not in the state that the server sent.
    if (typeof scope.id === 'number' && scope.id < 0) {
      continue;
    }
    scopes++;
    const component = findRootScope(scope).m ?? '';
    for (const [slot, value] of scope.s.entries()) {
      const id = `${component}:${scope.k}:${slot}`;
      const entry = found.get(id) ?? { component, k: scope.k, slot, bytes: 0, count: 0 };
      entry.bytes += measureSize(value);
      entry.count++;
      found.set(id, entry);
    }
  }
  return { slots: [...found.values()].toSorted((a, b) => b.bytes - a.bytes), scopes };
}

/** How long the page took to get ready, from the navigation timing, when the browser has it. */
function readReady(): { total: number; server: number } | undefined {
  const [timing] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (!timing || timing.domContentLoadedEventEnd <= 0) {
    return undefined;
  }
  return { total: timing.domContentLoadedEventEnd, server: timing.responseStart };
}

function makeMetric(label: string, big: string, small: string, note: string): HTMLElement {
  return element(
    'div',
    { class: 'metric' },
    element('div', { class: 'l' }, label),
    element('div', { class: 'big' }, big, small ? element('small', {}, small) : ''),
    element('div', { class: 's' }, note),
  );
}

function drawMetrics(state: DevtoolsState, components: number, scopes: number): HTMLElement {
  let handlers = 0;
  let calls = 0;
  for (const entry of state.log) {
    if (entry.kind === 'handler') {
      handlers++;
    } else if (entry.kind === 'call') {
      calls++;
    }
  }
  const bytes = (stateBytes() / 1024).toFixed(1);
  const ready = readReady();
  return element(
    'div',
    { class: 'metrics' },
    makeMetric('Components', String(components), '', `${scopes} scopes in the browser`),
    makeMetric('Page state', bytes, 'kB', 'records from the server'),
    makeMetric('Handlers run', String(handlers), '', `${calls} server calls`),
    ready
      ? makeMetric(
          'Ready in',
          String(Math.round(ready.total)),
          'ms',
          `server ${Math.round(ready.server)} · browser ${Math.round(ready.total - ready.server)}`,
        )
      : makeMetric('Open for', seconds(performance.now()), '', 'since the page started'),
  );
}

/** The state of the page by component, as one bar with a legend, and its largest values. */
function drawState(state: DevtoolsState): (HTMLElement | string)[] {
  const { slots } = readSlots(state);
  const first = document.querySelector('script[b-state][b-scopes]')?.textContent?.length ?? 0;
  const total = stateBytes();
  const byComponent = new Map<string, number>();
  for (const slot of slots) {
    byComponent.set(slot.component, (byComponent.get(slot.component) ?? 0) + slot.bytes);
  }
  const parts = [...byComponent].toSorted((a, b) => b[1] - a[1]);
  const stack = element('div', { class: 'stack' });
  const legend = element('div', { class: 'legend' });
  for (const [index, [component, bytes]] of parts.entries()) {
    const color = SEGMENTS[index] ?? 'var(--faint)';
    if (index < SEGMENTS.length) {
      stack.append(element('span', { style: `flex: ${bytes}; background: ${color}` }));
      legend.append(key(color, `${known.get(component)?.name ?? component} ${kilobytes(bytes)}`));
    }
  }
  const table = element(
    'table',
    { class: 'rows' },
    row(['component', 'scope', 'value', 'instances', 'about', 'read in the browser by'], 'th'),
  );
  for (const entry of slots.slice(0, 200)) {
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
  return [
    element(
      'div',
      { class: 'sec' },
      'Page state',
      element('span', { class: 'n' }, `${kilobytes(total)}, the first record ${kilobytes(first)}`),
    ),
    slots.length > 0 ? stack : '',
    slots.length > 0 ? legend : '',
    slots.length > 0 ? table : element('div', { class: 'empty' }, 'The page sent no state.'),
  ];
}

function drawBlocks(ctx: DockContext): HTMLElement[] {
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
      const fire = iconButton('bolt', 'Trigger now', { title: 'Fire the trigger now' });
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
  return [
    element(
      'div',
      { class: 'sec' },
      'Blocks',
      element('span', { class: 'n' }, String(blocks.length)),
    ),
    blocks.length > 0
      ? table
      : element('div', { class: 'empty' }, 'No blocks that render later on this page.'),
  ];
}

function drawEnvironment(ctx: DockContext): HTMLElement[] {
  const { state } = ctx;
  const issues = element('button', { class: 'btn' }, plural(state.errors.length, 'issue'));
  issues.addEventListener('click', () => ctx.select('issues', 'errors'));
  const activity = element('button', { class: 'btn' }, 'Activity');
  activity.addEventListener('click', () => ctx.select('activity', 'log'));
  return [
    element('div', { class: 'sec' }, 'Environment'),
    element(
      'div',
      { class: 'env' },
      element('span', {}, 'brumate'),
      element('span', {}, state.meta.version ?? 'unknown'),
      element('span', {}, 'vite'),
      element('span', {}, state.meta.vite ?? 'unknown'),
      element('span', {}, 'route'),
      element('span', {}, location.pathname + location.search),
      element('span', {}, 'open for'),
      element('span', {}, seconds(performance.now())),
    ),
    element('div', { class: 'acts' }, issues, activity),
  ];
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Draws the whole workspace. The old tabs of the tab bar draw the same page. */
export function drawPage(ctx: DockContext, into: HTMLElement): void | Promise<void> {
  const { state } = ctx;
  // The styles go in the shadow root once, so they are not part of the text of the body.
  if (!ctx.root.querySelector('style[data-page]')) {
    ctx.root.append(element('style', { 'data-page': '' }, PAGE_STYLE));
  }
  const ids = [...collectModules(roots(state))];
  function render(): void {
    let scopes = 0;
    for (const scope of roots(state)) {
      scopes += countScopes(scope);
    }
    into.replaceChildren(
      element(
        'div',
        { class: 'pg' },
        drawMetrics(state, ids.length, state.scopes?.size ?? scopes),
        element(
          'div',
          { class: 'cols' },
          element('section', {}, ...drawState(state), ...drawBlocks(ctx)),
          element('section', {}, ...drawEnvironment(ctx)),
        ),
      ),
    );
  }
  render();
  // Names and the layout of the scopes come from the dev server, so the page draws again with them.
  let missing = false;
  for (const id of ids) {
    if (!known.has(id)) {
      missing = true;
    }
  }
  if (missing) {
    return loadComponents(state, ids).then(render);
  }
}

export const page: Workspace = {
  id: 'page',
  label: 'Page',
  icon: 'overview',
  tabs: { overview: drawPage, state: drawPage, blocks: drawPage },
  draw: drawPage,
};
