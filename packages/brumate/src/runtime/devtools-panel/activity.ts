// The Activity workspace: the log, the timeline of handlers, the effects, the navigations and the server trace.

import type { TraceEntry } from '../request.ts';
import type { DevtoolsEntry, Interaction } from '../devtools.ts';
import { element, iconButton, key, pill, row, card } from './dom.ts';
import { ms, seconds } from './format.ts';
import { known, loadComponents } from './info.ts';
import { KINDS, drawTabOf } from './workspace.ts';
import type { DockContext, Workspace } from './workspace.ts';

/** A write with the name of its slot, once the dev server has said what it is. */
export function describe(entry: DevtoolsEntry): string {
  const write = entry.write;
  const info = write && known.get(write.component);
  const name = info?.scopes[write!.k]?.slots[write!.slot];
  return name
    ? `${info!.name} ${name} = ${entry.text.split(' = ').slice(1).join(' = ')}`
    : entry.text;
}

/** The text of an entry of the log. */
export function readText(entry: DevtoolsEntry): string {
  return entry.kind === 'write' ? describe(entry) : entry.text;
}

/** The name of a handler, such as `Index h16`, once the dev server said the component. */
export function handlerName(ref: string): string {
  const [component, name = ''] = ref.split('#') as [string, string];
  return `${known.get(component)?.name ?? component} ${name}`;
}

/** A round step for the ticks of a ruler: 1, 2 or 5 times a power of ten, at least `rough`. */
export function tickStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough));
  for (const factor of [1, 2, 5]) {
    if (factor * power >= rough) {
      return factor * power;
    }
  }
  return 10 * power;
}

/** The colour of how long a run took, in milliseconds. */
export function speedColor(total: number): string {
  if (total < 100) {
    return 'green';
  }
  return total < 300 ? 'yellow' : 'red';
}

function drawLog(ctx: DockContext, into: HTMLElement): void {
  const { state, shell } = ctx;
  const filters = element('div', { class: 'toolbar filters' });
  for (const kind of KINDS) {
    const box = element('input', { type: 'checkbox' });
    box.checked = shell.shown.has(kind);
    box.addEventListener('change', () => {
      if (box.checked) {
        shell.shown.add(kind);
      } else {
        shell.shown.delete(kind);
      }
      ctx.draw();
    });
    filters.append(element('label', { class: `kind-${kind}` }, box, kind));
  }
  const search = element('input', {
    type: 'search',
    placeholder: 'Search the log',
    'aria-label': 'Search the log',
  });
  search.value = shell.logSearch;
  search.addEventListener('input', () => {
    shell.logSearch = search.value;
    drawLog(ctx, into);
    const next = into.querySelector<HTMLInputElement>('input[type="search"]');
    next?.focus();
    next?.setSelectionRange(shell.logSearch.length, shell.logSearch.length);
  });
  const pause = iconButton(shell.paused ? 'play' : 'pause', shell.paused ? 'Resume' : 'Pause', {
    'aria-pressed': String(shell.paused),
  });
  pause.addEventListener('click', () => {
    shell.paused = !shell.paused;
    shell.frozen = shell.paused ? [...state.log] : undefined;
    ctx.draw();
  });
  const clear = iconButton('trash', 'Clear');
  clear.addEventListener('click', () => {
    state.log.length = 0;
    shell.frozen = shell.paused ? [] : undefined;
    ctx.draw();
  });
  filters.append(search, pause, clear);
  const needle = shell.logSearch.trim().toLowerCase();
  const entries: DevtoolsEntry[] = [];
  for (const entry of shell.frozen ?? state.log) {
    if (
      shell.shown.has(entry.kind) &&
      (!needle || readText(entry).toLowerCase().includes(needle))
    ) {
      entries.push(entry);
    }
  }
  const list = element('table', { class: 'rows' });
  for (const entry of entries.toReversed()) {
    list.append(
      element(
        'tr',
        { class: `entry ${entry.kind}` },
        element('td', { class: 'time' }, seconds(entry.time)),
        element('td', { class: `kind-${entry.kind}`, style: 'width: 1%' }, entry.kind),
        element('td', {}, readText(entry)),
      ),
    );
  }
  into.replaceChildren(
    filters,
    entries.length > 0 ? list : element('div', { class: 'empty' }, 'Nothing to show.'),
  );
}

