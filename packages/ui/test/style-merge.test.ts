// A `style` prop on a part that sets its own style keeps both.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Styled from './fixtures/styled.brm?brumate-server';
import { mergeStyle } from '../src/style.ts';

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

async function styled() {
  const page = await mount(Styled, {});
  unmount = page.unmount;
  return page;
}

it('keeps --percentage and the style of the user on a Meter', async () => {
  const page = await styled();
  for (const [name, gap] of [
    ['meter-string', ''],
    ['meter-object', '2px'],
    ['meter-none', ''],
  ] as const) {
    const meter = page.get(`.${name}`);
    expect(meter.style.getPropertyValue('--percentage')).toBe('40%');
    expect(meter.style.width).toBe(name === 'meter-none' ? '' : '200px');
    expect(meter.style.getPropertyValue('--gap')).toBe(gap);
  }
});

it('keeps --percentage and the style of the user on a ProgressBar', async () => {
  const page = await styled();
  for (const [name, gap] of [
    ['bar-string', ''],
    ['bar-object', '2px'],
    ['bar-none', ''],
  ] as const) {
    const bar = page.get(`.${name}`);
    expect(bar.style.getPropertyValue('--percentage')).toBe('75%');
    expect(bar.style.width).toBe(name === 'bar-none' ? '' : '200px');
    expect(bar.style.getPropertyValue('--gap')).toBe(gap);
  }
});

it('keeps the style of the user on an indeterminate ProgressBar', async () => {
  const page = await styled();
  const bar = page.get('.bar-wait');
  expect(bar.style.getPropertyValue('--percentage')).toBe('');
  expect(bar.style.width).toBe('200px');
});

it('keeps position: absolute on an OverlayArrow with a style', async () => {
  const page = await styled();
  const arrow = page.get('.arrow');
  expect(arrow.style.position).toBe('absolute');
  expect(arrow.style.left).toBe('4px');
});

it('merges a string, an object and no style', () => {
  expect(mergeStyle('a: 1', 'b: 2;')).toBe('a: 1;b: 2;');
  expect(mergeStyle('a: 1;', { fontSize: '2px', gone: null })).toBe('a: 1;font-size:2px');
  expect(mergeStyle('a: 1', undefined)).toBe('a: 1');
  expect(mergeStyle(undefined, undefined)).toBeUndefined();
  expect(mergeStyle(undefined, 'b: 2')).toBe('b: 2');
});
