// The tests of DatePicker follow the tests of DatePicker in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import DatePickers from './fixtures/datepickers.brm?brumate-server';
import { press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  // A portal renders outside the mounted container, which unmount removes.
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
});

async function pickers() {
  const page = await mount(DatePickers, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof pickers>>;

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

function segments(page: Page) {
  return [...page.get('.trip-input').querySelectorAll<HTMLElement>('[data-segment]')].map(
    (item) => item.textContent,
  );
}

function cell(date: string) {
  return find(`.trip-grid [data-date="${date}"]:not([data-outside-month])`);
}

it('names its Button by the Label, and shows the date in the segments', async () => {
  const page = await pickers();
  const trigger = page.get('.trip-button');
  expect(trigger.getAttribute('aria-label')).toBe('Calendar');
  expect(trigger.getAttribute('aria-labelledby')).toBe(
    `${trigger.id} ${page.get('.trip-label').id}`,
  );
  expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(page.get('.trip-input').getAttribute('aria-labelledby')).toBe(page.get('.trip-label').id);
  expect(segments(page)).toEqual(['10', '/', '15', '/', '2026']);
  expect((page.get('.trip input[aria-hidden="true"]') as HTMLInputElement).value).toBe('2026-10-15');
});

it('opens a Calendar on the selected date, and a pick sets the date and closes it', async () => {
  const page = await pickers();
  const trigger = page.get('.trip-button');
  trigger.click();
  await page.waitFor(() => expect(cell('2026-10-15')).not.toBeNull());
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(page.get('.trip').hasAttribute('data-open')).toBe(true);
  // The selected date takes focus once the popover has opened.
  await page.waitFor(() => expect(document.activeElement).toBe(cell('2026-10-15')));
  expect(cell('2026-10-15')!.hasAttribute('data-selected')).toBe(true);
  // The minimum of the picker applies to its Calendar.
  expect(cell('2026-10-04')!.hasAttribute('data-disabled')).toBe(true);
  cell('2026-10-22')!.click();
  await page.waitFor(() => expect(state(page)[0]).toBe('2026-10-22'));
  await page.waitFor(() => expect(find('.trip-popover')).toBeNull());
  expect(segments(page)).toEqual(['10', '/', '22', '/', '2026']);
  await page.waitFor(() => expect(document.activeElement).toBe(trigger));
});

it('shows a typed date in the Calendar, and closes with Escape', async () => {
  const page = await pickers();
  const day = page.get('.trip-input [data-type="day"]');
  day.focus();
  press('ArrowUp', day);
  await page.waitFor(() => expect(state(page)[0]).toBe('2026-10-16'));
  page.get('.trip-button').click();
  await page.waitFor(() => expect(document.activeElement).toBe(cell('2026-10-16')));
  press('ArrowRight', find('.trip-grid')!);
  await page.waitFor(() => expect(document.activeElement).toBe(cell('2026-10-17')));
  press('Escape', document.activeElement!);
  await page.waitFor(() => expect(find('.trip-popover')).toBeNull());
  expect(state(page)[0]).toBe('2026-10-16');
});
