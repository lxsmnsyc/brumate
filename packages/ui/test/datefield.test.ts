// The tests of DateField.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import DateFields from './fixtures/datefields.brm?brumate-server';
import { press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function fields() {
  const page = await mount(DateFields, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof fields>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

function segments(page: Page, input: string) {
  return [...page.get(input).querySelectorAll<HTMLElement>('[data-segment]')].map(
    (item) => item.textContent,
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

function backspace() {
  document.activeElement!.dispatchEvent(
    new InputEvent('beforeinput', {
      inputType: 'deleteContentBackward',
      bubbles: true,
      cancelable: true,
    }),
  );
}

it('shows the segments in the order of the locale, as spinbuttons named by the label', async () => {
  const page = await fields();
  expect(segments(page, '.due-input')).toEqual(['10', '/', '15', '/', '2026']);
  expect(segments(page, '.german-input')).toEqual(['15', '.', '10', '.', '2026']);
  expect(segments(page, '.empty-input')).toEqual(['mm', '/', 'dd', '/', 'yyyy']);
  const group = page.get('.due-input');
  expect(group.getAttribute('role')).toBe('group');
  expect(group.getAttribute('aria-labelledby')).toBe(page.get('.due-label').id);
  const month = segment(page, '.due-input', 'month');
  expect(month.getAttribute('role')).toBe('spinbutton');
  expect(month.getAttribute('aria-label')).toBe('month');
  expect(month.getAttribute('aria-labelledby')).toBe(`${month.id} ${page.get('.due-label').id}`);
  expect(month.getAttribute('aria-valuenow')).toBe('10');
  expect(month.getAttribute('aria-valuemax')).toBe('12');
  expect(month.getAttribute('aria-describedby')).toBe(page.get('.due-help').id);
  expect(month.getAttribute('contenteditable')).toBe('true');
  expect(month.getAttribute('inputmode')).toBe('numeric');
  expect(segment(page, '.empty-input', 'day').getAttribute('aria-valuetext')).toBe('Empty');
  expect(segment(page, '.empty-input', 'day').hasAttribute('data-placeholder')).toBe(true);
  expect(segment(page, '.empty-input', 'day').classList.contains('custom')).toBe(true);
  expect((page.get('.due input[aria-hidden="true"]') as HTMLInputElement).value).toBe('2026-10-15');
});

it('steps a segment around its range with the arrow keys, and starts an empty one at the placeholder', async () => {
  const page = await fields();
  const month = segment(page, '.due-input', 'month');
  month.focus();
  press('ArrowUp', month);
  press('ArrowUp', month);
  await page.waitFor(() => expect(state(page)[0]).toBe('2026-12-15'));
  press('ArrowUp', month);
  await page.waitFor(() => expect(month.textContent).toBe('1'));
  // January 2026 is before the minimum, so the field is invalid.
  await page.waitFor(() => expect(page.get('.due').hasAttribute('data-invalid')).toBe(true));
  expect(page.get('.due-error').textContent).toBe('Out of range');
  expect(month.getAttribute('aria-describedby')).toBe(
    `${page.get('.due-help').id} ${page.get('.due-error').id}`,
  );
  const day = segment(page, '.empty-input', 'day');
  day.focus();
  press('ArrowUp', day);
  await page.waitFor(() => expect(day.textContent).toBe('25'));
  // Two parts are still empty, so the field has no date yet.
  expect(state(page)[1]).toBeNull();
});

it('types digits into each segment and moves on when one is full', async () => {
  const page = await fields();
  segment(page, '.empty-input', 'month').focus();
  type('1');
  await page.waitFor(() => expect(segment(page, '.empty-input', 'month').textContent).toBe('1'));
  type('2');
  // No month starts with 12, so focus moves to the day.
  await page.waitFor(() =>
    expect(document.activeElement).toBe(segment(page, '.empty-input', 'day')),
  );
  type('4');
  await page.waitFor(() =>
    expect(document.activeElement).toBe(segment(page, '.empty-input', 'year')),
  );
  type('2027');
  await page.waitFor(() => expect(state(page)[1]).toBe('2027-12-04'));
  expect(segments(page, '.empty-input')).toEqual(['12', '/', '4', '/', '2027']);
});

it('takes digits away with Backspace, empties the date, and moves back from an empty segment', async () => {
  const page = await fields();
  const year = segment(page, '.due-input', 'year');
  year.focus();
  backspace();
  await page.waitFor(() => expect(year.textContent).toBe('202'));
  // Year 202 is a year too.
  expect(state(page)[0]).toBe('0202-10-15');
  backspace();
  backspace();
  backspace();
  await page.waitFor(() => expect(year.textContent).toBe('yyyy'));
  await page.waitFor(() => expect(state(page)[0]).toBeNull());
  expect((page.get('.due input[aria-hidden="true"]') as HTMLInputElement).value).toBe('');
  backspace();
  await page.waitFor(() => expect(document.activeElement).toBe(segment(page, '.due-input', 'day')));
});

it('moves between the segments with ArrowLeft and ArrowRight', async () => {
  const page = await fields();
  const input = page.get('.due-input');
  segment(page, '.due-input', 'month').focus();
  press('ArrowRight', input);
  await page.waitFor(() => expect(document.activeElement).toBe(segment(page, '.due-input', 'day')));
  press('ArrowRight', input);
  await page.waitFor(() =>
    expect(document.activeElement).toBe(segment(page, '.due-input', 'year')),
  );
  press('ArrowLeft', input);
  await page.waitFor(() => expect(document.activeElement).toBe(segment(page, '.due-input', 'day')));
  // A digit that does not fill the day keeps focus in it.
  type('1');
  await page.waitFor(() => expect(segment(page, '.due-input', 'day').textContent).toBe('1'));
  expect(document.activeElement).toBe(segment(page, '.due-input', 'day'));
});

it('goes to the ends with Home and End, steps a page with PageUp, and a press on the group focuses a segment', async () => {
  const page = await fields();
  const month = segment(page, '.sent-input', 'month');
  month.focus();
  press('End', month);
  await page.waitFor(() => expect(state(page)[3]).toBe('2026-12-10'));
  press('Home', month);
  await page.waitFor(() => expect(state(page)[3]).toBe('2026-01-10'));
  const day = segment(page, '.sent-input', 'day');
  day.focus();
  press('PageUp', day);
  await page.waitFor(() => expect(state(page)[3]).toBe('2026-01-17'));
  page
    .get('.sent-input')
    .dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
    );
  await page.waitFor(() =>
    expect(document.activeElement).toBe(segment(page, '.sent-input', 'year')),
  );
});

it('checks isRequired on a submit, and gives back the first date on a reset', async () => {
  const page = await fields();
  const form = page.get('.form') as HTMLFormElement;
  expect(form.checkValidity()).toBe(false);
  await page.waitFor(() => expect(page.get('.need').hasAttribute('data-invalid')).toBe(true));
  const year = segment(page, '.sent-input', 'year');
  year.focus();
  press('ArrowUp', year);
  await page.waitFor(() => expect(state(page)[3]).toBe('2027-03-10'));
  form.reset();
  await page.waitFor(() => expect(state(page)[3]).toBe('2026-03-10'));
  expect(page.get('.need').hasAttribute('data-invalid')).toBe(false);
});

it('leaves ArrowLeft and ArrowRight with Ctrl, Alt or Meta to the browser', async () => {
  const page = await fields();
  const input = page.get('.due-input');
  const month = segment(page, '.due-input', 'month');
  month.focus();
  // The bare arrow moves, which shows that the handler has loaded.
  press('ArrowRight', month);
  await page.waitFor(() => expect(document.activeElement).toBe(segment(page, '.due-input', 'day')));
  month.focus();
  for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
    for (const key of ['ArrowRight', 'ArrowLeft']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      month.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      // Focus moves a moment after the key, so wait before checking that it stayed.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(document.activeElement).toBe(month);
    }
  }
  expect(input.contains(document.activeElement)).toBe(true);
  // The bare arrow moves, and is prevented.
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowRight',
    bubbles: true,
    cancelable: true,
  });
  month.dispatchEvent(event);
  await page.waitFor(() => expect(document.activeElement).toBe(segment(page, '.due-input', 'day')));
  expect(event.defaultPrevented).toBe(true);
});

it('shows the Gregorian year in a locale with another calendar, and types it back', async () => {
  const page = await fields();
  // Thai uses the Buddhist calendar, in which 2026 is 2569.
  expect(segments(page, '.thai-input').join('')).toContain('2026');
  expect(segments(page, '.thai-input').join('')).not.toContain('2569');
  segment(page, '.thai-input', 'year').focus();
  type('2027');
  await page.waitFor(() => expect(JSON.parse(page.text('.locale-state'))[0]).toBe('2027-10-15'));
  expect(segment(page, '.thai-input', 'year').textContent).toBe('2027');
});

it('types ASCII digits into a segment that shows Arabic-Indic digits', async () => {
  const page = await fields();
  // ar-SA uses the Islamic calendar, and its own digits.
  const year = segment(page, '.arabic-input', 'year');
  expect(year.textContent).toBe('٢٠٢٦');
  year.focus();
  type('2027');
  await page.waitFor(() => expect(JSON.parse(page.text('.locale-state'))[1]).toBe('2027-10-15'));
  expect(year.textContent).toBe('٢٠٢٧');
});
