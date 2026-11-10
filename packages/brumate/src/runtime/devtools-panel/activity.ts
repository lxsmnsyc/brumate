// The Activity workspace: one log of what the page did (navigations, blocks, handlers, writes,
// effects and server calls) with filters, a ruler of when it happened, and a pane for the detail of
// a server call.

import type { CallTiming, DevtoolsEntry, DevtoolsState, Interaction } from '../devtools.ts';
import { element, svg } from './dom.ts';
import { ms, seconds } from './format.ts';
import { known, loadComponents } from './info.ts';
import type { DockContext, Shell, Workspace } from './workspace.ts';

/** The kinds of rows, in the order of the filters. */
type RowKind = 'nav' | 'block' | 'handler' | 'write' | 'effect' | 'server';

const KIND_ORDER: RowKind[] = ['nav', 'block', 'handler', 'write', 'effect', 'server'];
const LABELS: Record<RowKind, string> = {
  nav: 'Navigation',
  block: 'Block',
  handler: 'Handler',
  write: 'Write',
  effect: 'Effect',
  server: 'Server',
};
const COLORS: Record<RowKind, string> = {
  nav: 'var(--blue)',
  block: 'var(--purple)',
  handler: 'var(--accent)',
  write: 'var(--yellow)',
  effect: 'var(--green)',
  server: 'var(--pink)',
};
/** The most rows the log draws, newest last. */
const MAX_ROWS = 400;

/** One line of the log. */
interface Row {
  time: number;
  kind: RowKind;
  text: string;
  /** A second, dimmer part of the text, such as the status of a call. */
  sub?: string;
  /** The time it took. */
  d?: string;
  bad?: boolean;
  /** Set for a row that a handler caused, so it hangs under the handler. */
  child?: boolean;
  /** The entry of a server call, which the detail pane opens. */
  call?: DevtoolsEntry;
}

/** What the workspace remembers in `shell.work.activity`. */
interface ActivityWork {
  shown: Set<RowKind>;
  /** The time Pause was pressed, while it holds. */
  pausedAt: number | undefined;
  /** Rows older than this are cleared. */
  cleared: number;
  selected: DevtoolsEntry | undefined;
  /** The time of the newest row that an earlier draw showed. */
  drawn: number;
  /** True while the log is scrolled to its end, so new rows keep it there. */
  atEnd: boolean;
  /** Where the log was scrolled to, to restore it after a draw. */
  scrollTop: number;
  /** The drawn detail, kept while the selection and its record are the same objects. */
  detail:
    | { entry: DevtoolsEntry; timing: CallTiming | undefined; record: unknown; node: HTMLElement }
    | undefined;
}

function readWork(shell: Shell): ActivityWork {
  let work = shell.work.activity as ActivityWork | undefined;
  if (!work) {
    work = {
      shown: new Set(KIND_ORDER),
      pausedAt: undefined,
      cleared: -1,
      selected: undefined,
      drawn: -1,
      atEnd: true,
      scrollTop: 0,
      detail: undefined,
    };
    shell.work.activity = work;
  }
  return work;
}

