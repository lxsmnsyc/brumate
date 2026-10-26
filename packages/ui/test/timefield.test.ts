// The tests of TimeField follow the tests of TimeField in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import TimeFields from './fixtures/timefields.brm?brumate-server';
import { press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function fields() {
  const page = await mount(TimeFields, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof fields>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

/** The text of each segment, with the narrow spaces of a locale as spaces. */
function segments(page: Page, input: string) {
  return [...page.get(input).querySelectorAll<HTMLElement>('[data-segment]')].map((item) =>
    item.textContent!.replace(/\s/g, ' '),
  );
}

function segment(page: Page, input: string, type: string) {
  return page.get(`${input} [data-type="${type}"]`);
}

/** Types text into the segment that has focus: a keydown, then the browser asks to insert it. */
function type(text: string) {
  for (const char of text) {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }),
    );
    document.activeElement!.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: char,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
}

it('shows the segments of the clock of the locale, or of hourCycle', async () => {
  const page = await fields();
  expect(segments(page, '.meeting-input')).toEqual(['2', ':', '30', ' ', 'PM']);
  // The hour has no leading zero, as React Aria shows it without `shouldForceLeadingZeros`.
  expect(segments(page, '.alarm-input')).toEqual(['7', ':', '05']);
  expect(segments(page, '.forced-input')).toEqual(['14', ':', '30']);
  expect(segments(page, '.empty-input')).toEqual(['––', ':', '––', ':', '––', ' ', 'AM']);
  const hour = segment(page, '.meeting-input', 'hour');
  expect(hour.getAttribute('aria-label')).toBe('hour');
  expect(hour.getAttribute('aria-valuenow')).toBe('2');
  expect(hour.getAttribute('aria-valuemin')).toBe('1');
  expect(hour.getAttribute('aria-valuemax')).toBe('12');
  expect(segment(page, '.forced-input', 'hour').getAttribute('aria-valuemax')).toBe('23');
  expect(segment(page, '.meeting-input', 'dayPeriod').getAttribute('aria-label')).toBe('AM/PM');
  expect(segment(page, '.meeting-input', 'dayPeriod').getAttribute('inputmode')).toBe('text');
  expect((page.get('.meeting input[type="hidden"]') as HTMLInputElement).value).toBe('14:30');
});

it('steps the hour and the minute around the clock, and AM and PM by 12 hours', async () => {
  const page = await fields();
  const hour = segment(page, '.meeting-input', 'hour');
  hour.focus();
  press('ArrowUp', hour);
  await page.waitFor(() => expect(state(page)[0]).toBe('15:30'));
  const minute = segment(page, '.meeting-input', 'minute');
  minute.focus();
  press('ArrowDown', minute);
  await page.waitFor(() => expect(state(page)[0]).toBe('15:29'));
  const period = segment(page, '.meeting-input', 'dayPeriod');
  period.focus();
  press('ArrowUp', period);
  await page.waitFor(() => expect(state(page)[0]).toBe('03:29'));
  expect(segments(page, '.meeting-input')).toEqual(['3', ':', '29', ' ', 'AM']);
  // 3:29 AM is before the office opens, so the field is invalid.
  await page.waitFor(() => expect(page.get('.meeting').hasAttribute('data-invalid')).toBe(true));
});

it('types each segment, keeps the period of a 12-hour clock, and types a or p into it', async () => {
  const page = await fields();
  segment(page, '.empty-input', 'hour').focus();
  type('11');
  await page.waitFor(() =>
    expect(document.activeElement).toBe(segment(page, '.empty-input', 'minute')),
  );
  type('05');
  await page.waitFor(() =>
    expect(document.activeElement).toBe(segment(page, '.empty-input', 'second')),
  );
  type('9');
  await page.waitFor(() =>
    expect(document.activeElement).toBe(segment(page, '.empty-input', 'dayPeriod')),
  );
  await page.waitFor(() => expect(state(page)[2]).toBe('11:05:09'));
  type('p');
  await page.waitFor(() => expect(state(page)[2]).toBe('23:05:09'));
  expect(segments(page, '.empty-input')).toEqual(['11', ':', '05', ':', '09', ' ', 'PM']);
  // On a 24-hour clock, the hour types as it shows.
  segment(page, '.forced-input', 'hour').focus();
  type('20');
  await page.waitFor(() => expect(state(page)[3]).toBe('20:30'));
});
