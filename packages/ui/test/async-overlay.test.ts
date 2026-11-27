// Where focus goes when an overlay opens on content that is not there yet: a `#loading` body that
// waits for a value in the browser. A `#defer` body cannot be there, and the project check reports
// it. An overlay takes focus once, when it has opened, so the guide "Content that loads late"
// (website/ui/async-content.md) follows these tests.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeProjectDefers } from 'brumate';
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

// The browser renders the content of an overlay when it opens, and a `#defer` block that the
// browser renders keeps its fallback (website/docs/async-data.md, "#defer"). The server cannot
// render it again, so the project check reports the block in the children of the overlay.

// The parts of the package and one fixture, keyed by path as the plugin keys them.
function projectWith(fixture: string): { sources: Map<string, string>; path: string } {
  const sources = new Map<string, string>();
  const src = resolve('src');
  for (const name of readdirSync(src)) {
    if (name.endsWith('.brm')) {
      sources.set(`${src}/${name}`, readFileSync(`${src}/${name}`, 'utf8'));
    }
  }
  const path = resolve('test/fixtures', fixture);
  sources.set(path, readFileSync(path, 'utf8'));
  return { sources, path };
}

it('reports a #defer in the Dialog of a Popover and of a Modal', () => {
  const { sources, path } = projectWith('defer-overlays.brm');
  const found = analyzeProjectDefers(sources).get(path) ?? [];
  expect(found.map((block) => block.component)).toEqual(['Popover', 'Modal']);
  for (const block of found) {
    expect(sources.get(path)!.slice(block.start, block.end)).toBe('#defer');
  }
});

it('reports no #defer for a #loading body in an overlay', () => {
  const { sources, path } = projectWith('async-overlays.brm');
  expect(analyzeProjectDefers(sources).get(path)).toBeUndefined();
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
