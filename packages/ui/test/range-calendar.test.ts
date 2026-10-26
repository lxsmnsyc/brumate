// The tests of RangeCalendar follow the tests of RangeCalendar in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import RangeCalendars from './fixtures/rangeCalendars.brm?brumate-server';
import { pointer, press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function calendars() {
  const page = await mount(RangeCalendars, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof calendars>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

function cell(page: Page, root: string, date: string) {
  return page.get(`${root} [data-date="${date}"]:not([data-outside-month])`);
}

/** The dates that show as selected, from the first to the last. */
function selected(page: Page, root: string) {
  return [
    ...page.get(root).querySelectorAll<HTMLElement>('[data-selected]:not([data-outside-month])'),
  ].map((item) => item.dataset.date);
}

it('shows the selected range, with its first and last dates', async () => {
  const page = await calendars();
  expect(selected(page, '.stay-grid')).toEqual([
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
  ]);
  expect(cell(page, '.stay-grid', '2026-10-12').hasAttribute('data-selection-start')).toBe(true);
  expect(cell(page, '.stay-grid', '2026-10-15').hasAttribute('data-selection-end')).toBe(true);
  expect(cell(page, '.stay-grid', '2026-10-13').hasAttribute('data-selection-start')).toBe(false);
  expect(cell(page, '.stay-grid', '2026-10-13').parentElement!.getAttribute('aria-selected')).toBe(
    'true',
  );
  // Focus starts at the first date of the range.
  expect(cell(page, '.stay-grid', '2026-10-12').getAttribute('tabindex')).toBe('0');
  expect(page.get('.stay').getAttribute('aria-label')).toBe('Stay, October 2026');
});

it('selects a range with two presses, in either order, and shows it under the pointer between them', async () => {
  const page = await calendars();
  cell(page, '.stay-grid', '2026-10-22').click();
  await page.waitFor(() => expect(selected(page, '.stay-grid')).toEqual(['2026-10-22']));
  pointer('pointerenter', cell(page, '.stay-grid', '2026-10-19'));
  await page.waitFor(() =>
    expect(selected(page, '.stay-grid')).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
    ]),
  );
  // The value stays until the range ends.
  expect(state(page)[0]).toEqual({ start: '2026-10-12', end: '2026-10-15' });
  cell(page, '.stay-grid', '2026-10-19').click();
  await page.waitFor(() =>
    expect(state(page)[0]).toEqual({ start: '2026-10-19', end: '2026-10-22' }),
  );
  expect(cell(page, '.stay-grid', '2026-10-19').hasAttribute('data-selection-start')).toBe(true);
  expect(cell(page, '.stay-grid', '2026-10-22').hasAttribute('data-selection-end')).toBe(true);
});

it('selects a range with the keys, and Escape drops one that is not done', async () => {
  const page = await calendars();
  const grid = page.get('.stay-grid');
  cell(page, '.stay-grid', '2026-10-12').focus();
  press('Enter', grid);
  // Focus moves on to the next date, as in React Aria, so the range shows to it.
  await page.waitFor(() =>
    expect(selected(page, '.stay-grid')).toEqual(['2026-10-12', '2026-10-13']),
  );
  expect(document.activeElement).toBe(cell(page, '.stay-grid', '2026-10-13'));
  press('ArrowRight', grid);
  await page.waitFor(() =>
    expect(selected(page, '.stay-grid')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']),
  );
  press('Escape', grid);
  // The range that was selected shows again.
  await page.waitFor(() =>
    expect(selected(page, '.stay-grid')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
    ]),
  );
  press('Enter', grid);
  press('ArrowDown', grid);
  press('Enter', grid);
  await page.waitFor(() =>
    expect(state(page)[0]).toEqual({ start: '2026-10-14', end: '2026-10-22' }),
  );
});

it('does not select a range over a date that cannot be picked, unless the ranges can have gaps', async () => {
  const page = await calendars();
  // October 24 and 25 are a weekend.
  cell(page, '.trip-grid', '2026-10-22').click();
  cell(page, '.trip-grid', '2026-10-27').click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(state(page)[1]).toBeNull();
  cell(page, '.trip-grid', '2026-10-23').click();
  await page.waitFor(() =>
    expect(state(page)[1]).toEqual({ start: '2026-10-22', end: '2026-10-23' }),
  );
  cell(page, '.loose-grid', '2026-10-22').click();
  cell(page, '.loose-grid', '2026-10-27').click();
  await page.waitFor(() =>
    expect(state(page)[2]).toEqual({ start: '2026-10-22', end: '2026-10-27' }),
  );
  // The dates that cannot be picked do not show as selected.
  expect(cell(page, '.loose-grid', '2026-10-24').hasAttribute('data-selected')).toBe(false);
});

it('selects a range with a press of the pointer and a release on another date', async () => {
  const page = await calendars();
  pointer('pointerdown', cell(page, '.trip-grid', '2026-10-20'), { pointerType: 'mouse' });
  await page.waitFor(() => expect(selected(page, '.trip-grid')).toEqual(['2026-10-20']));
  pointer('pointerup', cell(page, '.trip-grid', '2026-10-22'), { pointerType: 'mouse' });
  await page.waitFor(() =>
    expect(state(page)[1]).toEqual({ start: '2026-10-20', end: '2026-10-22' }),
  );
});

it('keeps a range that is not done within reach, and does not show it as invalid', async () => {
  const page = await calendars();
  cell(page, '.trip-grid', '2026-10-22').click();
  await page.waitFor(() => expect(selected(page, '.trip-grid')).toEqual(['2026-10-22']));
  // October 24 and 25 are a weekend, so the dates after them are out of reach.
  const far = cell(page, '.trip-grid', '2026-10-27');
  expect(far.hasAttribute('data-invalid')).toBe(true);
  expect(far.getAttribute('aria-disabled')).toBe('true');
  expect(page.get('.trip').hasAttribute('data-invalid')).toBe(false);
  cell(page, '.trip-grid', '2026-10-22').focus();
  press('ArrowDown', page.get('.trip-grid'));
  // Focus stops at the last date in reach.
  await page.waitFor(() =>
    expect(document.activeElement).toBe(cell(page, '.trip-grid', '2026-10-23')),
  );
});

it('shows data-focused only while focus is in the grid, and starts the week on firstDayOfWeek', async () => {
  const page = await calendars();
  expect(page.get('.trip-grid').querySelector('[data-focused]')).toBeNull();
  cell(page, '.trip-grid', '2026-10-20').focus();
  await page.waitFor(() =>
    expect(cell(page, '.trip-grid', '2026-10-20').hasAttribute('data-focused')).toBe(true),
  );
  expect(page.get('.week-grid [data-date]').getAttribute('data-date')).toBe('2026-09-28');
  expect(page.get('.trip-grid [data-date]').getAttribute('data-date')).toBe('2026-09-27');
});

it('names the error message on the dates of an invalid value', async () => {
  const page = await calendars();
  const error = page.get('.bad-error');
  expect(error.id).not.toBe('');
  expect(cell(page, '.bad-grid', '2026-10-05').getAttribute('aria-describedby')).toBe(error.id);
  expect(cell(page, '.bad-grid', '2026-10-07').hasAttribute('aria-describedby')).toBe(false);
});
