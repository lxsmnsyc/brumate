// The tests of Disclosure follow the tests of Disclosure and DisclosureGroup in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Disclosures from './fixtures/disclosures.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
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
