// The tests of Slider follow the tests of Slider in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Sliders from './fixtures/sliders.brm?brumate-server';
import { pointer, press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function sliders() {
  const page = await mount(Sliders, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof sliders>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

function range(page: Page, selector: string) {
  return page.get(`${selector} input[type=range]`) as HTMLInputElement;
}

function slide(input: HTMLInputElement, value: number) {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Gives the track a box, which happy-dom does not lay out. */
function layout(track: Element, width: number) {
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height: 10, right: width, bottom: 10, x: 0, y: 0 }) as DOMRect;
}

it('is a group that its label names, with a range input for each thumb', async () => {
  const page = await sliders();
  const group = page.get('.volume');
  expect(group.getAttribute('role')).toBe('group');
  expect(group.getAttribute('aria-labelledby')).toBe(page.get('.volume-label').id);
  const input = range(page, '.volume-thumb');
  expect(input.getAttribute('aria-labelledby')).toBe(page.get('.volume-label').id);
  expect(input.min).toBe('0');
  expect(input.max).toBe('100');
  expect(input.step).toBe('10');
  expect(input.value).toBe('40');
  expect(input.name).toBe('volume');
  expect(page.get('.volume-output').getAttribute('for')).toBe(input.id);
  expect(page.text('.volume-output')).toBe('40');
  // The thumb sits at its value through a scoped style, and keeps the style of the caller.
  const thumb = page.get('.volume-thumb') as HTMLElement;
  expect(thumb.classList.contains('thumb')).toBe(true);
  expect(thumb.getAttribute('style')).toMatch(/^--s-\w+-0:40%;top: 2px$/);
});

it('names each thumb of a range, keeps them in order, and formats the values', async () => {
  const page = await sliders();
  const low = range(page, '.low');
  const high = range(page, '.high');
  const label = page.get('.price-label').id;
  expect(low.getAttribute('aria-labelledby')).toBe(`${low.id} ${label}`);
  expect(low.getAttribute('aria-valuetext')).toBe('$20');
  expect(low.max).toBe('80');
  expect(high.min).toBe('20');
  expect(page.text('.price-output')).toMatch(/^\$20\s*[–-]\s*\$80$/);
  // A thumb stops at the thumb next to it.
  slide(low, 95);
  await page.waitFor(() => expect(state(page)[1]).toEqual([80, 80]));
  slide(high, 90);
  await page.waitFor(() => expect(range(page, '.low').max).toBe('90'));
});

it('steps with the keys of the range input, and a page with PageUp and PageDown', async () => {
  const page = await sliders();
  const input = range(page, '.volume-thumb');
  slide(input, 50);
  await page.waitFor(() => expect(state(page)[0]).toBe(50));
  expect(state(page)[2]).toBe(50);
  input.focus();
  press('PageUp', input);
  await page.waitFor(() => expect(state(page)[0]).toBe(60));
  press('PageDown', input);
  press('PageDown', input);
  await page.waitFor(() => expect(state(page)[0]).toBe(40));
  // A value off the steps moves to the nearest step.
  slide(input, 44);
  await page.waitFor(() => expect(page.text('.volume-output')).toBe('40'));
});

it('moves the nearest thumb to a press on the track, and drags it', async () => {
  const page = await sliders();
  const track = page.get('.price-track');
  layout(track, 200);
  // 160 of 200 is 80, nearer the high thumb.
  pointer('pointerdown', track, { clientX: 150, clientY: 5 });
  await page.waitFor(() => expect(state(page)[1]).toEqual([20, 75]));
  expect(document.activeElement).toBe(range(page, '.high'));
  pointer('pointermove', window as unknown as Element, { clientX: 190, clientY: 5, buttons: 1 });
  await page.waitFor(() => expect(state(page)[1]).toEqual([20, 95]));
  pointer('pointerup', window as unknown as Element, { clientX: 190, clientY: 5 });
  pointer('pointermove', window as unknown as Element, { clientX: 10, clientY: 5, buttons: 1 });
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[1]).toEqual([20, 95]);
  // A drag of a thumb stops at the thumb next to it.
  pointer('pointerdown', page.get('.low'), { clientX: 40, clientY: 5 });
  // The code of the thumb loads on its first press, and then the drag begins.
  await page.waitFor(() => expect(page.get('.low').hasAttribute('data-dragging')).toBe(true));
  pointer('pointermove', window as unknown as Element, { clientX: 199, clientY: 5, buttons: 1 });
  await page.waitFor(() => expect(state(page)[1]).toEqual([95, 95]));
  pointer('pointerup', window as unknown as Element, {});
  await page.waitFor(() => expect(state(page)[2]).toBe(null));
});

it('keeps a disabled thumb still, and lists three values in the format of the locale', async () => {
  const page = await sliders();
  expect(page.text('.levels-output')).toBe('10, 50, 90');
  expect(range(page, '.l1').disabled).toBe(true);
  expect(page.get('.l1').hasAttribute('data-disabled')).toBe(true);
  expect(range(page, '.l0').getAttribute('aria-orientation')).toBe('horizontal');
  const track = page.get('.levels-track');
  layout(track, 100);
  // 50 is nearest the disabled thumb, so the press moves nothing.
  pointer('pointerdown', track, { clientX: 52, clientY: 5 });
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[3]).toEqual([10, 50, 90]);
  pointer('pointerup', window as unknown as Element, {});
});

