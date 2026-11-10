// The detail of a server call, for the Log of the Activity workspace.

import type { Scope } from '../client.ts';
import type {
  CallRecord,
  CallTiming,
  DevtoolsEntry,
  DevtoolsState,
  Interaction,
} from '../devtools.ts';
import { element, icon } from './dom.ts';
import { copyText, cutLong, writeForAgent } from './copy.ts';
import { ms } from './format.ts';
import { codeView, frameUrls, mapFrames, parseFrames } from './stack.ts';
import type { Frame } from './stack.ts';
import type { DockContext } from './workspace.ts';

/** The longest wait for the writes that the result made, after the answer. */
const AFTER_MS = 300;
const DEPTH_LIMIT = 8;
const PHASES = [
  ['module', 'var(--faint)'],
  ['network', 'var(--blue)'],
  ['server', 'var(--pink)'],
  ['decode', 'var(--green)'],
] as const;

// Copied from the prototype. The variables are local to `.calld`, since `style.ts` is dock-shell's;
// they are the prototype's values for the ones the panel does not define yet.
const STYLE = `
.calld { --bg2: #161517; --line2: #36333a; --pink: #ff8fc8; width: 440px; flex: none; padding: 16px 20px 20px; min-width: 0; }
.calld .title { display: flex; align-items: center; gap: 10px; }
.calld .title h3 { margin: 0; font: 600 14px var(--mono); color: var(--text); text-transform: none; letter-spacing: 0; }
.calld .sec { margin: 22px 0 8px; display: flex; align-items: baseline; gap: 8px; font-size: 11px; font-weight: 600; color: var(--faint); }
.calld .sec .n { font: 10.5px var(--mono); font-weight: 400; }
.calld .from { color: var(--dim); margin-top: 6px; }
.calld .from .link-button { color: var(--text); cursor: pointer; text-decoration: underline; text-decoration-color: var(--line2); text-underline-offset: 3px; padding: 0; border: 0; background: none; font: inherit; }
.calld .from .link-button:hover { text-decoration-color: var(--accent); }
.calld .val { font: 11.5px/1.8 var(--mono); background: var(--bg2); border-radius: 8px; padding: 8px 12px; box-shadow: inset 0 0 0 1px var(--line); overflow: auto; }
.calld .val details > div, .calld .val details > details { margin-left: 16px; }
.calld .val summary { cursor: pointer; list-style: none; }
.calld .val summary::-webkit-details-marker { display: none; }
.calld .val summary::before { content: '›'; display: inline-block; width: 12px; color: var(--faint); transition: transform 0.15s; }
.calld .val details[open] > summary::before { transform: rotate(90deg); }
.calld .kk { color: #ffc28f; }
.calld .str { color: var(--green); } .calld .num { color: var(--blue); } .calld .bool { color: var(--purple); } .calld .nil { color: var(--faint); }
.calld .tbar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; gap: 2px; margin: 4px 0 10px; }
.calld .leg { display: flex; gap: 14px; flex-wrap: wrap; color: var(--dim); font: 11px var(--mono); }
.calld .leg i { display: inline-block; width: 7px; height: 7px; border-radius: 2px; margin-right: 6px; }
.calld .lines { font: 11.5px/1.95 var(--mono); }
.calld .lines .faint { display: inline-block; width: 56px; color: var(--faint); }
.calld .lines .warn { color: var(--yellow); }
.calld .errline { color: var(--red); }
.calld .acts { margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap; }
.calld .btn { height: 28px; padding: 0 12px; border-radius: 8px; background: var(--raised); box-shadow: inset 0 0 0 1px var(--line2); display: inline-flex; gap: 7px; align-items: center; font-weight: 500; transition: background 0.12s, box-shadow 0.12s; }
.calld .btn:hover { background: var(--hover); box-shadow: inset 0 0 0 1px #4a464f; }
.calld .btn.pri { background: var(--text); color: #121113; box-shadow: none; }
.calld .btn.pri:hover { background: #fff; }
.calld .btn.warn { background: #ffd1661a; color: var(--yellow); box-shadow: inset 0 0 0 1px #ffd16655; }
.calld .note { color: var(--yellow); font-size: 11.5px; margin-top: 8px; }
.calld .dim { color: var(--dim); }
.calld .frames { margin: 6px 0; }
`;

