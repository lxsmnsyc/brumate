// The Issues workspace: the errors of the page, as the prototype draws them. The list is on one
// side, the code, the stack and the actions of the selected issue on the other.

import type * as ErrorCatalog from '../../error-catalog.ts';
import type { ErrorEntry } from '../devtools.ts';
import { icon, element } from './dom.ts';
import { seconds } from './format.ts';
import { codeView, frameUrls, mapFrames, parseFrames } from './stack.ts';
import { drawTabOf } from './workspace.ts';
import type { DockContext, Workspace } from './workspace.ts';

const ISSUES_STYLE = `
.issues { --sel: #ee7a3e14; --ring: #ee7a3e47; }
.issues > .list { padding: 8px; gap: 2px; }
.issues .iss { display: block; width: 100%; text-align: left; padding: 9px 10px; border-radius: 8px; transition: background .12s; }
.issues .iss:hover { background: var(--hover); }
.issues .iss[aria-current="true"] { background: var(--sel); box-shadow: inset 0 0 0 1px var(--ring); }
.issues .iss .src { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--faint); }
.issues .iss .src i { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.issues .iss .msg { display: block; margin-top: 3px; font-weight: 500; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.issues .iss .at { display: block; margin-top: 2px; font: 11px var(--mono); color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.issues > .detail { padding: 14px; overflow: auto; }
.issues .title { margin: 0 0 4px; font: 600 14px/1.4 var(--mono); color: var(--text); white-space: pre-wrap; }
.issues .code { margin: 14px 0 0; border: 0; border-radius: 10px; background: #0d0c0e; box-shadow: inset 0 0 0 1px var(--line); }
.issues .sec { margin: 16px 0 6px; color: var(--faint); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.issues .frame[aria-current="true"] { background: var(--sel); box-shadow: inset 0 0 0 1px var(--ring); }
.issues .frame[aria-current="true"] .fn { color: var(--text); }
.issues .acts { margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap; }
.issues .btn { height: 28px; padding: 0 12px; border-radius: 8px; background: var(--raised); box-shadow: inset 0 0 0 1px var(--line); font-weight: 500; }
.issues .btn:hover { background: var(--hover); }
.issues .btn.pri { background: var(--text); color: #121113; box-shadow: none; }
.issues .btn.pri:hover { background: #fff; }
.issues .hint { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: #161517; color: var(--dim); }
.issues .hint b { color: var(--text); font-weight: 500; }
.issues .hint a { color: var(--accent); margin-left: 6px; }
.issues .iss .src .mono { font-family: var(--mono); }
`;

function openInEditor(place: { file: string; line: number; column: number }): void {
  void fetch(
    `/__open-in-editor?file=${encodeURIComponent(`${place.file}:${place.line}:${place.column}`)}`,
  );
}

/** A button that opens a place of a file in the editor. */
function open(place: { file: string; line: number; column: number }): HTMLElement {
  const button = element(
    'button',
    { class: 'link', title: 'Open in the editor' },
    `${place.file.replace(/^.*\/(src|test|routes)\//, '$1/')}:${place.line}:${place.column}`,
    icon('open', 12),
  );
  button.addEventListener('click', () => openInEditor(place));
  return button;
}

type Catalog = typeof ErrorCatalog;

// The catalog of compile errors is large, so it loads with the first issue, as the highlighter does.
let catalog: Promise<Catalog> | undefined;

/** The code of an issue, such as BRM012, from its message or from the catalog. */
function readCode(entry: ErrorEntry, found: Catalog | undefined): string | undefined {
  return /\[(BRM\d+)\]$/.exec(entry.message)?.[1] ?? found?.findError(entry.message)?.code;
}

/** The key of an issue that stays the same when a newer one arrives. */
function makeIssueKey(entry: ErrorEntry, entries: ErrorEntry[]): string {
  let same = 0;
  for (const other of entries) {
    if (other === entry) {
      break;
    }
    if (other.time === entry.time) {
      same++;
    }
  }
  return `issue:${entry.time}:${same}`;
}

/** The label, dot colour and kind of an issue, as the prototype names them. */
function describe(source: ErrorEntry['source']): { label: string; color: string } {
  if (source === 'browser') {
    return { label: 'Browser error', color: 'var(--red)' };
  }
  if (source === 'compile') {
    return { label: 'Compiler check', color: 'var(--yellow)' };
  }
  return { label: 'Server error', color: 'var(--red)' };
}

/** Where an issue happened, short enough for a row. */
function locate(entry: ErrorEntry): string {
  if (entry.loc) {
    return `${entry.loc.file.replace(/^.*\/(src|test|routes)\//, '$1/')}:${entry.loc.line}:${entry.loc.column}`;
  }
  return seconds(entry.time);
}

/** The text of an issue for a person or an agent to read. */
function writeIssue(entry: ErrorEntry): string {
  const lines = [`${describe(entry.source).label}: ${entry.message}`];
  if (entry.loc) {
    lines.push(`at ${entry.loc.file}:${entry.loc.line}:${entry.loc.column}`);
  }
  if (entry.frame) {
    lines.push('', entry.frame);
  }
  if (entry.stack) {
    lines.push('', entry.stack);
  }
  return lines.join('\n');
}

/** Keeps the keyboard focus on the same row after the workspace draws again. */
function focusAgain(into: HTMLElement, key: string | undefined): void {
  if (key === undefined) {
    return;
  }
  for (const item of into.querySelectorAll<HTMLElement>('[data-key]')) {
    if (item.dataset.key === key) {
      item.focus();
      return;
    }
  }
}

