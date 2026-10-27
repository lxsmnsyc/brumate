// The tests of Disclosure.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Disclosures from './fixtures/disclosures.brm?brumate-server';
import { takeEvents } from './fixtures/log.ts';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
beforeEach(() => takeEvents());
afterEach(() => unmount?.());

async function disclosures() {
  const page = await mount(Disclosures, {});
  unmount = page.unmount;
  return page;
}

it('links its trigger and its panel, and hides the panel until found while collapsed', async () => {
  const page = await disclosures();
  const trigger = page.get('.own-trigger');
  const panel = page.get('.own-panel');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
  expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);
  expect(panel.getAttribute('role')).toBe('group');
  expect(panel.getAttribute('hidden')).toBe('until-found');
  // A Button in the panel gets nothing of the trigger.
  expect(page.get('.inner').hasAttribute('aria-expanded')).toBe(false);
  expect(page.get('.own').closest('h3')).toBeNull();
  expect(trigger.closest('h3')).not.toBeNull();
});

it('expands and collapses with a press and with a key, and writes the bound state', async () => {
  const page = await disclosures();
  const trigger = page.get('.own-trigger');
  pressWith(trigger);
  await page.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
  // The panel and the element update with the trigger, each in its own component.
  await page.waitFor(() => expect(page.get('.own-panel').hasAttribute('hidden')).toBe(false));
  await page.waitFor(() => expect(page.get('.own').hasAttribute('data-expanded')).toBe(true));
  await page.waitFor(() => expect(page.text('.open')).toBe('true'));
  trigger.focus();
  press('Enter', trigger);
  await page.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
  await page.waitFor(() =>
    expect(page.get('.own-panel').getAttribute('hidden')).toBe('until-found'),
  );
});

it('expands when find in page reaches its collapsed panel', async () => {
  const page = await disclosures();
  page.get('.own-panel').dispatchEvent(new Event('beforematch', { bubbles: true }));
  await page.waitFor(() => expect(page.text('.open')).toBe('true'));
});

it('opens one disclosure of a group at a time', async () => {
  const page = await disclosures();
  expect(page.get('.shipping-trigger').getAttribute('aria-expanded')).toBe('true');
  expect(page.get('.returns-panel').getAttribute('hidden')).toBe('until-found');
  pressWith(page.get('.returns-trigger'));
  await page.waitFor(() => expect(page.text('.keys')).toBe('returns'));
  await page.waitFor(() =>
    expect(page.get('.shipping-trigger').getAttribute('aria-expanded')).toBe('false'),
  );
  await page.waitFor(() => expect(page.get('.returns-panel').hasAttribute('hidden')).toBe(false));
  pressWith(page.get('.returns-trigger'));
  await page.waitFor(() => expect(page.text('.keys')).toBe(''));
});

it('has no transition flags without transition', async () => {
  const page = await disclosures();
  const panel = page.get('.own-panel');
  expect(panel.hasAttribute('data-closed')).toBe(false);
  pressWith(page.get('.own-trigger'));
  await page.waitFor(() => expect(panel.hasAttribute('hidden')).toBe(false));
  expect(panel.hasAttribute('data-transition')).toBe(false);
});

it('moves a panel with transition through its flags and its height, and a child after it', async () => {
  const page = await disclosures();
  const panel = page.get('.moving-panel') as HTMLElement;
  expect(panel.hasAttribute('data-closed')).toBe(true);
  expect(panel.getAttribute('hidden')).toBe('until-found');
  const steps: string[] = [];
  new MutationObserver(() => {
    steps.push(
      [
        ['data-closed', 'data-enter', 'data-leave', 'inert', 'hidden']
          .filter((name) => panel.hasAttribute(name))
          .join(' '),
        panel.style.getPropertyValue('--disclosure-panel-height'),
      ].join('|'),
    );
  }).observe(panel, { attributes: true });
  pressWith(page.get('.moving-trigger'));
  await page.waitFor(() =>
    expect(globalThis.partEvents).toEqual([{ type: 'row-enter', value: true }]),
  );
  expect(panel.hasAttribute('hidden')).toBe(false);
  expect(panel.hasAttribute('data-closed')).toBe(false);
  // While it entered, the height went from nothing to the height of its content.
  expect(steps.some((step) => step.includes('data-enter') && step.endsWith('|0px'))).toBe(true);
  expect(panel.style.getPropertyValue('--disclosure-panel-height')).toBe('');
  pressWith(page.get('.moving-trigger'));
  await page.waitFor(() => expect(panel.getAttribute('hidden')).toBe('until-found'));
  // It was inert while it left.
  expect(steps.some((step) => step.startsWith('data-leave inert'))).toBe(true);
  expect(panel.hasAttribute('inert')).toBe(false);
  expect(panel.hasAttribute('data-closed')).toBe(true);
});

it('removes the content with unmount=(true), and hides it offscreen with its state', async () => {
  const page = await disclosures();
  expect(page.container.querySelector('.removed-panel')).toBeNull();
  // A panel that starts collapsed offscreen is not rendered until it opens.
  expect(page.container.querySelector('.kept-panel')).toBeNull();
  pressWith(page.get('.removed-trigger'));
  await page.waitFor(() => expect(page.container.querySelector('.removed-panel')).not.toBeNull());
  pressWith(page.get('.removed-trigger'));
  await page.waitFor(() => expect(page.container.querySelector('.removed-panel')).toBeNull());
  pressWith(page.get('.kept-trigger'));
  await page.waitFor(() => expect(page.container.querySelector('.kept-panel')).not.toBeNull());
  const kept = page.get('.kept-panel') as HTMLElement;
  pressWith(page.get('.kept-trigger'));
  await page.waitFor(() => expect(kept.style.display).toBe('none'));
  expect(kept.isConnected).toBe(true);
});

it('puts a disclosure without an id into its group, so one opens at a time', async () => {
  const page = await disclosures();
  pressWith(page.get('.first-trigger'));
  await page.waitFor(() => expect(page.get('.first').hasAttribute('data-expanded')).toBe(true));
  pressWith(page.get('.second-trigger'));
  await page.waitFor(() => expect(page.get('.second').hasAttribute('data-expanded')).toBe(true));
  await page.waitFor(() => expect(page.get('.first').hasAttribute('data-expanded')).toBe(false));
});

it('keeps the panel of a disabled disclosure closed, also for find in page', async () => {
  const page = await disclosures();
  const panel = page.get('.locked-panel');
  expect(panel.getAttribute('hidden')).toBe('');
  panel.dispatchEvent(new Event('beforematch', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(page.get('.locked').hasAttribute('data-expanded')).toBe(false);
});
