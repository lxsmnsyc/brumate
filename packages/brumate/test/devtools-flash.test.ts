// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FLASH_MS,
  MAX_FLASHES,
  installFlash,
  type OutlineBox,
} from '../src/runtime/devtools-flash.ts';
import type { DevtoolsState } from '../src/runtime/devtools.ts';

function setup(): { state: DevtoolsState; shadow: ShadowRoot; host: Element } {
  const host = document.createElement('brumate-devtools');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const state = { flash: false } as DevtoolsState;
  return { state, shadow, host };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('devtools update outlines', () => {
  it('draws on one canvas that the pointer passes through', () => {
    const { state, shadow, host } = setup();
    const outlines = installFlash(state, shadow, host);
    expect(shadow.querySelectorAll('canvas')).toHaveLength(1);
    expect(outlines.canvas.style.pointerEvents).toBe('none');
    expect(outlines.canvas.style.position).toBe('fixed');
  });

  it('lists a box for each changed element, warmer when it changes often', async () => {
    const { state, shadow, host } = setup();
    document.body.insertAdjacentHTML('beforeend', '<p class="count">1</p>');
    const count = document.querySelector('.count')!;
    count.getBoundingClientRect = () => new DOMRect(10, 20, 100, 30);
    const outlines = installFlash(state, shadow, host);
    state.setFlash!(true);
    count.textContent = '2';
    await expect.poll(() => outlines.boxes.length).toBe(1);
    expect(outlines.boxes[0]).toMatchObject({ x: 10, y: 20, width: 100, height: 30, heat: 'cool' });
    count.textContent = '3';
    await expect.poll(() => outlines.boxes.length).toBe(2);
    expect(outlines.boxes[1]!.heat).toBe('warm');
    // Nothing is added to the shadow root but the canvas.
    expect(shadow.querySelector('.flash')).toBeNull();
    expect(shadow.children).toHaveLength(1);
  });

  it('ignores the devtools own markup', async () => {
    const { state, shadow, host } = setup();
    const outlines = installFlash(state, shadow, host);
    state.setFlash!(true);
    host.setAttribute('data-x', '1');
    await wait(50);
    expect(outlines.boxes).toEqual([]);
  });

  it('caps the boxes of one frame', async () => {
    const { state, shadow, host } = setup();
    const outlines = installFlash(state, shadow, host);
    state.setFlash!(true);
    const list = document.createElement('div');
    for (let i = 0; i < MAX_FLASHES + 50; i++) {
      list.append(document.createElement('span'));
    }
    for (const span of list.children) {
      span.getBoundingClientRect = () => new DOMRect(0, 0, 5, 5);
    }
    document.body.append(list);
    list.getBoundingClientRect = () => new DOMRect(0, 0, 5, 5);
    await expect.poll(() => outlines.boxes.length).toBeGreaterThan(0);
    expect(outlines.boxes.length).toBeLessThanOrEqual(MAX_FLASHES);
  });

  it('fades the boxes and stops the loop when none is left', async () => {
    const { state, shadow, host } = setup();
    document.body.insertAdjacentHTML('beforeend', '<p class="a">1</p>');
    const target = document.querySelector('.a')!;
    target.getBoundingClientRect = () => new DOMRect(1, 2, 30, 10);
    const alphas: number[] = [];
    // A recording context stands in for the canvas, which the test DOM does not draw.
    const recorder = {
      setTransform() {},
      clearRect() {},
      beginPath() {},
      rect() {},
      fill() {},
      stroke() {},
      set globalAlpha(value: number) {
        alphas.push(value);
      },
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(recorder as never);
    const fresh = installFlash(state, shadow, host);
    state.setFlash!(true);
    target.textContent = '2';
    await expect.poll(() => fresh.boxes.length).toBe(1);
    const requests = vi.spyOn(globalThis, 'requestAnimationFrame');
    // The box fades while time passes, then the list empties.
    await expect.poll(() => fresh.boxes.length, { timeout: FLASH_MS * 3 }).toBe(0);
    const fading = alphas.filter((alpha) => alpha > 0 && alpha < 1);
    expect(fading.length).toBeGreaterThan(0);
    // No frame is asked for once the list is empty.
    const asked = requests.mock.calls.length;
    await wait(100);
    expect(requests.mock.calls.length).toBe(asked);
  });

  it('clears the boxes when turned off, and keeps the choice', async () => {
    const { state, shadow, host } = setup();
    document.body.insertAdjacentHTML('beforeend', '<p class="a">1</p>');
    const target = document.querySelector('.a')!;
    target.getBoundingClientRect = () => new DOMRect(1, 2, 30, 10);
    const outlines = installFlash(state, shadow, host);
    state.setFlash!(true);
    expect(localStorage.getItem('brumate:devtools:flash')).toBe('1');
    target.textContent = '2';
    await expect.poll(() => outlines.boxes.length).toBe(1);
    state.setFlash!(false);
    expect(outlines.boxes).toEqual([]);
    target.textContent = '3';
    await wait(50);
    expect(outlines.boxes).toEqual([]);
    expect(localStorage.getItem('brumate:devtools:flash')).toBe('0');
  });

  it('sizes the canvas to the pixel ratio', () => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
    const { state, shadow, host } = setup();
    const outlines = installFlash(state, shadow, host);
    state.setFlash!(true);
    expect(outlines.canvas.width).toBe(innerWidth * 2);
    expect(outlines.canvas.style.width).toBe(`${innerWidth}px`);
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(1);
    dispatchEvent(new Event('resize'));
    expect(outlines.canvas.width).toBe(innerWidth);
  });

  it('measures the boxes again on scroll, so a fixed element does not move', async () => {
    const { state, shadow, host } = setup();
    document.body.insertAdjacentHTML('beforeend', '<p class="moving">1</p><p class="pinned">1</p>');
    const moving = document.querySelector('.moving')!;
    const pinned = document.querySelector('.pinned')!;
    let offset = 0;
    moving.getBoundingClientRect = () => new DOMRect(10, 100 - offset, 50, 20);
    pinned.getBoundingClientRect = () => new DOMRect(0, 0, 200, 40);
    const outlines = installFlash(state, shadow, host);
    state.setFlash!(true);
    moving.textContent = '2';
    pinned.textContent = '2';
    await expect.poll(() => outlines.boxes.length).toBe(2);
    offset = 30;
    dispatchEvent(new Event('scroll'));
    const byElement = (element: Element): OutlineBox =>
      outlines.boxes.find((box) => box.element === element)!;
    expect(byElement(moving)).toMatchObject({ x: 10, y: 70 });
    expect(byElement(pinned)).toMatchObject({ x: 0, y: 0 });
    // A removed element keeps its last rect.
    moving.remove();
    offset = 60;
    dispatchEvent(new Event('scroll'));
    expect(byElement(moving).y).toBe(70);
  });

  it('does nothing on scroll while no box shows', () => {
    const { state, shadow, host } = setup();
    const outlines = installFlash(state, shadow, host);
    state.setFlash!(true);
    const size = outlines.canvas.width;
    dispatchEvent(new Event('scroll'));
    expect(outlines.canvas.width).toBe(size);
    expect(outlines.boxes).toEqual([]);
  });
});
