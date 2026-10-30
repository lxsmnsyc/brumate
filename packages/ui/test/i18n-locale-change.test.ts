// A locale that changes at run time reaches the parts that format with it.
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Fixture from './fixtures/i18n-locale-change.brm?brumate-server';

vi.setConfig({ testTimeout: 30000 });

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

/** Clicks a button until its effect shows, since the first event of a part loads its code. */
async function switchTo(view: Awaited<ReturnType<typeof mount>>, button: string, locale: string) {
  await view.waitFor(() => {
    if (view.text('.locale-state') !== locale) {
      (view.get(button) as HTMLElement).click();
    }
    expect(view.text('.locale-state')).toBe(locale);
  });
}

it('formats the parts again when the locale of the provider changes', async () => {
  const view = await mount(Fixture, {});
  unmount = view.unmount;
  const read = () => ({
    meter: view.get('.meter').getAttribute('aria-valuetext'),
    progress: view.get('.progress').getAttribute('aria-valuetext'),
    number: (view.get('.number-input') as HTMLInputElement).value,
    slider: view.text('.slider-output'),
    thumb: view.get('.thumb input, .thumb [role="slider"]').getAttribute('aria-valuetext'),
    color: (view.get('.color-input') as HTMLInputElement).value,
    heading: view.text('.heading'),
  });
  const before = read();
  expect(before.meter).toBe('1,234.5');
  await switchTo(view, '.german', 'de-DE');
  await view.waitFor(() => expect(read().meter).toBe('1.234,5'));
  const german = read();
  expect(german.progress).toBe('1.234,5');
  expect(german.number).toBe('1.234,5');
  expect(before.slider).toBe('1,234');
  expect(german.slider).toBe('1.234');
  expect(german.thumb).toBe('1.234');
  expect(before.color).toBe('50%');
  expect(german.color).toBe('50\u00a0%');
  expect(german.heading).not.toBe(before.heading);
});
