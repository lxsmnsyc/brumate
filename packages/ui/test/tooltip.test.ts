// The tests of TooltipTrigger and Tooltip follow the tests of Tooltip in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Tooltips from './fixtures/tooltips.brm?brumate-server';
import { pointer, press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(async () => {
  unmount?.();
  // A portal renders outside the mounted container, which unmount removes.
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
  // The others show at once for half a second after a tooltip hides.
  await wait(600);
});

async function tooltips() {
  const page = await mount(Tooltips, {});
  unmount = page.unmount;
  return page;
}

const find = (selector: string) => document.querySelector<HTMLElement>(selector);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

it('renders nothing until it shows', async () => {
  const page = await tooltips();
  expect(find('.tip')).toBeNull();
  expect(page.get('.save').hasAttribute('aria-describedby')).toBe(false);
});

it('shows after its delay on hover, beside its trigger, and describes it', async () => {
  const page = await tooltips();
  const save = page.get('.save');
  pointer('pointerenter', save);
  await wait(20);
  expect(find('.tip')).toBeNull();
  await page.waitFor(() => expect(find('.tip')).not.toBeNull());
  const tip = find('.tip')!;
  expect(tip.getAttribute('role')).toBe('tooltip');
  expect(tip.closest('[data-layer]')!.parentElement).toBe(document.body);
  expect(tip.style.position).toBe('fixed');
  await page.waitFor(() => expect(save.getAttribute('aria-describedby')).toBe(tip.id));
  await page.waitFor(() => expect(tip.dataset.placement).toBe('top'));
  expect(find('.arrow')!.dataset.placement).toBe('top');
  await page.waitFor(() => expect(page.text('.state')).toBe('true'));
  // It takes no focus.
  expect(document.activeElement).not.toBe(tip);
});

it('never shows on a touch, or when disabled', async () => {
  const page = await tooltips();
  pointer('pointerenter', page.get('.save'), { pointerType: 'touch' });
  pointer('pointerenter', page.get('.disabled'));
  await wait(150);
  expect(find('.tip')).toBeNull();
  expect(find('.disabled-tip')).toBeNull();
});

it('hides after its close delay, and stays while the pointer is over it', async () => {
  const page = await tooltips();
  const save = page.get('.save');
  pointer('pointerenter', save);
  await page.waitFor(() => expect(find('.tip')).not.toBeNull());
  pointer('pointerleave', save);
  pointer('pointerenter', find('.tip')!);
  await wait(150);
  expect(find('.tip')).not.toBeNull();
  pointer('pointerleave', find('.tip')!);
  await page.waitFor(() => expect(find('.tip')).toBeNull());
  expect(save.hasAttribute('aria-describedby')).toBe(false);
});

it('shows the next one at once once one has shown, and one at a time', async () => {
  const page = await tooltips();
  pointer('pointerenter', page.get('.save'));
  await page.waitFor(() => expect(find('.tip')).not.toBeNull());
  pointer('pointerleave', page.get('.save'));
  pointer('pointerenter', page.get('.other'));
  // No delay: the first one has shown.
  await page.waitFor(() => expect(find('.other-tip')).not.toBeNull());
  await page.waitFor(() => expect(find('.tip')).toBeNull());
});

it('hides on Escape and on a press of its trigger', async () => {
  const page = await tooltips();
  pointer('pointerenter', page.get('.save'));
  await page.waitFor(() => expect(find('.tip')).not.toBeNull());
  press('Escape', document.body);
  await page.waitFor(() => expect(find('.tip')).toBeNull());
  pointer('pointerleave', page.get('.save'));
  await wait(600);
  pointer('pointerenter', page.get('.save'));
  await page.waitFor(() => expect(find('.tip')).not.toBeNull());
  pointer('pointerdown', page.get('.save'));
  await page.waitFor(() => expect(find('.tip')).toBeNull());
});

it('shows only on focus with trigger="focus"', async () => {
  const page = await tooltips();
  pointer('pointerenter', page.get('.focus-only'));
  await wait(100);
  expect(find('.focus-tip')).toBeNull();
});

it('keeps what a DialogTrigger around it gives the button', async () => {
  const page = await tooltips();
  const settings = page.get('.settings');
  expect(settings.hasAttribute('aria-expanded')).toBe(true);
  pointer('pointerenter', settings);
  await page.waitFor(() => expect(find('.settings-tip')).not.toBeNull());
  // The press hides the tooltip and opens the popover, which finds the button by its ID.
  pressWith(settings);
  await page.waitFor(() => expect(find('.popover')).not.toBeNull());
  await page.waitFor(() => expect(find('.settings-tip')).toBeNull());
  expect(settings.getAttribute('aria-controls')).toBe(find('.popover')!.id);
  await page.waitFor(() => expect(find('.popover')!.dataset.placement).toBe('bottom'));
});
