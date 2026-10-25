// The tests of SelectionIndicator follow the tests of SelectionIndicator in React Aria.
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Indicators from './fixtures/indicators.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  vi.restoreAllMocks();
});

async function indicators() {
  const page = await mount(Indicators, {});
  unmount = page.unmount;
  return page;
}

it('renders only in the selected item, and moves with the selection', async () => {
  const page = await indicators();
  expect(page.get('.tab-list').querySelector('.bar')).not.toBeNull();
  expect(page.get('.tab-grid').querySelector('.bar')).toBeNull();
  const bar = page.get('.tab-list .bar');
  expect(bar.hasAttribute('data-selection-indicator')).toBe(true);
  expect(bar.getAttribute('aria-hidden')).toBe('true');
  expect(page.get('.size-m').querySelector('.dot')).not.toBeNull();
  expect(page.get('.size-s').querySelector('.dot')).toBeNull();
  pressWith(page.get('.size-s'));
  await page.waitFor(() => expect(page.get('.size-s').querySelector('.dot')).not.toBeNull());
  expect(page.get('.size-m').querySelector('.dot')).toBeNull();
});

it('animates from the last indicator with the duration of its CSS, and not without one', async () => {
  const animate = vi.fn();
  Element.prototype.animate = animate as unknown as Element['animate'];
  const page = await indicators();
  // The indicators on the page start where they are.
  await new Promise((done) => setTimeout(done, 50));
  animate.mockClear();
  pressWith(page.get('.tab-grid'));
  await page.waitFor(() => expect(page.get('.tab-grid').querySelector('.bar')).not.toBeNull());
  await page.waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
  const [frames, options] = animate.mock.calls[0]! as [
    { transform: string }[],
    { duration: number },
  ];
  expect(frames[0]!.transform).toContain('translate(');
  expect(frames[1]!.transform).toBe('none');
  expect(options.duration).toBe(200);
  // An indicator with no transition does not move.
  animate.mockClear();
  pressWith(page.get('.size-s'));
  await page.waitFor(() => expect(page.get('.size-s').querySelector('.dot')).not.toBeNull());
  await new Promise((done) => setTimeout(done, 50));
  expect(animate).not.toHaveBeenCalled();
});

it('moves from where the last indicator is now, after the layout changed', async () => {
  const animate = vi.fn();
  Element.prototype.animate = animate as unknown as Element['animate'];
  // happy-dom lays nothing out, so each tab has a box at its own x.
  const left = { list: 0, grid: 50 };
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const tab = this.closest('.tab-list, .tab-grid');
    if (!tab) {
      return new DOMRect(0, 0, 0, 0);
    }
    return new DOMRect(tab.classList.contains('tab-list') ? left.list : left.grid, 0, 50, 20);
  });
  const page = await indicators();
  await new Promise((done) => setTimeout(done, 50));
  // The tabs move after the indicator on the page started, such as on a resize.
  left.list = 100;
  left.grid = 150;
  animate.mockClear();
  // The keys select, since a press checks where the pointer is in the boxes.
  page.get('.tab-list').focus();
  press('ArrowRight', page.get('.tab-list'));
  await page.waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
  const [frames] = animate.mock.calls[0]! as [{ transform: string }[]];
  expect(frames[0]!.transform).toBe('translate(-50px, 0px) scale(1, 1)');
});
