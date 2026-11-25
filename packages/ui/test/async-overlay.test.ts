// Where focus goes when an overlay opens on content that is not there yet: a `#defer` body, or a
// `#loading` body that waits for a value in the browser. An overlay takes focus once, when it has
// opened, so the guide "Content that loads late" (website/ui/async-content.md) follows these tests.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Overlays from './fixtures/async-overlays.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  // A portal renders outside the mounted container, which unmount removes.
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
  document.documentElement.removeAttribute('style');
});

async function overlays() {
  const page = await mount(Overlays, {});
  unmount = page.unmount;
  return page;
}

const find = (selector: string) => document.querySelector<HTMLElement>(selector);
// Longer than the 30 ms of the late value, and than the triggers of `#defer` in a test.
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

it('focuses the Dialog of a Popover that opens on a #defer body', async () => {
  const page = await overlays();
  pressWith(page.get('.defer-trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.defer-dialog')));
  expect(find('.defer-fallback')).not.toBeNull();
  await settle();
  expect(document.activeElement).toBe(find('.defer-dialog'));
});

it('focuses the Dialog of a Modal that opens on a #defer body', async () => {
  const page = await overlays();
  pressWith(page.get('.modal-defer-trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.modal-defer-dialog')));
  expect(find('.modal-defer-fallback')).not.toBeNull();
});

// The gap: the browser renders the content of an overlay when it opens, and a `#defer` block that
// the browser renders keeps its fallback (website/docs/async-data.md, "#defer"). Reported as a
// node of the roadmap; this test passes once the body arrives.
it.fails('renders the #defer body of an overlay that the browser opens', async () => {
  const page = await overlays();
  pressWith(page.get('.defer-trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.defer-dialog')));
  await settle();
  expect(find('.defer-field')).not.toBeNull();
});

it('keeps focus on the Dialog when a #loading body arrives after it opened', async () => {
  const page = await overlays();
  pressWith(page.get('.loading-trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.loading-dialog')));
  // Focus moved while the fallback showed, so the autofocus of the body came too late.
  expect(find('.late-fallback')).not.toBeNull();
  await page.waitFor(() => expect(find('.late-field')).not.toBeNull());
  expect(find('.late-fallback')).toBeNull();
  expect(document.activeElement).toBe(find('.loading-dialog'));
});

it('loads a #loading body again each time its overlay opens', async () => {
  const page = await overlays();
  pressWith(page.get('.loading-trigger'));
  await page.waitFor(() => expect(find('.late-field')).not.toBeNull());
  press('Escape', find('.loading-dialog')!);
  await page.waitFor(() => expect(find('.loading-dialog')).toBeNull());
  pressWith(page.get('.loading-trigger'));
  await page.waitFor(() => expect(find('.loading-dialog')).not.toBeNull());
  // The content of a closed overlay is gone, so its memo starts over.
  expect(find('.late-fallback')).not.toBeNull();
  await page.waitFor(() => expect(find('.late-field')).not.toBeNull());
});