export async function drawErrors(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state, shell } = ctx;
  // The styles go in the shadow root once, so they are not part of the text of the body.
  if (!ctx.root.querySelector('style[data-issues]')) {
    ctx.root.append(element('style', { 'data-issues': '' }, ISSUES_STYLE));
  }
  const active = ctx.root.activeElement;
  const focused = active instanceof HTMLElement && into.contains(active) ? active : undefined;
  if (state.errors.length === 0) {
    into.replaceChildren(
      element('h2', {}, 'Issues'),
      element(
        'p',
        { class: 'sub' },
        'No issues. Errors of a render on the server, of Vite, such as a compile error after an edit, and of code in the browser show here.',
      ),
    );
    return;
  }
  if (!shell.selectedError || !state.errors.includes(shell.selectedError)) {
    shell.selectedError = state.errors.at(-1);
    shell.selectedFrame = -1;
  }
  const error = shell.selectedError!;
  const {
    box,
    first: list,
    second: detail,
  } = ctx.split({
    key: 'errors',
    min: [200, 300],
    start: 280,
  });
  box.classList.add('issues');
  // Without the catalog the code and the hint are left out.
  let found: Catalog | undefined;
  try {
    found = await (catalog ??= import('../../error-catalog.ts'));
  } catch {
    catalog = undefined;
  }
  const entries = state.errors.toReversed();
  for (const entry of entries) {
    const { label, color } = describe(entry.source);
    const code = readCode(entry, found);
    const button = element(
      'button',
      {
        class: 'iss',
        'data-key': makeIssueKey(entry, entries),
        'aria-current': String(entry === error),
      },
      element(
        'span',
        { class: 'src' },
        element('i', { style: `background: ${color}` }),
        label,
        code ? ' · ' : '',
        code ? element('span', { class: 'mono' }, code) : '',
      ),
      element('span', { class: 'msg' }, entry.message.split('\n')[0]!),
      element('span', { class: 'at' }, locate(entry)),
    );
    button.addEventListener('click', () => {
      shell.selectedError = entry;
      shell.selectedFrame = -1;
      ctx.draw();
    });
    list.append(button);
  }
  // The arrow keys move the selection, and the row keeps the focus when it is drawn again.
  list.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    const at = entries.indexOf(shell.selectedError!);
    event.preventDefault();
    if (at === -1) {
      return;
    }
    const next = entries[at + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
      shell.selectedError = next;
      shell.selectedFrame = -1;
      // The draw is async; the focus moves once the new rows are in.
      shell.work.issues = { focus: makeIssueKey(next, entries) };
      ctx.draw();
    }
  });

  // The place to show: a frame that was clicked, the place of a compile error, or the first
  // frame of the app's code.
  const frames = await mapFrames(parseFrames(error.stack), frameUrls(error.stack));
  if (shell.selectedFrame === -1) {
    shell.selectedFrame = -2;
    if (!error.loc) {
      // The first frame of the app's code, or -1 when there is none.
      shell.selectedFrame = -1;
      for (const [index, item] of frames.entries()) {
        if (!item.library && !item.compiled) {
          shell.selectedFrame = index;
          break;
        }
      }
    }
  }
  const frame = shell.selectedFrame >= 0 ? frames[shell.selectedFrame] : undefined;
  const place = shell.selectedFrame === -2 ? error.loc : frame;
  const editable = place && !('url' in place && place.url) ? place : undefined;
  detail.append(element('h3', { class: 'title' }, error.message));
  if (editable) {
    detail.append(open(editable));
  }
  if (place) {
    detail.append(await codeView(place, error.frame));
  } else if (error.frame) {
    detail.append(
      element('div', { class: 'code' }, element('pre', { class: 'plain' }, error.frame)),
    );
  }
  if (frames.length > 0) {
    const stack = element('div', { class: 'frames' });
    for (const [index, item] of frames.entries()) {
      const button = element(
        'button',
        {
          class: `frame${item.library ? ' library' : ''}`,
          'data-key': `frame:${index}`,
          'aria-current': String(index === shell.selectedFrame),
          title: item.compiled ? 'The lines of code that the browser ran' : 'Show this code',
        },
        element('span', { class: 'fn' }, item.fn),
        element('span', { class: 'where' }, `${item.file}:${item.line}:${item.column}`),
      );
      button.addEventListener('click', () => {
        shell.selectedFrame = index;
        ctx.draw();
      });
      stack.append(button);
    }
    detail.append(element('div', { class: 'sec' }, 'Stack'), stack);
  }

  const hint = found?.findError(error.message);
  if (hint) {
    const note = element('div', { class: 'hint' }, element('b', {}, hint.cause));
    if (hint.link) {
      note.append(element('a', { href: hint.link, target: '_blank', rel: 'noopener' }, 'Docs'));
    }
    detail.append(note);
  }

  const actions = element('div', { class: 'acts' });
  if (editable) {
    const edit = element('button', { class: 'btn pri' }, 'Open in editor');
    edit.addEventListener('click', () => openInEditor(editable));
    actions.append(edit);
  }
  const copy = element('button', { class: 'btn' }, 'Copy for an agent');
  copy.addEventListener('click', () => {
    void navigator.clipboard?.writeText(writeIssue(error));
  });
  actions.append(copy);
  if (error.source === 'browser') {
    const show = element('button', { class: 'btn' }, 'Show in Activity');
    show.addEventListener('click', () => ctx.select('activity', 'log'));
    actions.append(show);
  }
  detail.append(actions);

  into.replaceChildren(box);
  const wanted = shell.work.issues as { focus?: string } | undefined;
  focusAgain(into, wanted?.focus ?? focused?.dataset.key);
  shell.work.issues = {};
}

export const issues: Workspace = {
  id: 'issues',
  label: 'Issues',
  icon: 'errors',
  tabs: { errors: drawErrors },
  draw: (ctx, into) => drawTabOf(issues.tabs, ctx, into),
};