/** The call of an entry, with the interaction that made it. */
export function findOwner(state: DevtoolsState, call: CallTiming): Interaction | undefined {
  for (const run of state.timeline) {
    if (run.calls.includes(call)) {
      return run;
    }
  }
  return undefined;
}

/** The root scope of the component whose handler made the call, if the page still has it. */
function findCaller(state: DevtoolsState, run: Interaction): Scope | undefined {
  const component = run.ref.split('#')[0];
  for (const scope of state.scopes?.values() ?? []) {
    if (scope.m === component && !scope.p) {
      return scope;
    }
  }
  return undefined;
}

/** The writes that the result of a call made, from the log: the lines of the first moments after the answer. */
export function findWrites(state: DevtoolsState, call: CallTiming): string[] {
  const writes: string[] = [];
  if (call.end === undefined) {
    return writes;
  }
  for (const entry of state.log) {
    if (entry.kind === 'write' && entry.time >= call.end && entry.time <= call.end + AFTER_MS) {
      writes.push(entry.text);
    }
  }
  return writes;
}

/** The phases of the timing, with the total. */
function readPhases(record: CallRecord): { name: string; color: string; time: number }[] {
  const phases: { name: string; color: string; time: number }[] = [];
  for (const [name, color] of PHASES) {
    phases.push({ name, color, time: record.timing[name] });
  }
  return phases;
}

/** The `fetch` call that repeats a call, without cookies and without headers that are not the protocol's. */
export function writeFetch(call: CallTiming): string | undefined {
  const request = call.request;
  if (!request) {
    return undefined;
  }
  const url = JSON.stringify(request.url);
  const body = request.body;
  if (body instanceof FormData) {
    const lines = ['const body = new FormData();'];
    for (const [name, value] of body) {
      if (typeof value === 'string') {
        lines.push(`body.set(${JSON.stringify(name)}, ${JSON.stringify(value)});`);
      } else {
        lines.push(
          `// ${JSON.stringify(name)}: the file ${JSON.stringify(value.name)} (${value.size} bytes), attach it here`,
        );
      }
    }
    const header = request.headers['x-brumate-args'];
    lines.push(
      `await fetch(${url}, { method: 'POST', ${header ? `headers: { 'x-brumate-args': ${JSON.stringify(header)} }, ` : ''}body });`,
    );
    return lines.join('\n');
  }
  // A blob sends the JSON type by itself, so no header is written.
  const json = typeof body === 'string' ? JSON.stringify(body) : undefined;
  return `await fetch(${url}, {\n  method: 'POST',\n${json ? `  body: new Blob([${json}], { type: 'application/json' }),\n` : ''}});`;
}

/** A value in the tree: texts, numbers and the like in a colour, lists and objects that fold. */
function drawValue(value: unknown, depth = 0): HTMLElement {
  if (typeof value === 'string') {
    return element('span', { class: 'str' }, JSON.stringify(cutLong(value)));
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return element('span', { class: 'num' }, String(value));
  }
  if (typeof value === 'boolean') {
    return element('span', { class: 'bool' }, String(value));
  }
  if (value === null || value === undefined) {
    return element('span', { class: 'nil' }, String(value));
  }
  if (value instanceof Date) {
    return element('span', { class: 'str' }, value.toISOString());
  }
  let entries: [string, unknown][];
  let label: string;
  if (Array.isArray(value) || value instanceof Set) {
    entries = [];
    for (const [index, item] of [...value].entries()) {
      entries.push([String(index), item]);
    }
    label = `${value instanceof Set ? 'Set' : 'Array'}(${entries.length})`;
  } else if (value instanceof Map) {
    entries = [];
    for (const [key, item] of value) {
      entries.push([String(key), item]);
    }
    label = `Map(${value.size})`;
  } else if (typeof value === 'object') {
    entries = Object.entries(value);
    label = `{${entries.length}}`;
  } else {
    return element('span', { class: 'nil' }, String(value));
  }
  if (entries.length === 0 || depth >= DEPTH_LIMIT) {
    return element('span', { class: 'nil' }, entries.length === 0 ? label : '…');
  }
  const details = element('details', {}, element('summary', {}, label));
  details.open = depth < 2;
  for (const [key, item] of entries) {
    details.append(
      element('div', {}, element('span', { class: 'kk' }, `${key}: `), drawValue(item, depth + 1)),
    );
  }
  return details;
}

