// The order of the change handlers and the effects of a part whose value has a setter.
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import HandlerOrder from './fixtures/handler-order.brm?brumate-server';
import { press } from './interact.ts';

vi.setConfig({ testTimeout: 30000 });

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
});

async function ordered() {
  const page = await mount(HandlerOrder, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof ordered>>;

function order(page: Page) {
  return JSON.parse(page.text('.state')) as string[];
}

it('calls onSelectionChange of a Menu before onAction and onClose', async () => {
  const page = await ordered();
  const trigger = page.get('.trigger');
  trigger.focus();
  press('ArrowDown', trigger);
  await page.waitFor(() => expect(document.querySelector('.left')).not.toBeNull(), 10000);
  const item = document.querySelector('.center') as HTMLElement;
  item.focus();
  press('Enter', item);
  await page.waitFor(() => expect(order(page)).toContain('close'), 10000);
  expect(order(page).filter((name) => !name.startsWith('effect'))).toEqual([
    'selection',
    'action',
    'close',
  ]);
});

it('calls onSelectionChange of Tabs before an effect on the key runs', async () => {
  const page = await ordered();
  (page.get('.tab-two') as HTMLElement).click();
  await page.waitFor(() => expect(order(page)).toContain('effect two'), 10000);
  const names = order(page);
  expect(names.indexOf('tabs')).toBeGreaterThanOrEqual(0);
  expect(names.indexOf('tabs')).toBeLessThan(names.indexOf('effect two'));
});
