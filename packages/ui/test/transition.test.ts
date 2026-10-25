// The tests of Transition follow the tests of Transition in Terracotta 2.x.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Transitions from './fixtures/transitions.brm?brumate-server';
import { takeEvents } from './fixtures/log.ts';

let unmount: (() => void) | undefined;
beforeEach(() => takeEvents());
afterEach(() => unmount?.());

async function transitions() {
  const page = await mount(Transitions, {});
  unmount = page.unmount;
  return page;
}

/**
 * Records the classes and the flags of the element that matches `selector`, sorted, each time
 * they change, from before it is in the page.
 */
function record(root: Element, selector: string): string[] {
  const steps: string[] = [];
  const write = () => {
    const element = root.querySelector(selector);
    if (!element) {
      return;
    }
    const flags = ['data-closed', 'data-enter', 'data-leave', 'inert']
      .filter((name) => element.hasAttribute(name))
      .map((name) => name.replace('data-', ''));
    const step = [...element.classList, ...flags].toSorted().join(' ');
    if (steps.at(-1) !== step) {
      steps.push(step);
    }
  };
  new MutationObserver(write).observe(root, { attributes: true, childList: true, subtree: true });
  return steps;
}

const types = () => (globalThis.partEvents ?? []).map((event) => event.type);

it('renders the content as show says, with no transition on load', async () => {
  const page = await transitions();
  expect(page.container.querySelector('.panel')).toBeNull();
  const kept = page.get('.kept');
  expect(kept.hasAttribute('hidden')).toBe(false);
  expect(kept.hasAttribute('data-transition')).toBe(false);
  expect(kept.hasAttribute('data-closed')).toBe(false);
});

it('moves through its classes and flags as it enters, rests, then leaves', async () => {
  const page = await transitions();
  const steps = record(page.container, '.panel');
  page.click('.toggle');
  await page.waitFor(() => expect(types()).toEqual(['entered']));
  // It renders closed with the from classes, and rests with the entered classes.
  expect(steps[0]).toBe('closed from panel');
  expect(steps).toContain('closed enter entering from panel');
  expect(steps.at(-1)).toBe('panel rest');
  takeEvents();
  page.click('.toggle');
  await page.waitFor(() => expect(page.container.querySelector('.panel')).toBeNull());
  await page.waitFor(() => expect(types()).toEqual(['left']));
  // It is inert from the start of its leave.
  expect(steps).toContain('inert leave leaving panel to');
  expect(steps.join('|')).not.toMatch(/rest[^|]*leav/);
});

it('keeps the content hidden and inert with unmount=(false)', async () => {
  const page = await transitions();
  const kept = page.get('.kept');
  page.click('.hide');
  await page.waitFor(() => expect(kept.hasAttribute('hidden')).toBe(true));
  expect(kept.isConnected).toBe(true);
  expect(kept.hasAttribute('inert')).toBe(true);
  expect(kept.hasAttribute('data-closed')).toBe(true);
  page.click('.hide');
  await page.waitFor(() => expect(kept.hasAttribute('hidden')).toBe(false));
  await page.waitFor(() => expect(kept.hasAttribute('inert')).toBe(false));
});

it('enters a child after its parent, and leaves the parent after its child', async () => {
  const page = await transitions();
  page.click('.group');
  await page.waitFor(() => expect(types()).toContain('child-enter'));
  expect(types().indexOf('parent-entered')).toBeLessThan(types().indexOf('child-enter'));
  expect(page.get('.parent .child').textContent).toBe('Child');
  takeEvents();
  page.click('.group');
  await page.waitFor(() => expect(page.container.querySelector('.parent')).toBeNull());
  expect(types().indexOf('child-left')).toBeLessThan(types().indexOf('parent-leave'));
});

it('leaves out an animation that never ends, such as a spinner inside', async () => {
  const { waitForAnimations } = await import('../src/transition.ts');
  const never = new Promise<void>(() => {});
  const animation = (iterations: number, finished: Promise<void>) =>
    ({ effect: { getComputedTiming: () => ({ iterations }) }, finished }) as unknown as Animation;
  const element = {
    getAnimations: () => [animation(Infinity, never), animation(1, Promise.resolve())],
  } as unknown as Element;
  await expect(waitForAnimations(element, true)).resolves.toBeUndefined();
});
