// An overlay given an open start value is open after load.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import StartOpen from './fixtures/start-open.brm?brumate-server';
import { pointer, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(async () => {
  // Close what is open, so the observers of its inert layers stop before the next mount.
  for (let tries = 0; tries < 20 && document.querySelector('[data-layer] > *'); tries += 1) {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    // oxlint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  unmount?.();
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
});

async function start(kind: string) {
  const page = await mount(StartOpen, { kind });
  unmount = page.unmount;
  return page;
}

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

/** The overlay is in the page, and the page is inert behind it, as after a press. */
async function modalOpen(page: Awaited<ReturnType<typeof start>>) {
  await page.waitFor(() => expect(find('.layer')).not.toBeNull());
  await page.waitFor(() => expect(find('.layer')!.contains(document.activeElement)).toBe(true));
  expect(page.get('.page').closest('[inert]')).not.toBeNull();
  expect(find('.layer')!.closest('[inert]')).toBeNull();
  expect(document.documentElement.style.overflow).toBe('hidden');
}

for (const kind of [
  'popover',
  'popover-own',
  'modal',
  'modal-own',
  'overlay-own',
  'menu',
  'sheet',
] as const) {
  it(`${kind}: a true start value is open after load, with focus in and the page inert`, async () => {
    const page = await start(kind);
    await modalOpen(page);
    expect(find('.layer')).not.toBeNull();
  });
}

for (const kind of ['popover', 'modal', 'menu']) {
  it(`${kind}: the trigger says it is expanded`, async () => {
    const page = await start(kind);
    await page.waitFor(() => expect(find('.layer')).not.toBeNull());
    await page.waitFor(() =>
      expect(page.get('.trigger').getAttribute('aria-expanded')).toBe('true'),
    );
  });
}

for (const kind of ['popover', 'modal']) {
  it(`${kind}: focus is on the dialog, as after a press`, async () => {
    const page = await start(kind);
    await page.waitFor(() => expect(document.activeElement).toBe(find('.dialog')));
  });
}

it('a modal that started open closes with Escape and gives focus back', async () => {
  const page = await start('modal');
  await modalOpen(page);
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  await page.waitFor(() => expect(find('.layer')).toBeNull());
  await page.waitFor(() => expect(page.get('.page').closest('[inert]')).toBeNull());
  expect(document.activeElement).toBe(page.get('.trigger'));
});

it('tooltip: a true start value shows it after load, and describes the trigger', async () => {
  const page = await start('tooltip');
  await page.waitFor(() => expect(find('.layer')).not.toBeNull());
  expect(find('.layer')!.getAttribute('role')).toBe('tooltip');
  await page.waitFor(() =>
    expect(page.get('.trigger').getAttribute('aria-describedby')).toBe(find('.layer')!.id),
  );
  expect(page.get('.page').closest('[inert]')).toBeNull();
});

it('preview: a true start value shows it after load, not modal, and a press of the trigger hides it', async () => {
  const page = await start('preview');
  await page.waitFor(() => expect(find('.layer')).not.toBeNull());
  expect(page.get('.page').closest('[inert]')).toBeNull();
  await page.waitFor(() => expect(page.get('.trigger').getAttribute('aria-expanded')).toBe('true'));
  pressWith(page.get('.trigger'));
  await page.waitFor(() => expect(find('.layer')).toBeNull());
});

it('preview: one that started open closes when the pointer leaves to the page', async () => {
  const page = await start('preview');
  await page.waitFor(() => expect(find('.layer')).not.toBeNull());
  pointer('pointerover', page.get('.outside'));
  await page.waitFor(() => expect(find('.layer')).toBeNull());
  await page.waitFor(() => expect(page.text('.state')).toBe('false'));
});

it('sheet, select and combobox: a true start value is open after load', async () => {
  for (const kind of ['sheet', 'select', 'combobox']) {
    // oxlint-disable-next-line no-await-in-loop
    const page = await start(kind);
    // oxlint-disable-next-line no-await-in-loop
    await page.waitFor(() => expect(find('.layer')).not.toBeNull());
    expect(find('.layer')!.closest('[inert]')).toBeNull();
    unmount?.();
    for (const layer of document.querySelectorAll('[data-layer]')) {
      layer.remove();
    }
    for (const element of document.querySelectorAll('[inert]')) {
      element.removeAttribute('inert');
    }
  }
});

it('two modals that start open stack: the later is on top, the earlier is inert, Escape closes the top first', async () => {
  const page = await start('two');
  await page.waitFor(() => expect(find('.second-dialog')).not.toBeNull());
  await page.waitFor(() => expect(document.activeElement).toBe(find('.second-dialog')));
  expect(find('.second')!.closest('[inert]')).toBeNull();
  expect(find('.first')!.closest('[inert]')).not.toBeNull();
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  await page.waitFor(() => expect(find('.second')).toBeNull());
  expect(page.text('.state')).toBe('true');
  await page.waitFor(() => expect(find('.first')!.closest('[inert]')).toBeNull());
  await page.waitFor(() => expect(document.activeElement).toBe(find('.first-dialog')));
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  await page.waitFor(() => expect(find('.first')).toBeNull());
  await page.waitFor(() => expect(page.get('.page').closest('[inert]')).toBeNull());
});

it('a modal and a menu that start open stack: the menu is on top, the modal is inert, Escape closes the menu first', async () => {
  const page = await start('mixed');
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  await page.waitFor(() => expect(find('.layer')!.contains(document.activeElement)).toBe(true));
  expect(find('.layer')!.closest('[inert]')).toBeNull();
  expect(find('.first')!.closest('[inert]')).not.toBeNull();
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  await page.waitFor(() => expect(find('.menu')).toBeNull());
  expect(find('.first')).not.toBeNull();
  await page.waitFor(() => expect(find('.first')!.closest('[inert]')).toBeNull());
  await page.waitFor(() => expect(document.activeElement).toBe(find('.first-dialog')));
});

it('a non-modal popover that starts open leaves focus in a field that is being typed in', async () => {
  const page = await start('typing');
  await page.waitFor(() => expect(find('.layer')).not.toBeNull());
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(document.activeElement).toBe(page.get('.typing'));
});
