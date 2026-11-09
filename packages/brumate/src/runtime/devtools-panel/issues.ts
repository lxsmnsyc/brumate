// The Issues workspace: the errors of the page.

import { icon, iconButton, element, pill } from './dom.ts';
import { seconds } from './format.ts';
import { codeView, frameUrls, mapFrames, parseFrames } from './stack.ts';
import { drawTabOf } from './workspace.ts';
import type { DockContext, Workspace } from './workspace.ts';

/** A button that opens a place of a file in the editor. */
function open(place: { file: string; line: number; column: number }): HTMLElement {
  const button = element(
    'button',
    { class: 'link', title: 'Open in the editor' },
    `${place.file.replace(/^.*\/(src|test|routes)\//, '$1/')}:${place.line}:${place.column}`,
    icon('open', 12),
  );
  button.addEventListener('click', () => {
    void fetch(
      `/__open-in-editor?file=${encodeURIComponent(`${place.file}:${place.line}:${place.column}`)}`,
    );
  });
  return button;
}

export async function drawErrors(ctx: DockContext, into: HTMLElement): Promise<void> {
  const { state, shell } = ctx;
  if (state.errors.length === 0) {
    into.replaceChildren(
      element('h2', {}, 'Errors'),
      element(
        'p',
        { class: 'sub' },
        'No errors. Errors of a render on the server, of Vite, such as a compile error after an edit, and of code in the browser show here.',
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
  } = ctx.split({ key: 'errors', min: [200, 300], start: 280 });
  for (const entry of state.errors.toReversed()) {
    const button = element(
      'button',
      { class: 'error-row', 'aria-current': String(entry === error) },
      element('span', { class: 'text' }, entry.message.split('\n')[0]!),
      element('span', { class: 'when' }, `${entry.source} · ${seconds(entry.time)}`),
    );
    button.addEventListener('click', () => {
      shell.selectedError = entry;
      shell.selectedFrame = -1;
      ctx.draw();
    });
    list.append(button);
  }
  const clear = iconButton('trash', 'Clear');
  clear.addEventListener('click', () => {
    state.errors.length = 0;
    state.errorCount?.();
    ctx.draw();
  });
  list.append(element('div', { style: 'margin-top: 8px' }, clear));

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
  detail.append(
    element('pre', { class: 'error-message' }, error.message),
    element(
      'div',
      { class: 'toolbar' },
      pill(error.source, error.source === 'browser' ? 'yellow' : 'red'),
      error.plugin ? pill(`plugin ${error.plugin}`) : '',
      place && !('url' in place && place.url) ? open(place) : '',
    ),
  );
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
    detail.append(element('h3', {}, 'Stack'), stack);
  }
  into.replaceChildren(box);
}

export const issues: Workspace = {
  id: 'issues',
  label: 'Issues',
  icon: 'errors',
  tabs: { errors: drawErrors },
  draw: (ctx, into) => drawTabOf(issues.tabs, ctx, into),
};