/** A button that opens a place of a file in the editor. */
function openInEditor(frame: Frame): HTMLElement {
  const button = element(
    'button',
    { class: 'link', title: 'Open in the editor' },
    `${frame.file.replace(/^.*\/(src|test|routes)\//, '$1/')}:${frame.line}:${frame.column}`,
    icon('open', 12),
  );
  button.addEventListener('click', () => {
    void fetch(
      `/__open-in-editor?file=${encodeURIComponent(`${frame.file}:${frame.line}:${frame.column}`)}`,
    );
  });
  return button;
}

/** Marks a frame of the list as the chosen one, and shows its code. */
async function showFrame(
  list: HTMLElement,
  code: HTMLElement,
  frame: Frame,
  button: Element,
): Promise<void> {
  for (const other of list.children) {
    other.setAttribute('aria-current', String(other === button));
  }
  code.replaceChildren(await codeView(frame));
}

/** Fills the box with the frames of the app, a count of the others, and the code of the chosen frame. */
async function fillStack(box: HTMLElement, stack: string): Promise<void> {
  const frames = await mapFrames(parseFrames(stack), frameUrls(stack));
  const own: Frame[] = [];
  for (const frame of frames) {
    if (!frame.library) {
      own.push(frame);
    }
  }
  const list = element('div', { class: 'frames lines' });
  const code = element('div');
  for (const frame of own) {
    const button = element(
      'button',
      { class: 'frame dim', 'aria-current': 'false', title: 'Show this code' },
      element('span', { class: 'fn' }, frame.fn),
      element('span', { class: 'where' }, `${frame.file}:${frame.line}:${frame.column}`),
    );
    button.addEventListener('click', () => void showFrame(list, code, frame, button));
    list.append(button);
  }
  box.replaceChildren(list);
  if (own.length < frames.length) {
    box.append(
      element('div', { class: 'dim' }, `${frames.length - own.length} frames of libraries hidden`),
    );
  }
  if (own[0]) {
    box.append(openInEditor(own[0]), code);
    await showFrame(list, code, own[0], list.children[0]!);
  }
}

/** The stack of the server error, which fills in once the frames are mapped. */
function drawStack(stack: string | undefined): HTMLElement {
  const box = element('div');
  if (stack) {
    fillStack(box, stack).catch(() => {
      box.replaceChildren(element('div', { class: 'dim' }, 'Could not read the code.'));
    });
  }
  return box;
}

/** A section with a heading, hidden by its caller when it has no data. */
function drawSection(title: string, note: string | undefined, ...children: Node[]): HTMLElement {
  const heading = element('div', { class: 'sec' }, title);
  if (note) {
    heading.append(element('span', { class: 'n' }, note));
  }
  const section = element('div', {}, heading);
  section.append(...children);
  return section;
}

/** Switches Run again between asking and ready: the warning note and Cancel show while it asks. */
function armRun(run: HTMLElement, cancel: HTMLElement, note: HTMLElement, on: boolean): void {
  run.textContent = on ? 'Run it again' : 'Run again';
  run.className = `btn ${on ? 'warn' : 'pri'}`;
  note.hidden = !on;
  cancel.hidden = !on;
}

