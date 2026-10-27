// The tests of DateRangePicker.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import DateRangePickers from './fixtures/daterangepickers.brm?brumate-server';
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
  const page = await mount(DateRangePickers, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof pickers>>;

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

function segments(page: Page, input: string) {
  return [...page.get(input).querySelectorAll<HTMLElement>('[data-segment]')].map(
    (item) => item.textContent,
  );
}

function cell(date: string) {
  return find(`.stay-grid [data-date="${date}"]:not([data-outside-month])`);
}

function backspace() {
  document.activeElement!.dispatchEvent(
    new InputEvent('beforeinput', {
      inputType: 'deleteContentBackward',
      bubbles: true,
      cancelable: true,
    }),
  );
}

it('shows the start and the end in their inputs, named by the Label, with a hidden input each', async () => {
  const page = await pickers();
  expect(segments(page, '.stay-start')).toEqual(['10', '/', '12', '/', '2026']);
  expect(segments(page, '.stay-end')).toEqual(['10', '/', '15', '/', '2026']);
  expect(page.get('.stay-start').getAttribute('aria-labelledby')).toBe(page.get('.stay-label').id);
  expect(page.get('.stay-button').getAttribute('aria-labelledby')).toBe(
    `${page.get('.stay-button').id} ${page.get('.stay-label').id}`,
  );
  expect((page.get('input[name="from"]') as HTMLInputElement).value).toBe('2026-10-12');
  expect((page.get('input[name="to"]') as HTMLInputElement).value).toBe('2026-10-15');
});

it('edits each date, keeps a date that is only typed so far, and is invalid when the start is after the end', async () => {
  const page = await pickers();
  const endDay = page.get('.stay-end [data-type="day"]');
  endDay.focus();
  press('ArrowUp', endDay);
  await page.waitFor(() =>
    expect(state(page)[0]).toEqual({ start: '2026-10-12', end: '2026-10-16' }),
  );
  const startYear = page.get('.stay-start [data-type="year"]');
  startYear.focus();
  backspace();
  backspace();
  backspace();
  backspace();
  await page.waitFor(() => expect(state(page)[0]).toBeNull());
  // The end stays as it was typed.
  expect(segments(page, '.stay-end')).toEqual(['10', '/', '16', '/', '2026']);
  press('ArrowUp', page.get('.stay-start [data-type="year"]'));
  await page.waitFor(() => expect(state(page)[0]).not.toBeNull());
  const startMonth = page.get('.stay-start [data-type="month"]');
  startMonth.focus();
  press('ArrowUp', startMonth);
  await page.waitFor(() => expect(page.get('.stay').hasAttribute('data-invalid')).toBe(true));
  expect(page.get('.stay-error').textContent).toBe('The end is before the start.');
});

it('opens a RangeCalendar on the range, and a range picked there sets both dates and closes it', async () => {
  const page = await pickers();
  page.get('.stay-button').click();
  await page.waitFor(() => expect(document.activeElement).toBe(cell('2026-10-12')));
  expect(cell('2026-10-14')!.hasAttribute('data-selected')).toBe(true);
  cell('2026-10-20')!.click();
  cell('2026-10-23')!.click();
  await page.waitFor(() =>
    expect(state(page)[0]).toEqual({ start: '2026-10-20', end: '2026-10-23' }),
  );
  await page.waitFor(() => expect(find('.stay-popover')).toBeNull());
  expect(segments(page, '.stay-start')).toEqual(['10', '/', '20', '/', '2026']);
  expect(segments(page, '.stay-end')).toEqual(['10', '/', '23', '/', '2026']);
});

it('checks isRequired on a submit, and gives back the first range on a reset', async () => {
  const page = await pickers();
  const form = page.get('.form') as HTMLFormElement;
  expect(form.checkValidity()).toBe(false);
  await page.waitFor(() => expect(page.get('.need').hasAttribute('data-invalid')).toBe(true));
  const day = page.get('.trip-end [data-type="day"]');
  day.focus();
  press('ArrowUp', day);
  await page.waitFor(() =>
    expect(state(page)[1]).toEqual({ start: '2026-11-02', end: '2026-11-05' }),
  );
  form.reset();
  await page.waitFor(() =>
    expect(state(page)[1]).toEqual({ start: '2026-11-02', end: '2026-11-04' }),
  );
  expect(page.get('.trip-end [data-type="day"]').textContent).toBe('4');
});