/** The effects and `$client` callbacks, with how often each ran and when its cleanup ran. */
async function drawEffects(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state } = ctx;
  const effects = [...state.effects.values()];
  const ids = new Set<string>();
  for (const effect of effects) {
    ids.add(effect.component);
  }
  await loadComponents(state, ids);
  const now = performance.now();
  // Runs in the last second, which is how an effect that runs too often shows.
  function lastSecond(recent: number[]): number {
    let count = 0;
    for (const at of recent) {
      if (now - at < 1000) {
        count++;
      }
    }
    return count;
  }
  const sorted = effects.toSorted(
    (a, b) => lastSecond(b.recent) - lastSecond(a.recent) || b.runs - a.runs,
  );
  const table = element(
    'table',
    { class: 'rows' },
    row(
      ['component', 'scope', 'name', 'runs', 'last second', 'time', 'cleanups', 'last run'],
      'th',
    ),
  );
  for (const effect of sorted) {
    const info = known.get(effect.component);
    const recent = lastSecond(effect.recent);
    const last = effect.recent.at(-1);
    const tr = element(
      'tr',
      {},
      element('td', {}, info?.name ?? effect.component),
      element('td', { class: 'mono' }, info?.scopes[effect.k]?.label ?? String(effect.scope)),
      element(
        'td',
        {},
        pill(
          effect.name.startsWith('c') ? '$client' : '$effect',
          effect.name.startsWith('c') ? 'purple' : 'blue',
        ),
        ' ',
        element('span', { class: 'mono' }, effect.name),
      ),
      element('td', { class: 'mono' }, String(effect.runs)),
      element('td', { class: 'mono' }, String(recent)),
      element('td', { class: 'mono' }, ms(effect.time)),
      element('td', { class: 'mono' }, String(effect.cleanups)),
      element('td', { class: 'mono' }, last === undefined ? '' : `${seconds(now - last)} ago`),
    );
    if (recent >= 10) {
      tr.className = 'busy';
      tr.title = 'It ran 10 times or more in the last second. Check what it reads.';
    } else if (!effect.active) {
      tr.className = 'ended';
      tr.title = 'Its cleanup ran, and it has not run again, such as in a scope that went.';
    }
    table.append(tr);
  }
  let active = 0;
  let runs = 0;
  let busy = 0;
  for (const effect of effects) {
    if (effect.active) {
      active++;
    }
    runs += effect.runs;
    if (lastSecond(effect.recent) >= 10) {
      busy++;
    }
  }
  into.replaceChildren(
    element(
      'div',
      { class: 'cards' },
      card('Active', String(active), `of ${effects.length} that ran`),
      card('Runs', String(runs), 'since the page loaded'),
      card('Busy', String(busy), 'ran 10 times or more in the last second'),
    ),
    effects.length > 0
      ? table
      : element('div', { class: 'empty' }, 'No effect or $client callback has run yet.'),
  );
}

/**
 * The client navigations of the page, newest first: the routes that
 * stayed, those that were replaced, or the whole page, and how far the
 * IDs of the new page moved.
 */
