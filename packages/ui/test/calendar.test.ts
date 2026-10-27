// The tests of Calendar.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Calendars from './fixtures/calendars.brm?brumate-server';
import { press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function calendars() {
  const page = await mount(Calendars, {});
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

function focused() {
  return (document.activeElement as HTMLElement | null)?.dataset.date;
}

it('names the calendar and its grid by the month, and the cells by their dates', async () => {
  const page = await calendars();
  const calendar = page.get('.due');
  expect(calendar.getAttribute('role')).toBe('application');
  expect(calendar.getAttribute('aria-label')).toBe('Due date, October 2026');
  expect(page.get('.grid').getAttribute('role')).toBe('grid');
  expect(page.get('.grid').getAttribute('aria-label')).toBe('Due date, October 2026');
  expect(page.text('.heading')).toBe('October 2026');
  expect(page.get('.grid thead').getAttribute('aria-hidden')).toBe('true');
  expect([...page.get('.grid thead tr').children].map((th) => th.textContent)).toEqual([
    'S',
    'M',
    'T',
    'W',
    'T',
    'F',
    'S',
  ]);
  expect(page.get('.grid tbody').children.length).toBe(5);
  const selected = cell(page, '.due', '2026-10-15');
  expect(selected.textContent).toBe('15');
  expect(selected.getAttribute('aria-label')).toBe('Thursday, October 15, 2026 selected');
  expect(selected.parentElement!.getAttribute('aria-selected')).toBe('true');
  expect(selected.getAttribute('tabindex')).toBe('0');
  expect(cell(page, '.due', '2026-10-16').getAttribute('tabindex')).toBe('-1');
  // The days before the first of the month are hidden and disabled.
  const outside = page.get('.due [data-date="2026-09-27"]');
  expect(outside.hidden).toBe(true);
  expect(outside.parentElement!.getAttribute('aria-disabled')).toBe('true');
  expect(page.get('.previous').getAttribute('aria-label')).toBe('Previous');
});

it('moves focus with the keys, and to the next month', async () => {
  const page = await calendars();
  cell(page, '.due', '2026-10-15').focus();
  const grid = page.get('.grid');
  press('ArrowRight', grid);
  await page.waitFor(() => expect(focused()).toBe('2026-10-16'));
  press('ArrowDown', grid);
  await page.waitFor(() => expect(focused()).toBe('2026-10-23'));
  press('ArrowUp', grid);
  press('ArrowLeft', grid);
  await page.waitFor(() => expect(focused()).toBe('2026-10-15'));
  press('Home', grid);
  await page.waitFor(() => expect(focused()).toBe('2026-10-01'));
  press('End', grid);
  await page.waitFor(() => expect(focused()).toBe('2026-10-31'));
  press('ArrowRight', grid);
  await page.waitFor(() => expect(focused()).toBe('2026-11-01'));
  expect(page.text('.heading')).toBe('November 2026');
  press('PageUp', grid);
  await page.waitFor(() => expect(focused()).toBe('2026-10-01'));
  press('Enter', grid);
  await page.waitFor(() => expect(state(page)[0]).toBe('2026-10-01'));
});

it('stops at the minimum and the maximum', async () => {
  const page = await calendars();
  expect(cell(page, '.due', '2026-10-15').parentElement!.hasAttribute('aria-disabled')).toBe(false);
  page.get('.next').click();
  await page.waitFor(() => expect(page.text('.heading')).toBe('November 2026'));
  // The cells of the next month render once their code loads.
  await page.waitFor(() => expect(cell(page, '.due', '2026-11-21')).toBeTruthy());
  expect(cell(page, '.due', '2026-11-21').parentElement!.getAttribute('aria-disabled')).toBe(
    'true',
  );
  expect(cell(page, '.due', '2026-11-20').getAttribute('aria-label')).toBe(
    'Friday, November 20, 2026, Last available date',
  );
  await page.waitFor(() => expect(page.get('.next').hasAttribute('disabled')).toBe(true));
  page.get('.previous').click();
  await page.waitFor(() => expect(page.text('.heading')).toBe('October 2026'));
  page.get('.previous').click();
  await page.waitFor(() => expect(page.text('.heading')).toBe('September 2026'));
  await page.waitFor(() => expect(page.get('.previous').hasAttribute('disabled')).toBe(true));
  // A press on a date before the minimum does nothing.
  cell(page, '.due', '2026-09-05').click();
  cell(page, '.due', '2026-09-12').click();
  await page.waitFor(() => expect(state(page)[0]).toBe('2026-09-12'));
});

it('shows two months in the locale, with dates that cannot be picked', async () => {
  const page = await calendars();
  expect(page.text('.trip-heading')).toBe('Oktober–November 2026');
  expect(page.get('.trip').getAttribute('aria-label')).toBe('Oktober to November 2026');
  // The week starts on Monday in Germany.
  expect([...page.get('.first thead tr').children].map((th) => th.textContent)).toEqual([
    'M',
    'D',
    'M',
    'D',
    'F',
    'S',
    'S',
  ]);
  expect(page.get('.second').getAttribute('aria-label')).toBe('November 2026');
  // The second grid renders its cells from a template.
  const custom = cell(page, '.second', '2026-11-03');
  expect(custom.classList.contains('custom')).toBe(true);
  expect(custom.textContent).toBe('3.');
  const saturday = cell(page, '.first', '2026-10-24');
  expect(saturday.hasAttribute('data-unavailable')).toBe(true);
  saturday.click();
  cell(page, '.second', '2026-11-03').click();
  await page.waitFor(() => expect(state(page)[1]).toBe('2026-11-03'));
  expect(cell(page, '.second', '2026-11-03').hasAttribute('data-selected')).toBe(true);
  page.get('.trip-next').click();
  // The locale puts thin spaces around the dash.
  await page.waitFor(() =>
    expect(page.text('.trip-heading').replace(/\s/g, ' ')).toBe('Dezember 2026 – Januar 2027'),
  );
});
