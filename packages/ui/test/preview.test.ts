// The tests of PreviewTrigger.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Previews from './fixtures/previews.brm?brumate-server';
import { pointer, press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(async () => {
  unmount?.();
  // A portal renders outside the mounted container, which unmount removes.
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  // The others show at once for half a second after a preview hides.
  await wait(600);
});

async function previews() {
  const page = await mount(Previews, {});
  unmount = page.unmount;
  return page;
}

const find = (selector: string) => document.querySelector<HTMLElement>(selector);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function hoverOpen(page: Awaited<ReturnType<typeof previews>>) {
  pointer('pointerenter', page.get('.author'));
  // The preview places itself and starts to listen for a press outside a frame after it shows.
  await page.waitFor(() => expect(find('.card')?.closest('[data-placement]')).toBeTruthy());
}

it('shows after its delay on hover, without moving focus or the page', async () => {
  const page = await previews();
  const author = page.get('.author');
  author.focus();
  pointer('pointerenter', author);
  await wait(20);
  expect(find('.card')).toBeNull();
  await page.waitFor(() => expect(find('.card')).not.toBeNull());
  await page.waitFor(() => expect(author.getAttribute('aria-expanded')).toBe('true'));
  expect(author.getAttribute('aria-controls')).toBe(find('.card')!.id);
  // A button inside the preview is not its trigger.
  expect(find('.follow')!.hasAttribute('aria-expanded')).toBe(false);
  expect(find('.follow')!.id).not.toBe(author.id);
  await wait(50);
  expect(document.activeElement).toBe(author);
  expect(page.get('.page').closest('[inert]')).toBeNull();
  await page.waitFor(() => expect(page.text('.state')).toBe('true'));
});

it('stays while the pointer is over it, and hides when the pointer goes elsewhere', async () => {
  const page = await previews();
  await hoverOpen(page);
  pointer('pointerleave', page.get('.author'));
  find('.follow')!.dispatchEvent(
    new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
  );
  await wait(150);
  expect(find('.card')).not.toBeNull();
  page
    .get('.after')
    .dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  await page.waitFor(() => expect(find('.card')).toBeNull());
});

it('moves Tab into the preview and on past it, and Escape gives focus back', async () => {
  const page = await previews();
  await hoverOpen(page);
  const author = page.get('.author');
  author.focus();
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  author.dispatchEvent(tab);
  expect(tab.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(find('.follow'));
  find('.profile')!.focus();
  const past = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  find('.profile')!.dispatchEvent(past);
  expect(past.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(page.get('.after'));
  // Focus left both, so it hides.
  await page.waitFor(() => expect(find('.card')).toBeNull());
  pointer('pointerleave', author);
  await hoverOpen(page);
  find('.follow')!.focus();
  press('Escape', find('.follow')!);
  await page.waitFor(() => expect(find('.card')).toBeNull());
  expect(document.activeElement).toBe(author);
});

it('stays open while focus is inside, when the pointer moves over the page', async () => {
  const page = await previews();
  await hoverOpen(page);
  find('.follow')!.focus();
  pointer('pointerover', page.get('.before'));
  await wait(150);
  expect(find('.card')).not.toBeNull();
});

it('closes on Escape when focus is elsewhere, and leaves focus there', async () => {
  const page = await previews();
  page.get('.before').focus();
  await hoverOpen(page);
  press('Escape', page.get('.before'));
  await page.waitFor(() => expect(find('.card')).toBeNull());
  expect(document.activeElement).toBe(page.get('.before'));
});

it('opens on the next focus of the trigger after a press outside closed it', async () => {
  const page = await previews();
  page.get('.before').focus();
  await hoverOpen(page);
  pointer('pointerleave', page.get('.author'));
  pointer('pointerdown', document.body);
  pointer('pointerup', document.body);
  await page.waitFor(() => expect(find('.card')).toBeNull());
  await wait(600);
  page.get('.author').focus();
  await page.waitFor(() => expect(find('.card')).not.toBeNull());
});

it('shows the next one at once, one at a time', async () => {
  const page = await previews();
  await hoverOpen(page);
  pointer('pointerleave', page.get('.author'));
  pointer('pointerenter', page.get('.other'));
  await page.waitFor(() => expect(find('.other-card')).not.toBeNull());
  await page.waitFor(() => expect(find('.card')).toBeNull());
});

it('shows on a long press of a touch, and the release follows no link', async () => {
  // happy-dom matches :focus-visible on any focus. A touch that focuses shows no focus ring.
  const matches = Element.prototype.matches;
  Element.prototype.matches = function (this: Element, selector: string) {
    return selector === ':focus-visible' ? false : matches.call(this, selector);
  } as typeof matches;
  try {
    const page = await previews();
    const author = page.get('.author');
    pointer('pointerdown', author, { pointerType: 'touch' });
    await wait(300);
    expect(find('.card')).toBeNull();
    await page.waitFor(() => expect(find('.card')).not.toBeNull(), 2000);
    pointer('pointerup', author, { pointerType: 'touch' });
    // The click of a touch has a detail of 1.
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    author.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    // The long press cancelled the press of the link, so the release pressed nothing.
    await wait(50);
    expect(page.text('.presses')).toBe('0');
    // The browser shows no menu for the held link.
    pointer('pointerdown', author, { pointerType: 'touch' });
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    author.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    pointer('pointerup', author, { pointerType: 'touch' });
  } finally {
    Element.prototype.matches = matches;
  }
});

it('stays hidden after a press of the trigger that a hover had opened, also when the press focuses it', async () => {
  const page = await previews();
  await hoverOpen(page);
  const author = page.get('.author');
  pointer('pointerdown', author);
  await page.waitFor(() => expect(find('.card')).toBeNull());
  // The press focuses the trigger after it has hidden the preview.
  author.focus();
  pointer('pointerup', author);
  await wait(700);
  expect(find('.card')).toBeNull();
});