/** Draws the detail of a server call, from the record of its entry. */
export function drawCallDetail(ctx: DockContext, entry: DevtoolsEntry): HTMLElement {
  const call = entry.call;
  const root = element('div', { class: 'calld' }, element('style', {}, STYLE));
  if (!call) {
    root.append(element('div', { class: 'empty' }, 'No details for this call.'));
    return root;
  }
  const { state } = ctx;
  const record = call.record;
  const owner = findOwner(state, call);
  const from = owner?.label;
  const writes = findWrites(state, call);
  let total = call.end === undefined ? 0 : Math.round(call.end - call.start);
  if (record) {
    total = 0;
    for (const phase of readPhases(record)) {
      total += phase.time;
    }
  }

  // The title: the function, how it answered and how long it took.
  const failed =
    call.status === 'failed' || (typeof call.status === 'number' && call.status >= 400);
  root.append(
    element(
      'div',
      { class: 'title' },
      element('h3', {}, `${call.name}()`),
      element(
        'span',
        { class: `pill ${failed ? 'red' : 'green'}` },
        String(call.status ?? 'pending'),
      ),
      element('span', { class: 'dim' }, ms(total)),
    ),
  );
  if (owner) {
    // A link to the component of the handler when the page still has it.
    const caller = findCaller(state, owner);
    const line = element('div', { class: 'from' }, 'Called by ');
    if (caller) {
      const link = element('button', { class: 'link-button' }, owner.label);
      link.addEventListener('click', () => {
        ctx.shell.selectedScope = caller.id;
        ctx.select('inspect');
      });
      line.append(link);
    } else {
      line.append(owner.label);
    }
    root.append(line);
  }

  if (record) {
    // The arguments and the result, or the error of the server.
    if (record.args.length > 0) {
      const values = element('div', { class: 'val' });
      for (const [index, arg] of record.args.entries()) {
        values.append(
          element('div', {}, element('span', { class: 'kk' }, `${index}: `), drawValue(arg)),
        );
      }
      root.append(drawSection('Arguments', undefined, values));
    }
    if (record.error) {
      root.append(
        drawSection(
          'Error on the server',
          undefined,
          element(
            'div',
            { class: 'lines' },
            element('div', { class: 'errline' }, cutLong(record.error.message)),
            drawStack(record.error.stack),
          ),
        ),
      );
    } else if ('result' in record) {
      root.append(
        drawSection(
          'Result',
          undefined,
          element('div', { class: 'val' }, drawValue(record.result)),
        ),
      );
    }

    // The timing as a bar of its four phases.
    const bar = element('div', { class: 'tbar' });
    const legend = element('div', { class: 'leg' });
    for (const phase of readPhases(record)) {
      bar.append(
        element('span', { style: `flex: ${phase.time || 0.2}; background: ${phase.color}` }),
      );
      legend.append(
        element(
          'span',
          {},
          element('i', { style: `background: ${phase.color}` }),
          `${phase.name} ${ms(phase.time)}`,
        ),
      );
    }
    root.append(drawSection('Timing', ms(total), bar, legend));

    // What ran on the server. The dev server sends it, so a call without it shows nothing.
    const ran = record.server;
    if (ran && (ran.reads.length > 0 || ran.calls.length > 0 || ran.logs.length > 0)) {
      const lines = element('div', { class: 'lines' });
      for (const id of ran.reads) {
        lines.append(element('div', {}, element('span', { class: 'faint' }, 'read'), id));
      }
      for (const id of ran.calls) {
        lines.append(element('div', {}, element('span', { class: 'faint' }, 'called'), id));
      }
      for (const log of ran.logs) {
        lines.append(
          element(
            'div',
            {},
            element('span', { class: 'faint' }, log.level),
            element('span', { class: log.level }, cutLong(log.text)),
          ),
        );
      }
      if (ran.truncated) {
        lines.append(element('div', { class: 'dim' }, 'Some output was left out to fit.'));
      }
      root.append(drawSection('On the server', undefined, lines));
    }
  }

  // What the result changed on the page.
  if (writes.length > 0) {
    const lines = element('div', { class: 'lines' });
    for (const text of writes) {
      lines.append(element('div', {}, text));
    }
    root.append(drawSection('After the call', undefined, lines));
  }

  // The actions. Run again asks first, since the function may have side effects.
  const run = element('button', { class: 'btn pri' }, 'Run again');
  const cancel = element('button', { class: 'btn', hidden: '' }, 'Cancel');
  const fetchButton = element('button', { class: 'btn' }, 'Copy as fetch');
  const agentButton = element('button', { class: 'btn' }, 'Copy for an agent');
  const note = element(
    'div',
    { class: 'note', hidden: '' },
    `Runs ${call.name}() on the server with the same arguments. Its side effects happen again.`,
  );
  if (!call.request) {
    run.disabled = true;
    run.title = 'The request was not kept';
  }
  run.addEventListener('click', () => {
    if (note.hidden) {
      armRun(run, cancel, note, true);
      return;
    }
    armRun(run, cancel, note, false);
    const request = call.request;
    if (request) {
      // The page's own fetch records it as a new call in the log.
      void fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        ...(request.body === undefined ? {} : { body: request.body }),
      }).catch(() => {});
      run.textContent = 'Ran';
      setTimeout(() => {
        run.textContent = 'Run again';
      }, 1200);
    }
  });
  cancel.addEventListener('click', () => armRun(run, cancel, note, false));
  copyText(fetchButton, () => writeFetch(call));
  copyText(agentButton, () => writeForAgent(call, from, writes));
  root.append(element('div', { class: 'acts' }, run, cancel, fetchButton, agentButton), note);
  return root;
}
