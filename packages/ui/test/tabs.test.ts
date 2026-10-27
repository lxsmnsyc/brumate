// The tests of Tabs.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import TabsFixture from './fixtures/tabs.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function tabs() {
  const page = await mount(TabsFixture, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof tabs>>;

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

it('selects the first tab, links each tab to its panel, and renders only that panel', async () => {
  const page = await tabs();
  const intro = page.get('.tab-intro');
  expect(page.get('.tablist').getAttribute('role')).toBe('tablist');
  expect(intro.getAttribute('role')).toBe('tab');
  expect(intro.getAttribute('aria-selected')).toBe('true');
  expect(intro.getAttribute('tabindex')).toBe('0');
  expect(page.get('.tab-usage').getAttribute('tabindex')).toBe('-1');
  expect(page.get('.tab-locked').getAttribute('aria-disabled')).toBe('true');
  const panel = page.get('.panel-intro');
  expect(panel.getAttribute('role')).toBe('tabpanel');
  expect(intro.getAttribute('aria-controls')).toBe(panel.id);
  expect(panel.getAttribute('aria-labelledby')).toBe(intro.id);
  expect(find('.panel-usage')).toBeNull();
  // A panel that the caller keeps on the page is hidden while its tab is not selected.
  expect(page.get('.panel-api').hidden).toBe(true);
});

it('selects a tab with a press, and the panel shows it', async () => {
  const page = await tabs();
  pressWith(page.get('.tab-usage'));
  await page.waitFor(() => expect(find('.panel-usage')).not.toBeNull());
  expect(find('.panel-intro')).toBeNull();
  expect(page.get('.tab-usage').getAttribute('aria-selected')).toBe('true');
  expect(state(page)[0]).toBe('usage');
  // A disabled tab is not selected.
  pressWith(page.get('.tab-locked'));
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[0]).toBe('usage');
});

it('moves with the arrow keys past disabled tabs, round the ends, and selects as it goes', async () => {
  const page = await tabs();
  const intro = page.get('.tab-intro');
  intro.focus();
  press('ArrowRight', intro);
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tab-usage')));
  await page.waitFor(() => expect(state(page)[0]).toBe('usage'));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tab-api')));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(intro));
  press('End');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tab-api')));
  await page.waitFor(() => expect(page.get('.panel-api').hidden).toBe(false));
});

it('selects with Enter in manual activation, and moves with the keys of its orientation', async () => {
  const page = await tabs();
  const two = page.get('.tab-two');
  expect(page.get('.manual-list').getAttribute('aria-orientation')).toBe('vertical');
  two.focus();
  press('ArrowUp', two);
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tab-one')));
  expect(state(page)[1]).toBe('two');
  press('Enter');
  await page.waitFor(() => expect(state(page)[1]).toBe('one'));
  await page.waitFor(() => expect(find('.panel-one')).not.toBeNull());
});

it('renders a panel anew, with new state, each time its tab is selected again', async () => {
  const page = await tabs();
  pressWith(page.get('.toggle'));
  await page.waitFor(() => expect(page.get('.toggle').getAttribute('aria-pressed')).toBe('true'));
  pressWith(page.get('.tab-usage'));
  await page.waitFor(() => expect(find('.toggle')).toBeNull());
  pressWith(page.get('.tab-intro'));
  await page.waitFor(() => expect(find('.toggle')).not.toBeNull());
  expect(page.get('.toggle').getAttribute('aria-pressed')).toBe('false');
});

it('selects the first enabled tab for a key that no tab has', async () => {
  const page = await tabs();
  await page.waitFor(() => expect(page.get('.tab-m2').getAttribute('aria-selected')).toBe('true'));
  expect(page.get('.tab-m2').getAttribute('tabindex')).toBe('0');
  expect(page.text('.panel-m2')).toBe('Second.');
});

it('takes Tab on a panel only when its content takes none', async () => {
  const page = await tabs();
  // The panel of Intro holds a button, so Tab goes to it and not to the panel.
  await page.waitFor(() => expect(page.get('.panel-intro').hasAttribute('tabindex')).toBe(false));
  expect(page.get('.panel-api').getAttribute('tabindex')).toBe('0');
});

it('prevents only the arrow keys of its axis, and vertical tabs take all four', async () => {
  const page = await tabs();
  const keyDown = (key: string, target: Element) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  page.get('.tab-one').focus();
  press('ArrowRight', page.get('.tab-one'));
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tab-two')));
  expect(keyDown('ArrowRight', page.get('.tab-intro'))).toBe(true);
  expect(keyDown('ArrowDown', page.get('.tab-intro'))).toBe(false);
  expect(keyDown('ArrowDown', page.get('.tab-one'))).toBe(true);
  expect(keyDown('ArrowRight', page.get('.tab-one'))).toBe(true);
});
