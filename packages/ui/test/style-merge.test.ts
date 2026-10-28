// A `style` prop on a part that sets its own style keeps both.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Styled from './fixtures/styled.brm?brumate-server';
import StyledOverlays from './fixtures/styledOverlays.brm?brumate-server';
import { pointer, pressWith } from './interact.ts';
import { mergeStyle } from '../src/style.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
  document.documentElement.removeAttribute('style');
});

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

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

async function overlays() {
  const page = await mount(StyledOverlays, {});
  unmount = page.unmount;
  return page;
}

it('keeps position: fixed and the style of the user on a Popover, with a string', async () => {
  const page = await overlays();
  pressWith(page.get('.pop-trigger'));
  await page.waitFor(() => expect(find('.pop')).not.toBeNull());
  const pop = find('.pop')!;
  expect(pop.style.position).toBe('fixed');
  expect(pop.style.color).toBe('blue');
});

it('keeps position: fixed on a Popover with an object, whatever position the user sets', async () => {
  const page = await overlays();
  pressWith(page.get('.pop-object-trigger'));
  await page.waitFor(() => expect(find('.pop-object')).not.toBeNull());
  const pop = find('.pop-object')!;
  expect(pop.style.position).toBe('fixed');
  expect(pop.style.color).toBe('red');
});

it('keeps the placement of a Popover when its style changes', async () => {
  const page = await overlays();
  pressWith(page.get('.pop-trigger'));
  await page.waitFor(() => expect(find('.pop')).not.toBeNull());
  const pop = find('.pop')!;
  await page.waitFor(() => expect(pop.style.getPropertyValue('--available-height')).not.toBe(''));
  const before = [
    pop.style.top,
    pop.style.left,
    pop.style.getPropertyValue('--trigger-width'),
    pop.style.getPropertyValue('--available-height'),
  ];
  page.click('.live');
  await page.waitFor(() => expect(pop.style.color).toBe('red'));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(pop.style.position).toBe('fixed');
  expect([
    pop.style.top,
    pop.style.left,
    pop.style.getPropertyValue('--trigger-width'),
    pop.style.getPropertyValue('--available-height'),
  ]).toEqual(before);
});

it('keeps position: fixed and the style of the user on a Tooltip', async () => {
  const page = await overlays();
  pointer('pointerenter', page.get('.tip-trigger'));
  await page.waitFor(() => expect(find('.tip')).not.toBeNull());
  expect(find('.tip')!.style.position).toBe('fixed');
  expect(find('.tip')!.style.color).toBe('red');
  pointer('pointerleave', page.get('.tip-trigger'));
  await page.waitFor(() => expect(find('.tip')).toBeNull());
  pointer('pointerenter', page.get('.tip-object-trigger'));
  await page.waitFor(() => expect(find('.tip-object')).not.toBeNull());
  expect(find('.tip-object')!.style.position).toBe('fixed');
  expect(find('.tip-object')!.style.color).toBe('red');
});

it('keeps position: fixed and the style of the user on a ModalOverlay', async () => {
  const page = await overlays();
  pressWith(page.get('.modal-trigger'));
  await page.waitFor(() => expect(find('.modal')).not.toBeNull());
  expect(find('.modal')!.style.position).toBe('fixed');
  expect(find('.modal')!.style.color).toBe('red');
});

it('keeps the inset of a ModalOverlay with an object', async () => {
  const page = await overlays();
  pressWith(page.get('.modal-object-trigger'));
  await page.waitFor(() => expect(find('.modal-object')).not.toBeNull());
  const modal = find('.modal-object')!;
  expect(modal.style.position).toBe('fixed');
  expect(modal.style.inset).toBe('0');
  expect(modal.style.color).toBe('red');
});

it('merges a string, an object and no style, with the style of the part last', () => {
  expect(mergeStyle('b: 2;', 'a: 1')).toBe('b: 2;a: 1');
  expect(mergeStyle({ fontSize: '2px', gone: null, hidden: false }, 'a: 1;')).toBe(
    'font-size:2px;a: 1;',
  );
  expect(mergeStyle({ '--size': '3px', zIndex: 4 }, 'a: 1')).toBe('--size:3px;z-index:4;a: 1');
  expect(mergeStyle(false, 'a: 1')).toBe('a: 1');
  expect(mergeStyle(undefined, 'a: 1')).toBe('a: 1');
  expect(mergeStyle('b: 2', undefined)).toBe('b: 2');
  expect(mergeStyle(undefined, undefined)).toBeUndefined();
});