/** A write with the name of its slot, once the dev server has said what it is. */
export function describe(entry: DevtoolsEntry): string {
  const write = entry.write;
  const info = write && known.get(write.component);
  const name = info?.scopes[write!.k]?.slots[write!.slot];
  return name
    ? `${info!.name} ${name} = ${entry.text.split(' = ').slice(1).join(' = ')}`
    : entry.text;
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

/** The IDs of the components that the rows name, to ask the dev server for their names. */
function listComponents(state: DevtoolsState): Set<string> {
  const ids = new Set<string>();
  for (const entry of state.log) {
    if (entry.write) {
      ids.add(entry.write.component);
    } else if (entry.kind === 'handler') {
      ids.add(readHandler(entry).split('#')[0]!);
    } else {
      ids.add(entry.text.split(':')[0]!.split('#')[0]!);
    }
  }
  for (const run of state.timeline) {
    ids.add(run.ref.split('#')[0]!);
    for (const call of run.calls) {
      ids.add(call.name.split('#')[0]!);
    }
  }
  for (const effect of state.effects.values()) {
    ids.add(effect.component);
  }
  return ids;
}

/** The reference of a handler entry: `click on <button>: Cart_1#h2` is `Cart_1#h2`. */
function readHandler(entry: DevtoolsEntry): string {
  return entry.text.slice(entry.text.lastIndexOf(': ') + 2);
}

function addHandler(
  state: DevtoolsState,
  entry: DevtoolsEntry,
  rows: Row[],
  matched: Set<Interaction>,
): void {
  const ref = readHandler(entry);
  const label = entry.text.slice(0, Math.max(0, entry.text.lastIndexOf(': ')));
  // The run in the timeline that this entry stands for gives the time of its own code.
  let own: string | undefined;
  let bad = false;
  for (const run of state.timeline) {
    if (run.ref === ref && Math.abs(run.begun - entry.time) < 100) {
      own = ms(run.end - run.ready);
      bad = run.failed === true;
      matched.add(run);
    }
  }
  rows.push({ time: entry.time, kind: 'handler', text: handlerName(ref), sub: label, d: own, bad });
}

function addCall(entry: DevtoolsEntry, rows: Row[]): void {
  const timing = entry.call;
  if (timing) {
    let status = String(timing.status ?? '…');
    if (timing.status === 'redirect') {
      // The log text holds the target: `name: redirect to /done in 3 ms`.
      const target = /redirect to (.*) in \d+ ms$/.exec(entry.text)?.[1];
      status = target ? `redirect → ${target}` : status;
    }
    rows.push({
      time: entry.time,
      kind: 'server',
      text: `${handlerName(timing.name)}()`,
      sub: status,
      d: timing.end === undefined ? '…' : ms(timing.end - timing.start),
      bad:
        timing.status === 'failed' || (typeof timing.status === 'number' && timing.status >= 400),
      call: entry,
    });
    return;
  }
  // A call that no handler made has its name and answer in the text only.
  const cut = entry.text.indexOf(': ');
  const name = cut === -1 ? entry.text : entry.text.slice(0, cut);
  rows.push({
    time: entry.time,
    kind: 'server',
    text: `${handlerName(name)}()`,
    sub: cut === -1 ? undefined : entry.text.slice(cut + 2),
    bad: entry.text.includes(': failed'),
    call: entry,
  });
}

/** Every row of the page, oldest first, before the filters. */
function collectRows(state: DevtoolsState): Row[] {
  const rows: Row[] = [];
  const matched = new Set<Interaction>();
  for (const entry of state.log) {
    if (entry.kind === 'handler') {
      addHandler(state, entry, rows, matched);
    } else if (entry.kind === 'write') {
      rows.push({ time: entry.time, kind: 'write', text: describe(entry) });
    } else {
      addCall(entry, rows);
    }
  }
  // A run that the log has no entry for, such as when the log was trimmed, still shows.
  for (const run of state.timeline) {
    if (!matched.has(run)) {
      rows.push({
        time: run.begun,
        kind: 'handler',
        text: handlerName(run.ref),
        sub: run.label,
        d: ms(run.end - run.ready),
        bad: run.failed === true,
      });
    }
  }
  const now = performance.now();
  for (const effect of state.effects.values()) {
    const info = known.get(effect.component);
    const name = `${info?.name ?? effect.component} ${effect.name}`;
    const sub = effect.name.startsWith('c') ? '$client' : '$effect';
    let lastSecond = 0;
    for (const at of effect.recent) {
      if (now - at < 1000) {
        lastSecond++;
      }
    }
    for (const [index, at] of effect.recent.entries()) {
      const newest = index === effect.recent.length - 1;
      rows.push({
        time: at,
        kind: 'effect',
        text: name,
        sub,
        d: newest ? `${effect.runs} runs` : undefined,
        bad: newest && lastSecond >= 10,
      });
    }
  }
  for (const navigation of state.navigations) {
    const url = new URL(navigation.url);
    rows.push({
      time: navigation.start,
      kind: 'nav',
      text: url.pathname + url.search,
      sub: navigation.kind,
      d: ms(navigation.time),
    });
    const at = navigation.start;
    if (navigation.full) {
      rows.push({ time: at, kind: 'nav', text: 'the whole page was replaced', child: true });
    }
    for (const route of navigation.kept) {
      rows.push({ time: at, kind: 'nav', text: `kept ${route}`, child: true });
    }
    for (const change of navigation.replaced) {
      rows.push({
        time: at,
        kind: 'nav',
        text: `replaced ${change.slot}: ${change.from} → ${change.to}`,
        child: true,
      });
    }
  }
  for (const block of state.blocks.values()) {
    rows.push({
      time: block.rendered ?? block.fired ?? block.seen,
      kind: 'block',
      text: `${block.kind} ${block.id}`,
      sub: block.state,
      bad: block.state === 'failed',
    });
  }
  // Array#sort is stable, so rows with the same time keep the order above.
  return rows.toSorted((a, b) => a.time - b.time);
}

/** Marks the writes, effects and calls that a handler caused, so they hang under it. */
function nestRows(state: DevtoolsState, rows: Row[]): void {
  for (const row of rows) {
    if (row.kind !== 'write' && row.kind !== 'effect' && row.kind !== 'server') {
      continue;
    }
    for (const run of state.timeline) {
      if (run.begun <= row.time && row.time <= (run.settled ?? run.end) + 32) {
        row.child = true;
        break;
      }
    }
  }
}

/** The ruler above the log: a tick for each row and a mark for each round step. */
function drawStrip(rows: Row[]): HTMLElement {
  const strip = element('div', { class: 'strip' });
  if (rows.length === 0) {
    return strip;
  }
  const first = rows[0]!.time;
  const span = Math.max(rows.at(-1)!.time - first, 1000);
  const step = tickStep(span / 5);
  for (let at = 0; at <= span; at += step) {
    const left = `left:${(at / span) * 100}%`;
    strip.append(
      element('span', { class: 'rule', style: left }),
      element('span', { class: 'rl', style: left }, `${+(at / 1000).toFixed(1)}s`),
    );
  }
  for (const row of rows) {
    strip.append(
      element('span', {
        class: 'tick',
        style: `left:${((row.time - first) / span) * 100}%;height:${row.child ? 10 : 16}px;background:${COLORS[row.kind]}`,
      }),
    );
  }
  return strip;
}

function drawFilters(ctx: DockContext, work: ActivityWork): HTMLElement {
  const { shell, state } = ctx;
  const tools = element('div', { class: 'tools' });
  for (const kind of KIND_ORDER) {
    const chip = element(
      'button',
      { class: 'chip', 'aria-pressed': String(work.shown.has(kind)) },
      element('i', { style: `background:${COLORS[kind]}` }),
      LABELS[kind],
    );
    chip.addEventListener('click', () => {
      if (work.shown.has(kind)) {
        work.shown.delete(kind);
      } else {
        work.shown.add(kind);
      }
      ctx.draw();
    });
    tools.append(chip);
  }
  const pause = element(
    'button',
    { class: 'chip', 'aria-pressed': String(shell.paused) },
    shell.paused ? 'Resume' : 'Pause',
  );
  pause.addEventListener('click', () => {
    shell.paused = !shell.paused;
    // devtools-panel.ts skips redraws while paused on the log tab, so pausedAt matters on the others.
    work.pausedAt = shell.paused ? performance.now() : undefined;
    ctx.draw();
  });
  const clear = element('button', { class: 'chip' }, 'Clear');
  clear.addEventListener('click', () => {
    work.cleared = performance.now();
    state.log.length = 0;
    state.timeline.length = 0;
    work.selected = undefined;
    ctx.draw();
  });
  tools.append(element('span', { class: 'grow' }), pause, clear);
  return tools;
}

function toggleCall(ctx: DockContext, work: ActivityWork, entry: DevtoolsEntry): void {
  work.selected = work.selected === entry ? undefined : entry;
  ctx.draw();
}

function drawRow(ctx: DockContext, work: ActivityWork, row: Row): HTMLElement {
  const classes = ['ent'];
  if (row.child) {
    classes.push('child');
  }
  if (row.time > work.drawn && work.drawn >= 0) {
    classes.push('new');
  }
  const text = element(
    'span',
    { class: 'x' },
    ...(row.child ? [element('span', { class: 'faint' }, '└ ')] : []),
    element('span', { class: row.bad ? 'bad' : '' }, row.text),
  );
  if (row.sub) {
    text.append(' ', element('span', { class: `sub${row.bad ? ' bad' : ''}` }, row.sub));
  }
  const line = element(
    'div',
    {},
    element('span', { class: 't' }, seconds(row.time)),
    element(
      'span',
      { class: 'k' },
      element('i', { style: `background:${COLORS[row.kind]}` }),
      LABELS[row.kind],
    ),
    text,
    element('span', { class: 'd' }, row.d ?? ''),
  );
  const entry = row.call;
  if (entry) {
    classes.push('call');
    line.setAttribute('tabindex', '0');
    line.setAttribute('role', 'button');
    line.setAttribute('aria-current', String(entry === work.selected));
    line.addEventListener('click', () => toggleCall(ctx, work, entry));
    line.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleCall(ctx, work, entry);
      }
    });
  }
  line.className = classes.join(' ');
  return line;
}

