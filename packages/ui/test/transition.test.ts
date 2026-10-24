// The tests of Transition follow the tests of Transition in Terracotta.
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

it('renders the content as show says, with no transition on load', async () => {
  const page = await transitions();
  expect(page.container.querySelector('.panel')).toBeNull();
  const kept = page.get('.kept');
  expect(kept.hasAttribute('hidden')).toBe(false);
  expect(kept.hasAttribute('data-transition')).toBe(false);
});

/**
 * Records the classes and the transition attributes of the element that matches `selector`,
 * each time they change, from before it is in the page.
 */
function record(root: Element, selector: string): string[] {
  const steps: string[] = [];
  const write = () => {
    const element = root.querySelector(selector);
    if (!element) {
      return;
    }
    const flags = ['data-closed', 'data-enter', 'data-leave']
      .filter((name) => element.hasAttribute(name))
      .map((name) => name.slice(5));
    // Sorted, so a step reads the same whatever the order of the classes.
    const step = [...element.classList, ...flags].toSorted().join(' ');
    if (steps.at(-1) !== step) {
      steps.push(step);
    }
  };
  new MutationObserver(write).observe(root, { attributes: true, childList: true, subtree: true });
  return steps;
}

it('moves through its classes and data attributes as it enters, then leaves', async () => {
  const page = await transitions();
  const steps = record(page.container, '.panel');
  page.click('.toggle');
  // With no CSS transition, it ends after its frames.
  await page.waitFor(() =>
    expect(globalThis.partEvents).toEqual([{ type: 'entered', value: true }]),
  );
  // The first frame has the from classes and is closed. With no CSS transition, the step after
  // it and the end come in one task.
  expect(steps[0]).toBe('closed enter entering from panel');
  expect(steps.at(-1)).toBe('panel');
  takeEvents();
  page.click('.toggle');
  // It stays in the page until its leave ends, then leaves it.
  await page.waitFor(() => expect(page.container.querySelector('.panel')).toBeNull());
  await page.waitFor(() => expect(globalThis.partEvents).toEqual([{ type: 'left', value: true }]));
  expect(steps).toContain('leave leaving panel to');
});

it('waits for the duration of a CSS transition before it removes the content', async () => {
  const page = await transitions();
  page.click('.toggle');
  await page.waitFor(() => expect(page.get('.panel').hasAttribute('data-transition')).toBe(false));
  const panel = page.get('.panel') as HTMLElement;
  panel.style.transitionDuration = '200ms';
  page.click('.toggle');
  await page.waitFor(() => expect(panel.hasAttribute('data-leave')).toBe(true));
  await new Promise((resolve) => setTimeout(resolve, 100));
  // Half way, it is still there.
  expect(panel.isConnected).toBe(true);
  await page.waitFor(() => expect(page.container.querySelector('.panel')).toBeNull(), 2000);
});

it('keeps the content hidden with unmount=(false)', async () => {
  const page = await transitions();
  const kept = page.get('.kept');
  page.click('.hide');
  await page.waitFor(() => expect(kept.hasAttribute('hidden')).toBe(true));
  expect(kept.isConnected).toBe(true);
  expect(kept.hasAttribute('data-closed')).toBe(true);
  page.click('.hide');
  await page.waitFor(() => expect(kept.hasAttribute('hidden')).toBe(false));
});