it('marks the thumb that a press on the track drags, and ignores a press with a modifier', async () => {
  const page = await sliders();
  const track = page.get('.price-track');
  layout(track, 200);
  pointer('pointerdown', track, { clientX: 10, clientY: 5, ctrlKey: true });
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[1]).toEqual([20, 80]);
  pointer('pointerdown', track, { clientX: 10, clientY: 5 });
  await page.waitFor(() => expect(state(page)[1]).toEqual([5, 80]));
  expect(page.get('.low').hasAttribute('data-dragging')).toBe(true);
  pointer('pointerup', window as unknown as Element, {});
  await page.waitFor(() => expect(page.get('.low').hasAttribute('data-dragging')).toBe(false));
});

it('drags a thumb from where the pointer took it, and two pointers drag two thumbs', async () => {
  const page = await sliders();
  layout(page.get('.price-track'), 200);
  // The low thumb is at 40 of 200. The pointer takes it 6 to the right of its center.
  pointer('pointerdown', page.get('.low'), { clientX: 46, clientY: 5, pointerId: 1 });
  await page.waitFor(() => expect(page.get('.low').hasAttribute('data-dragging')).toBe(true));
  pointer('pointermove', window as unknown as Element, {
    clientX: 50,
    clientY: 5,
    buttons: 1,
    pointerId: 1,
  });
  // 4 to the right is 2 more, not a jump to the pointer.
  await page.waitFor(() => expect(state(page)[1]).toEqual([22, 80]));
  pointer('pointerdown', page.get('.high'), {
    clientX: 160,
    clientY: 5,
    pointerId: 2,
    pointerType: 'touch',
  });
  await page.waitFor(() => expect(page.get('.high').hasAttribute('data-dragging')).toBe(true));
  // The first drag goes on.
  expect(page.get('.low').hasAttribute('data-dragging')).toBe(true);
  pointer('pointerup', window as unknown as Element, { pointerId: 2 });
  await page.waitFor(() => expect(page.get('.high').hasAttribute('data-dragging')).toBe(false));
  expect(page.get('.low').hasAttribute('data-dragging')).toBe(true);
  pointer('pointerup', window as unknown as Element, { pointerId: 1 });
  await page.waitFor(() => expect(page.get('.low').hasAttribute('data-dragging')).toBe(false));
});

it('gives back the first values on a reset of the form', async () => {
  const page = await sliders();
  slide(range(page, '.l2'), 70);
  await page.waitFor(() => expect(state(page)[3]).toEqual([10, 50, 70]));
  (page.get('.form') as HTMLFormElement).reset();
  await page.waitFor(() => expect(state(page)[3]).toEqual([10, 50, 90]));
  expect(range(page, '.l2').value).toBe('90');
});

it('ends the drag of a touch or a pen that went up before the code loaded', async () => {
  const page = await sliders();
  layout(page.get('.price-track'), 200);
  // A pointer that is up cannot be captured, as in a browser.
  page.get('.low').setPointerCapture = () => {
    throw new DOMException('The pointer is not active', 'InvalidStateError');
  };
  pointer('pointerdown', page.get('.low'), {
    clientX: 40,
    clientY: 5,
    pointerId: 3,
    pointerType: 'touch',
  });
  await new Promise((done) => setTimeout(done, 100));
  expect(page.get('.low').hasAttribute('data-dragging')).toBe(false);
});

it('ends the drag of a pen that moves with no button down and no pressure', async () => {
  const page = await sliders();
  layout(page.get('.price-track'), 200);
  pointer('pointerdown', page.get('.low'), {
    clientX: 40,
    clientY: 5,
    pointerId: 4,
    pointerType: 'pen',
  });
  await page.waitFor(() => expect(page.get('.low').hasAttribute('data-dragging')).toBe(true));
  pointer('pointermove', window as unknown as Element, {
    clientX: 100,
    clientY: 5,
    pointerId: 4,
    pointerType: 'pen',
  });
  await page.waitFor(() => expect(page.get('.low').hasAttribute('data-dragging')).toBe(false));
});