function drawLogColumn(ctx: DockContext, work: ActivityWork, rows: Row[]): HTMLElement {
  const log = element('div', { class: 'log' });
  if (rows.length === 0) {
    log.append(element('div', { class: 'empty' }, 'Nothing yet. Use the page.'));
  }
  for (const row of rows) {
    log.append(drawRow(ctx, work, row));
  }
  log.addEventListener('scroll', () => {
    work.atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 8;
    work.scrollTop = log.scrollTop;
  });
  // Keeps the log at its end while it was there, as a console does, and else where it was.
  queueMicrotask(() => {
    log.scrollTop = work.atEnd ? log.scrollHeight : work.scrollTop;
  });
  return element('div', { class: 'act' }, drawFilters(ctx, work), drawStrip(rows), log);
}

function drawCloseIcon(): SVGElement {
  const node = svg('svg', {
    class: 'icon',
    viewBox: '0 0 24 24',
    width: 14,
    height: 14,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.8,
    'stroke-linecap': 'round',
    'aria-hidden': 'true',
  });
  node.innerHTML = '<path d="m6 6 12 12M18 6 6 18"/>';
  return node;
}

/** The detail pane: the module of the call detail, or what to do to get one. */
function drawDetail(ctx: DockContext, work: ActivityWork, into: HTMLElement): void {
  const entry = work.selected;
  if (!entry) {
    work.detail = undefined;
    into.replaceChildren(
      element('div', { class: 'empty' }, 'Select a server call to see what it sent and got back.'),
    );
    return;
  }
  const close = element('button', { class: 'act-close', 'aria-label': 'Close' }, drawCloseIcon());
  close.title = 'Close';
  close.addEventListener('click', () => {
    work.selected = undefined;
    ctx.draw();
  });
  // The detail keeps its own state (an armed button, an open section), so it draws again only when
  // the selection changes or the record of the call arrives.
  const timing = entry.call;
  const kept = work.detail;
  if (!kept || kept.entry !== entry || kept.timing !== timing || kept.record !== timing?.record) {
    const node = ctx.drawCallDetail(entry);
    node.classList.add('call-detail');
    work.detail = { entry, timing, record: timing?.record, node };
  }
  into.replaceChildren(close, work.detail!.node);
}

