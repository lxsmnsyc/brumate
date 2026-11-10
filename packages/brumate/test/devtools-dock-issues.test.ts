// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { installDevtools } from '../src/runtime/devtools.ts';
import { reportError } from '../src/runtime/devtools.ts';
import { findError } from '../src/error-catalog.ts';
import { togglePanel } from '../src/runtime/devtools-panel.ts';

function open(): { state: ReturnType<typeof installDevtools>; shadow: ShadowRoot } {
  document.querySelector('brumate-devtools')?.remove();
  document.body.innerHTML = '';
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).startsWith('/__brumate/source')
      ? new Response('<script>\n  const a = 1;\n  throw new Error("Boom");\n</script>\n')
      : Response.json({})) as typeof fetch;
  const state = installDevtools('/inspect', '/_brumate', { version: '1.2.3', vite: '8.0.0' });
  const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
  return { state, shadow };
}

function rows(shadow: ShadowRoot): HTMLElement[] {
  return [...shadow.querySelectorAll<HTMLElement>('.iss')];
}

describe('the Issues workspace', () => {
  it('lists the issues with a filled selected row, and shows the code of the selected one', async () => {
    const { state, shadow } = open();
    reportError(
      state,
      { message: 'In the browser', stack: 'Error\n    at f (http://localhost:3000/src/a.ts:1:1)' },
      'browser',
    );
    reportError(
      state,
      {
        message: 'Declare $signal with let',
        plugin: 'brumate',
        frame: '> 3 |   throw',
        loc: { file: '/app/src/Page.brm', line: 3, column: 3 },
      },
      'server',
    );
    await expect.poll(() => shadow.querySelector('.panel')).not.toBeNull();
    await expect.poll(() => rows(shadow).length).toBe(2);
    // The newest is selected, and the list names the kind of each.
    expect(rows(shadow)[0]!.getAttribute('aria-current')).toBe('true');
    expect(rows(shadow)[0]!.textContent).toContain('Compiler check');
    expect(rows(shadow)[0]!.textContent).toContain('src/Page.brm:3:3');
    expect(rows(shadow)[1]!.textContent).toContain('Browser error');
    await expect
      .poll(() => shadow.querySelector('.code .error-line')?.textContent)
      .toContain('throw');
    const text = shadow.querySelector('.issues .detail')!.textContent!;
    expect(text).toContain('Open in editor');
    expect(text).toContain('Copy for an agent');
    expect(text).not.toContain('Show in Activity');
    // The badge on the nav counts the issues.
    expect(shadow.querySelector('[data-tab="errors"] .badge')!.textContent).toBe('2');

    rows(shadow)[1]!.click();
    await expect.poll(() => rows(shadow)[1]!.getAttribute('aria-current')).toBe('true');
    await expect
      .poll(() => shadow.querySelector('.issues .detail')!.textContent)
      .toContain('Show in Activity');
    // The old Clear button and the coloured left edge are gone.
    expect(shadow.querySelector('.issues .tool')).toBeNull();
    togglePanel(shadow, state);
  });

  it('keeps the focus on the selected row when the arrow keys move it', async () => {
    const { state, shadow } = open();
    reportError(state, { message: 'First' }, 'server');
    reportError(state, { message: 'Second' }, 'server');
    await expect.poll(() => rows(shadow).length).toBe(2);
    rows(shadow)[0]!.focus();
    rows(shadow)[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    await expect.poll(() => rows(shadow)[1]!.getAttribute('aria-current')).toBe('true');
    await expect.poll(() => shadow.activeElement).toBe(rows(shadow)[1]);
    // A click redraws, and the row keeps the focus too.
    rows(shadow)[0]!.focus();
    rows(shadow)[0]!.click();
    await expect.poll(() => rows(shadow)[0]!.getAttribute('aria-current')).toBe('true');
    await expect.poll(() => shadow.activeElement).toBe(rows(shadow)[0]);
    togglePanel(shadow, state);
  });

  it('shows the code and the cause of a compile error from the catalog, with a stable focus key', async () => {
    const { state, shadow } = open();
    const message = 'The module script cannot have a default export';
    const entry = findError(message)!;
    reportError(state, { message }, 'server');
    await expect.poll(() => rows(shadow).length).toBe(1);
    expect(rows(shadow)[0]!.textContent).toContain(entry.code);
    await expect
      .poll(() => shadow.querySelector('.issues .hint')?.textContent)
      .toContain(entry.cause);
    expect(shadow.querySelector('.issues .hint a')!.getAttribute('href')).toBe(entry.link);
    const before = rows(shadow)[0]!.dataset.key;
    reportError(state, { message: 'Newer' }, 'server');
    await expect.poll(() => rows(shadow).length).toBe(2);
    expect(rows(shadow)[1]!.dataset.key).toBe(before);
    togglePanel(shadow, state);
  });
});