async function drawNavigation(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state } = ctx;
  const list = state.navigations.toReversed();
  const items: HTMLElement[] = [];
  for (const navigation of list) {
    const path = new URL(navigation.url).pathname + new URL(navigation.url).search;
    const routes = element('div', { class: 'routes' });
    if (navigation.full) {
      routes.append(
        element(
          'div',
          { class: 'sub' },
          navigation.kind === 'form'
            ? 'The whole page: a form changes what can show anywhere on it.'
            : 'The whole page: its root route or its layouts did not match the page before.',
        ),
      );
    } else {
      for (const route of navigation.kept) {
        routes.append(element('div', { class: 'mono' }, pill('kept', 'green'), ' ', route));
      }
      for (const change of navigation.replaced) {
        routes.append(
          element(
            'div',
            { class: 'mono' },
            pill('replaced', 'yellow'),
            ` ${change.slot}: ${change.from} → ${change.to}`,
          ),
        );
      }
    }
    items.push(
      element(
        'div',
        { class: 'navigation' },
        element(
          'div',
          { class: 'toolbar' },
          element('span', { class: 'mono' }, path),
          pill(navigation.kind, navigation.kind === 'form' ? 'purple' : 'blue'),
          element('span', { class: 'sub' }, `${ms(navigation.time)} until the page changed`),
          navigation.shift === undefined
            ? ''
            : element('span', { class: 'sub' }, `IDs moved by ${navigation.shift}`),
        ),
        routes,
      ),
    );
  }
  into.replaceChildren(
    ...(items.length > 0
      ? items
      : [
          element(
            'div',
            { class: 'empty' },
            'No client navigation yet. Follow a link of the page to see what it keeps.',
          ),
        ]),
  );
}

/**
 * What the server did for the last page that loaded: the render until the
 * page could stream, each memo that loaded and each server function call,
 * each `#loading` body, and the rest of the stream, on one scale. The
 * server writes it at the end of the page, in development.
 */
async function drawServer(_ctx: DockContext, into: HTMLElement): Promise<void> {
  const script = [...document.querySelectorAll('script[b-trace]')].at(-1);
  let trace: { route: string; entries: TraceEntry[] } | undefined;
  try {
    trace = script ? JSON.parse(script.textContent ?? '') : undefined;
  } catch {
    trace = undefined;
  }
  if (!trace) {
    into.replaceChildren(
      element(
        'div',
        { class: 'empty' },
        'No trace yet. The dev server writes one at the end of each page that it renders.',
      ),
    );
    return;
  }
  const entries = trace.entries.toSorted((a, b) => a.start - b.start);
  let total = 1;
  for (const entry of entries) {
    total = Math.max(total, entry.end ?? entry.start);
  }
  const table = element(
    'table',
    { class: 'rows' },
    row(['step', 'what', 'took', `when, 0 to ${ms(total)}`], 'th'),
  );
  for (const entry of entries) {
    const end = entry.end ?? total;
    const tr = element(
      'tr',
      {},
      element('td', {}, pill(entry.kind, entry.failed ? 'red' : '')),
      element('td', { class: 'mono' }, entry.label),
      element('td', { class: 'mono' }, entry.end === undefined ? '…' : ms(end - entry.start)),
      element(
        'td',
        { class: 'bar-cell' },
        element(
          'div',
          { class: 'bar-track' },
          element('span', {
            class: `bar ${entry.failed ? 'failed' : entry.kind}`,
            style: `left:${(entry.start / total) * 100}%;width:${((end - entry.start) / total) * 100}%`,
            title: `${ms(entry.start)} to ${ms(end)}`,
          }),
        ),
      ),
    );
    if (entry.failed) {
      tr.className = 'failed';
    }
    table.append(tr);
  }
  let render: TraceEntry | undefined;
  const counts = new Map<TraceEntry['kind'], number>();
  for (const entry of entries) {
    if (entry.kind === 'render' && !render) {
      render = entry;
    }
    counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  }
  function count(kind: TraceEntry['kind']): number {
    return counts.get(kind) ?? 0;
  }
  into.replaceChildren(
    element(
      'div',
      { class: 'cards' },
      card(
        'Until it streamed',
        render?.end === undefined ? '…' : ms(render.end),
        `the render of ${trace.route}`,
      ),
      card('Whole page', ms(total), 'until the last body streamed'),
      card('Memos that loaded', String(count('memo')), `${count('call')} server function calls`),
      card('Bodies', String(count('body')), '#loading bodies that streamed'),
    ),
    element(
      'div',
      { class: 'legend', style: 'margin: 10px 0 6px' },
      key('var(--accent)', 'render'),
      key('var(--green)', 'memo'),
      key('var(--blue)', 'server function call'),
      key('var(--purple)', '#loading body'),
      key('var(--faint)', 'the rest of the stream'),
      element('span', { class: 'sub' }, 'Of the last page that the dev server rendered.'),
    ),
    table,
  );
}