const ACTIVITY_STYLE = `
.act, .act-detail { --line2: #36333a; --pink: #ff9ecf; --sel: #ee7a3e14; --ring: #ee7a3e47; }
.split.activity > .list { width: 58%; padding: 0; gap: 0; }
.split.activity > .detail { position: relative; }
.panel.right .calld { width: auto; flex: 1; }
.act { flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100%; }
.act .tools { display: flex; align-items: center; gap: 4px; height: 38px; padding: 0 10px; border-bottom: 1px solid var(--line); flex: none; }
.act .grow { flex: 1; }
.act .chip { height: 24px; padding: 0 9px; border-radius: 7px; background: none; color: var(--faint); font: inherit; font-size: 11.5px; display: inline-flex; gap: 6px; align-items: center; }
.act .chip:hover { background: var(--hover); color: var(--dim); }
.act .chip[aria-pressed="true"] { color: var(--text); }
.act .chip i { width: 7px; height: 7px; border-radius: 2px; opacity: .35; }
.act .chip[aria-pressed="true"] i { opacity: 1; }
.strip { position: relative; height: 34px; margin: 0 14px; border-bottom: 1px solid var(--line); flex: none; }
.strip .tick { position: absolute; bottom: 8px; width: 2px; border-radius: 1px; }
.strip .rule { position: absolute; bottom: 0; height: 4px; width: 1px; background: var(--line2); }
.strip .rl { position: absolute; top: 2px; font: 10px var(--mono); color: var(--faint); transform: translateX(-50%); }
.act .log { flex: 1; overflow: auto; padding: 4px 6px; }
.ent { display: grid; grid-template-columns: 56px 82px minmax(0, 1fr) auto; gap: 10px; align-items: center; height: 28px; padding: 0 8px; border-radius: 7px; font: 11.5px var(--mono); }
.ent:hover { background: var(--hover); }
.ent .t { color: var(--faint); }
.ent .k { display: flex; align-items: center; gap: 6px; color: var(--dim); font-family: system-ui, sans-serif; font-size: 11.5px; }
.ent .k i { width: 7px; height: 7px; border-radius: 2px; }
.ent .x { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ent .x .sub { color: var(--faint); margin-right: 6px; }
.ent .d { color: var(--faint); }
.ent.child .k { visibility: hidden; }
.ent.call { cursor: pointer; }
.ent.call .x::after { content: "  details ›"; color: var(--faint); opacity: 0; transition: opacity .12s; }
.ent.call:hover .x::after, .ent.call:focus-visible .x::after { opacity: 1; }
.ent[aria-current="true"] { background: var(--sel); box-shadow: inset 0 0 0 1px var(--ring); }
.ent .bad { color: var(--red); }
.ent.new { animation: act-fresh .9s ease-out; }
@keyframes act-fresh { from { background: #ee7a3e1f; } to { background: transparent; } }
.act-close { position: absolute; top: 10px; right: 12px; width: 26px; height: 26px; padding: 0; display: grid; place-items: center; color: var(--dim); border-radius: 7px; }
`;

