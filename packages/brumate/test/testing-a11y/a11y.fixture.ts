// Run by test/testing-a11y.test.ts, in happy-dom, with the brumate plugin.
import { expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Button from './Button.brm?brumate-server';

it('throws for a button with no name, and names the rule and the element', async () => {
  const page = await mount(Button, { named: false });
  const error = await page.checkAccessibility().then(
    () => undefined,
    (thrown: Error) => thrown,
  );
  expect(error?.message).toContain('button-name');
  expect(error?.message).toContain('class="icon"');
  page.unmount();
});

it('passes for a button with a name, with no rule about the whole page', async () => {
  const page = await mount(Button, { named: true });
  await expect(page.checkAccessibility()).resolves.toBeUndefined();
  page.unmount();
});

it('lets the test turn a rule off', async () => {
  const page = await mount(Button, { named: false });
  await expect(
    page.checkAccessibility({ rules: { 'button-name': { enabled: false } } }),
  ).resolves.toBeUndefined();
  page.unmount();
});

it('says how to install axe-core when it is missing', async () => {
  vi.doMock('axe-core', () => {
    throw new Error('Cannot find package');
  });
  try {
    const page = await mount(Button, { named: true });
    await expect(page.checkAccessibility()).rejects.toThrow('npm install --save-dev axe-core');
    page.unmount();
  } finally {
    vi.doUnmock('axe-core');
  }
});

it('does not load axe-core for a test that never checks', async () => {
  vi.doMock('axe-core', () => {
    throw new Error('Loaded');
  });
  try {
    const page = await mount(Button, { named: true });
    expect(page.text('button')).toBe('Save');
    page.unmount();
  } finally {
    vi.doUnmock('axe-core');
  }
});