async function drawTimeline(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state } = ctx;
  const runs = state.timeline.toReversed().slice(0, 40);
  const ids = new Set<string>();
  for (const run of runs) {
    ids.add(run.ref.split('#')[0]!);
  }
  await loadComponents(state, ids);
  if (runs.length === 0) {
    into.replaceChildren(
      element('h2', {}, 'Timeline'),
      element(
        'p',
        { class: 'sub' },
        'Each handler that runs shows here, with the time its code took to load, its own run, the server functions it called and the updates that followed.',
      ),
    );
    return;
  }
  const now = performance.now();
  const totals: number[] = [];
  for (const run of runs) {
    totals.push((run.settled ?? now) - run.begun);
  }
  function segment(
    run: Interaction,
    scale: number,
    start: number,
    end: number,
    kind: string,
    title: string,
  ): HTMLElement {
    // Inside the track: a bar that starts before the run, or ends after the scale, is cut.
    const left = Math.min(Math.max(((start - run.begun) / scale) * 100, 0), 100);
    const width = Math.min(Math.max(((end - start) / scale) * 100, 0), 100 - left);
    return element('span', {
      class: `seg ${kind}`,
      style: `left:${left}%;width:${width}%`,
      title,
    });
  }
  const list = element('div');
  for (const [index, run] of runs.entries()) {
    const total = totals[index]!;
    let last = run.settled ?? now;
    for (const call of run.calls) {
      last = Math.max(last, call.end ?? now);
    }
    for (const update of run.updates) {
      last = Math.max(last, update.end);
    }
    // The scale ends at a round tick past the last bar, so the ruler reads in round numbers.
    const step = tickStep(Math.max(last - run.begun, 1) / 4);
    const scale = Math.ceil(Math.max(last - run.begun, 1) / step) * step;
    const ticks = element('div', { class: 'ruler' });
    for (let time = 0; time <= scale + step / 2; time += step) {
      const at = (time / scale) * 100;
      ticks.append(
        element('span', { class: at > 99 ? 'end' : '', style: `left:${at}%` }, ms(time)),
      );
    }
    // Lines through the tracks at each tick.
    const grid = `background-image: repeating-linear-gradient(to right, #ffffff1a 0 1px, transparent 1px ${(step / scale) * 100}%)`;
    const handler = element(
      'div',
      { class: 'track', style: grid },
      ...(run.ready - run.begun > 0.5
        ? [
            segment(
              run,
              scale,
              run.begun,
              run.ready,
              'wait',
              `waiting for its code and the handlers before it: ${ms(run.ready - run.begun)}`,
            ),
          ]
        : []),
      segment(
        run,
        scale,
        run.ready,
        run.end,
        run.failed ? 'failed' : 'run',
        `its run: ${ms(run.end - run.ready)}`,
      ),
      ...(run.settled !== undefined && run.settled - run.end > 0.5
        ? [
            segment(
              run,
              scale,
              run.end,
              run.settled,
              'async',
              `its promise: ${ms(run.settled - run.end)}`,
            ),
          ]
        : []),
    );
    const rows: HTMLElement[] = [
      element('div', { class: 'run-row' }, element('span'), ticks, element('span')),
      element(
        'div',
        { class: 'run-row' },
        element('span', { class: 'name' }, 'handler'),
        handler,
        element('span', { class: 'took' }, run.settled === undefined ? '…' : ms(total)),
      ),
    ];
    for (const call of run.calls) {
      const end = call.end ?? now;
      const parts = [
        segment(
          run,
          scale,
          call.start,
          end,
          call.status === 'failed' ? 'failed' : 'call',
          `the round trip: ${ms(end - call.start)}`,
        ),
      ];
      if (call.server !== undefined) {
        // The time on the server, in the middle of the round trip.
        const middle = call.start + (end - call.start - call.server) / 2;
        parts.push(
          segment(
            run,
            scale,
            middle,
            middle + call.server,
            'server',
            `on the server: ${ms(call.server)}`,
          ),
        );
      }
      rows.push(
        element(
          'div',
          { class: 'run-row' },
          element('span', { class: 'name', title: call.name }, `call ${handlerName(call.name)}`),
          element('div', { class: 'track', style: grid }, ...parts),
          element(
            'span',
            { class: 'took' },
            call.end === undefined
              ? '…'
              : `${ms(end - call.start)}${call.server === undefined ? '' : ` (${ms(call.server)})`}`,
          ),
        ),
      );
    }
    // The batches of updates share a row, each on its own bar.
    if (run.updates.length > 0) {
      let count = 0;
      let took = 0;
      const updateSegments: HTMLElement[] = [];
      for (const update of run.updates) {
        count += update.count;
        took += update.end - update.start;
        updateSegments.push(
          segment(
            run,
            scale,
            update.start,
            update.end,
            'update',
            `${update.count} ${update.count === 1 ? 'update' : 'updates'} and their effects: ${ms(update.end - update.start)}`,
          ),
        );
      }
      const batches = run.updates.length;
      rows.push(
        element(
          'div',
          { class: 'run-row' },
          element(
            'span',
            { class: 'name' },
            `${count} ${count === 1 ? 'update' : 'updates'}${batches > 1 ? `, ${batches} batches` : ''}`,
          ),
          element('div', { class: 'track', style: grid }, ...updateSegments),
          element('span', { class: 'took' }, ms(took)),
        ),
      );
    }
    const speed = speedColor(total);
    list.append(
      element(
        'div',
        { class: 'interaction' },
        element(
          'div',
          { class: 'run-head' },
          element('span', { class: 'what' }, run.label),
          element('span', { class: 'ref' }, handlerName(run.ref)),
          element('span', { class: 'spacer' }),
          run.failed ? pill('failed', 'red') : '',
          pill(
            run.settled === undefined ? 'running' : ms(total),
            run.settled === undefined ? 'blue' : speed,
          ),
          element('span', { class: 'sub' }, seconds(run.begun)),
        ),
        ...rows,
      ),
    );
  }
  const settled: number[] = [];
  let callCount = 0;
  for (const [index, run] of runs.entries()) {
    if (run.settled !== undefined) {
      settled.push(totals[index]!);
    }
    callCount += run.calls.length;
  }
  const clear = iconButton('trash', 'Clear');
  clear.addEventListener('click', () => {
    state.timeline.length = 0;
    ctx.draw();
  });
  into.replaceChildren(
    element(
      'div',
      { class: 'cards' },
      card('Handlers', String(state.timeline.length), 'the last 40 show here'),
      card(
        'Slowest',
        settled.length > 0 ? ms(Math.max(...settled)) : '—',
        'from the event to the end of its promise',
      ),
      card('Server calls', String(callCount), 'made by these handlers'),
    ),
    element(
      'div',
      { class: 'toolbar', style: 'margin-top: 8px' },
      element(
        'div',
        { class: 'legend' },
        element(
          'span',
          {},
          element('i', {
            style:
              'background: repeating-linear-gradient(45deg, var(--faint) 0 2px, transparent 2px 4px)',
          }),
          'waiting for code',
        ),
        key('var(--blue)', 'run'),
        key('#7cb7ff55', 'its promise'),
        key('#ff9ecf88', 'server call'),
        key('#ff9ecf', 'on the server'),
        key('var(--green)', 'updates'),
      ),
      element('span', { class: 'spacer' }),
      clear,
    ),
    list,
  );
}

export const activity: Workspace = {
  id: 'activity',
  label: 'Activity',
  icon: 'log',
  tabs: {
    log: drawLog,
    timeline: drawTimeline,
    effects: drawEffects,
    navigation: drawNavigation,
    server: drawServer,
  },
  draw: (ctx, into) => drawTabOf(activity.tabs, ctx, into),
};