function drawActivity(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state, shell } = ctx;
  const work = readWork(shell);
  return loadComponents(state, listComponents(state)).then(() => {
    // The selected call may have left the log, such as when it was cleared.
    if (work.selected && !state.log.includes(work.selected)) {
      work.selected = undefined;
    }
    const rows: Row[] = [];
    for (const row of collectRows(state)) {
      if (
        row.time > work.cleared &&
        (work.pausedAt === undefined || row.time <= work.pausedAt) &&
        work.shown.has(row.kind)
      ) {
        rows.push(row);
      }
    }
    nestRows(state, rows);
    const shown = rows.slice(-MAX_ROWS);
    const { box, first, second } = ctx.split({ key: 'activity', min: [320, 280], start: 560 });
    box.classList.add('activity');
    second.classList.add('act-detail');
    first.append(drawLogColumn(ctx, work, shown));
    drawDetail(ctx, work, second);
    // The styles go in the shadow root once, so they are not part of the text of the body.
    if (!ctx.root.querySelector('style[data-activity]')) {
      ctx.root.append(element('style', { 'data-activity': '' }, ACTIVITY_STYLE));
    }
    into.replaceChildren(box);
    work.drawn = shown.at(-1)?.time ?? work.drawn;
  });
}

export const activity: Workspace = {
  id: 'activity',
  label: 'Activity',
  icon: 'log',
  // The old tab bar has one key per tab until dock-shell lands, and they all show the one log.
  tabs: {
    log: drawActivity,
    timeline: drawActivity,
    effects: drawActivity,
    navigation: drawActivity,
    server: drawActivity,
  },
  draw: drawActivity,
};
