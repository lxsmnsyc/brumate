// The tests of Toolbar, ToggleButtonGroup, Breadcrumbs, Meter, ProgressBar and FileTrigger.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Toolbars from './fixtures/toolbars.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

async function toolbars() {
  const page = await mount(Toolbars, {});
  unmount = page.unmount;
  return page;
}

it('moves focus with the arrow keys, Home and End, and keeps one item in the order of Tab', async () => {
  const page = await toolbars();
  const toolbar = page.get('.tools');
  expect(toolbar.getAttribute('role')).toBe('toolbar');
  expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');
  const cut = page.get('.cut') as HTMLElement;
  cut.focus();
  await page.waitFor(() => expect(page.get('.copy').getAttribute('tabindex')).toBe('-1'));
  press('ArrowRight', cut);
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.copy')));
  expect(page.get('.copy').getAttribute('tabindex')).toBe('0');
  expect(cut.getAttribute('tabindex')).toBe('-1');
  press('End');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.paste')));
  // The last item stays the last.
  press('ArrowRight');
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(document.activeElement).toBe(page.get('.paste'));
  press('Home');
  await page.waitFor(() => expect(document.activeElement).toBe(cut));
});

it('turns the arrow keys around right to left', async () => {
  const page = await toolbars();
  const first = page.get('.first') as HTMLElement;
  first.focus();
  press('ArrowLeft', first);
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.second')));
});

it('selects one button of a group as radios, and keeps one selected', async () => {
  const page = await toolbars();
  const group = page.get('.align');
  expect(group.getAttribute('role')).toBe('radiogroup');
  const left = page.get('.left');
  const center = page.get('.center');
  expect(left.getAttribute('role')).toBe('radio');
  expect(left.getAttribute('aria-checked')).toBe('true');
  expect(left.hasAttribute('aria-pressed')).toBe(false);
  pressWith(center);
  await page.waitFor(() => expect(page.text('.keys')).toBe('center|'));
  expect(center.getAttribute('aria-checked')).toBe('true');
  expect(left.getAttribute('aria-checked')).toBe('false');
  // disallowEmptySelection keeps the last one.
  pressWith(center);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(page.text('.keys')).toBe('center|');
});

it('selects several buttons of a group as a toolbar', async () => {
  const page = await toolbars();
  expect(page.get('.styles').getAttribute('role')).toBe('toolbar');
  pressWith(page.get('.bold'));
  await page.waitFor(() => expect(page.text('.keys')).toBe('left|bold'));
  pressWith(page.get('.italic'));
  await page.waitFor(() => expect(page.text('.keys')).toBe('left|bold,italic'));
  expect(page.get('.italic').getAttribute('aria-pressed')).toBe('true');
  pressWith(page.get('.bold'));
  await page.waitFor(() => expect(page.text('.keys')).toBe('left|italic'));
});

it('marks the current step of the trail', async () => {
  const page = await toolbars();
  expect(page.get('.trail').tagName).toBe('OL');
  expect(page.get('.here').getAttribute('aria-current')).toBe('page');
  expect(page.get('.here').closest('li')!.hasAttribute('data-current')).toBe(true);
  expect(page.get('.home').hasAttribute('aria-current')).toBe(false);
  // The current step is disabled, so its link does not load the page that is open.
  expect(page.get('.here').hasAttribute('href')).toBe(false);
  expect(page.get('.here').closest('li')!.hasAttribute('data-disabled')).toBe(true);
});

it('gives a Meter and a ProgressBar their values, range, text and label', async () => {
  const page = await toolbars();
  const disk = page.get('.disk');
  expect(disk.getAttribute('role')).toBe('meter');
  expect(disk.getAttribute('aria-valuenow')).toBe('40');
  expect(disk.getAttribute('aria-valuetext')).toBe('40%');
  expect(disk.getAttribute('style')).toContain('--percentage: 40%');
  expect(disk.getAttribute('aria-labelledby')).toBe(page.get('.disk label').id);
  const upload = page.get('.upload');
  expect(upload.getAttribute('role')).toBe('progressbar');
  expect(upload.getAttribute('aria-valuetext')).toBe('3');
  expect(upload.getAttribute('style')).toContain('--percentage: 75%');
  const waiting = page.get('.waiting');
  expect(waiting.hasAttribute('aria-valuenow')).toBe(false);
  expect(waiting.hasAttribute('data-indeterminate')).toBe(true);
});

it('opens the file picker from its button, and passes the files on', async () => {
  const page = await toolbars();
  const input = page.get('input[type=file]') as HTMLInputElement;
  expect(input.hidden).toBe(true);
  expect(input.multiple).toBe(true);
  expect(input.accept).toBe('image/png');
  let opened = false;
  // The input forgets the files of before, so the same file fires a change again.
  let cleared = false;
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => '',
    set: (value: string) => (cleared ||= value === ''),
  });
  input.addEventListener('click', () => (opened = cleared));
  pressWith(page.get('.pick'));
  await page.waitFor(() => expect(opened).toBe(true));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await page.waitFor(() => expect(page.text('.picked')).toBe('0'));
});
