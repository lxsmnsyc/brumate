// The tests of the date fields: the kept date, a locale that changes, the range check on a
// submit, and the hover and focus states of the segments and cells.
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import DateFieldSync from './fixtures/date-field-sync.brm?brumate-server';
import { press } from './interact.ts';

vi.setConfig({ testTimeout: 30000 });

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function page() {
  const mounted = await mount(DateFieldSync, {});
  unmount = mounted.unmount;
  return mounted;
}

type Page = Awaited<ReturnType<typeof page>>;

const texts = (view: Page, selector: string) =>
  [...view.get(selector).querySelectorAll('[data-segment]')].map((item) => item.textContent);

/** Clicks a button until its effect shows, since the first event of a part loads its code. */
async function toggle(view: Page, button: string, shown: () => boolean) {
  await view.waitFor(() => {
    if (!shown()) {
      (view.get(button) as HTMLElement).click();
    }
    expect(shown()).toBe(true);
  });
}

const lock = (view: Page, on: boolean) =>
  toggle(view, on ? '.lock' : '.unlock', () => view.text('.held') === String(on));

function step(view: Page, selector: string, key: string) {
  const segment = view.get(selector);
  segment.focus();
  press(key, segment);
}

it('shows the kept date when a write is refused, and after a reset', async () => {
  const view = await page();
  await lock(view, true);
  for (const field of ['due', 'trip']) {
    const before = texts(view, `.${field}-input`);
    step(view, `.${field}-input [data-type="day"]`, 'ArrowUp');
    // The signal keeps the date, so the segments do too.
    await view.waitFor(() => expect(texts(view, `.${field}-input`)).toEqual(before));
  }
  expect(JSON.parse(view.text('.state')).slice(0, 2)).toEqual(['2026-10-15', '2026-10-15']);
  // The setter accepts a write again, then a reset gives back the first date.
  await lock(view, false);
  // The first key of a part loads its code, so the key repeats until it counts.
  await view.waitFor(() => {
    if (JSON.parse(view.text('.state'))[0] === '2026-10-15') {
      step(view, '.due-input [data-type="day"]', 'ArrowUp');
    }
    expect(JSON.parse(view.text('.state'))[0]).toBe('2026-10-16');
  });
  // A reset gives back the first date to the segments, as a write.
  (view.get('.form') as HTMLFormElement).reset();
  await view.waitFor(() => {
    expect(JSON.parse(view.text('.state'))[0]).toBe('2026-10-15');
    expect(texts(view, '.due-input')).toEqual(['10', '/', '15', '/', '2026']);
  });
});

it('follows a locale that changes at run time', async () => {
  const view = await page();
  const before = texts(view, '.loc-field-input');
  expect(before[0]).toBe('mm');
  await toggle(view, '.german', () => view.text('.locale-state') === 'de-DE');
  for (const selector of [
    '.loc-field-input',
    '.loc-picker-input',
    '.loc-range-start',
    '.loc-range-end',
  ]) {
    await view.waitFor(() => expect(texts(view, selector)[0]).toBe('tt'));
    // The names that a screen reader hears follow too.
    expect(view.get(`${selector} [data-type="day"]`).getAttribute('aria-label')).toBe('Tag');
  }
});

it('blocks a submit with a date outside minValue and maxValue', async () => {
  const view = await page();
  const form = view.get('.form') as HTMLFormElement;
  expect(form.checkValidity()).toBe(true);
  step(view, '.ranged-input [data-type="year"]', 'ArrowUp');
  await view.waitFor(() => expect(view.get('.ranged').hasAttribute('data-invalid')).toBe(false));
  const year = view.get('.ranged-input [data-type="year"]');
  year.focus();
  press('End', year);
  await view.waitFor(() => expect(view.get('.ranged').hasAttribute('data-invalid')).toBe(true));
  expect(form.checkValidity()).toBe(false);
  // A date in range lets the form through again.
  // Typing 2026 into the segment puts the date back in range.
  for (const char of '2026') {
    year.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: char,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
  await view.waitFor(() => expect(form.checkValidity()).toBe(true));
});

it('shows data-hovered on a segment and data-focus-visible on a focused one', async () => {
  const view = await page();
  const segment = view.get('.due-input [data-type="day"]');
  segment.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true }));
  await view.waitFor(() => expect(segment.hasAttribute('data-hovered')).toBe(true));
  segment.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse', bubbles: true }));
  await view.waitFor(() => expect(segment.hasAttribute('data-hovered')).toBe(false));
  segment.focus();
  await view.waitFor(() => expect(segment.hasAttribute('data-focused')).toBe(true));
  expect(segment.hasAttribute('data-focus-visible')).toBe(segment.matches(':focus-visible'));
});

it('shows data-hovered on a calendar cell under a mouse', async () => {
  const view = await page();
  (view.get('.trip-button') as HTMLElement).click();
  // The Popover renders outside the page.
  await view.waitFor(() =>
    expect(document.querySelector('[data-date="2026-10-15"]')).not.toBeNull(),
  );
  const cell = document.querySelector<HTMLElement>('[data-date="2026-10-15"]')!;
  cell.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  await view.waitFor(() => expect(cell.hasAttribute('data-hovered')).toBe(true));
  cell.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
  await view.waitFor(() => expect(cell.hasAttribute('data-hovered')).toBe(false));
});
