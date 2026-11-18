// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createSplit } from '../src/runtime/devtools-panel/split.ts';

const OPTIONS = { key: 'demo', min: [100, 150] as [number, number], start: 200 };
const STORE = 'brumate:devtools:split:demo:bottom';

function make(options = OPTIONS, extent = 600, right = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  if (right) {
    const panel = document.createElement('section');
    panel.className = 'panel right';
    root.append(panel);
  }
  const { box, first, second } = createSplit(root)(options);
  Object.defineProperty(box, right ? 'clientHeight' : 'clientWidth', {
    value: extent,
    configurable: true,
  });
  root.append(box);
  const handle = box.querySelector<HTMLElement>('.handle')!;
  return { root, box, first, second, handle };
}

function pointer(handle: HTMLElement, type: string, x: number, y = 0): void {
  handle.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      button: 0,
    }),
  );
}

function press(handle: HTMLElement, key: string, shiftKey = false): void {
  handle.dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
  );
}

const heightOf = (element: HTMLElement): number => Number.parseInt(element.style.height, 10);
const widthOf = (element: HTMLElement): number => Number.parseInt(element.style.width, 10);

describe('the split handle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('returns two panes with a focusable separator between them', () => {
    const { box, first, second, handle } = make();
    expect([...box.children]).toEqual([first, handle, second]);
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.tabIndex).toBe(0);
    expect(handle.getAttribute('aria-valuenow')).toBe('200');
    expect(widthOf(first)).toBe(200);
    expect(first.className).toBe('list');
    expect(second.className).toBe('detail');
  });

  it('puts the styles in the shadow root once', () => {
    const { root } = make();
    root.append(createSplit(root)(OPTIONS).box);
    expect(root.querySelectorAll('style[data-split]')).toHaveLength(1);
  });

  it('drags with pointer capture and stores the size when the pointer is released', () => {
    const { first, handle } = make();
    pointer(handle, 'pointerdown', 300);
    expect(handle.classList.contains('on')).toBe(true);
    expect(handle.hasPointerCapture(1)).toBe(true);
    pointer(handle, 'pointermove', 380);
    expect(widthOf(first)).toBe(280);
    expect(localStorage.getItem(STORE)).toBeNull();
    pointer(handle, 'pointerup', 380);
    expect(handle.classList.contains('on')).toBe(false);
    expect(handle.hasPointerCapture(1)).toBe(false);
    expect(localStorage.getItem(STORE)).toBe('280');
    // Moves after the release change nothing.
    pointer(handle, 'pointermove', 500);
    expect(widthOf(first)).toBe(280);
  });

  it('stops the drag at the minimum of each side', () => {
    const { first, handle } = make();
    pointer(handle, 'pointerdown', 300);
    pointer(handle, 'pointermove', -1000);
    expect(widthOf(first)).toBe(100);
    pointer(handle, 'pointermove', 5000);
    // 600 wide, 150 for the second side.
    expect(widthOf(first)).toBe(450);
    expect(handle.getAttribute('aria-valuenow')).toBe('450');
    pointer(handle, 'pointerup', 5000);
    expect(localStorage.getItem(STORE)).toBe('450');
  });

  it('moves with the arrow keys, by larger steps with Shift', () => {
    const { first, handle } = make();
    press(handle, 'ArrowRight');
    expect(widthOf(first)).toBe(216);
    press(handle, 'ArrowRight', true);
    expect(widthOf(first)).toBe(280);
    press(handle, 'ArrowLeft');
    expect(widthOf(first)).toBe(264);
    expect(handle.getAttribute('aria-valuenow')).toBe('264');
    expect(localStorage.getItem(STORE)).toBe('264');
  });

  it('stops the keys at the minimums', () => {
    const { first, handle } = make();
    for (let step = 0; step < 10; step++) {
      press(handle, 'ArrowLeft', true);
    }
    expect(widthOf(first)).toBe(100);
    for (let step = 0; step < 10; step++) {
      press(handle, 'ArrowRight', true);
    }
    expect(widthOf(first)).toBe(450);
    press(handle, 'Home');
    expect(widthOf(first)).toBe(100);
    press(handle, 'End');
    expect(widthOf(first)).toBe(450);
  });

  it('leaves other keys alone', () => {
    const { first, handle } = make();
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    handle.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(widthOf(first)).toBe(200);
  });

  it('holds the minimums in the styles of the panes', () => {
    const { first, second } = make();
    expect(first.style.minWidth).toBe('100px');
    expect(first.style.maxWidth).toBe('calc(100% - 150px)');
    expect(second.style.minWidth).toBe('150px');
  });

  it('restores the stored size, per split key and per side', () => {
    const one = make();
    press(one.handle, 'ArrowRight', true);
    const again = make();
    expect(widthOf(again.first)).toBe(264);
    expect(widthOf(make({ ...OPTIONS, key: 'other' }).first)).toBe(200);
    // The dock on the right has its own size.
    expect(heightOf(make(OPTIONS, 600, true).first)).toBe(200);
    expect(localStorage.getItem('brumate:devtools:split:demo:right')).toBeNull();
  });

  it('clamps a stored size to the minimums', () => {
    // The box has no width when the size is set, so the first key press holds it to the box.
    localStorage.setItem(STORE, '5000');
    const big = make();
    press(big.handle, 'ArrowRight');
    expect(widthOf(big.first)).toBe(450);
    localStorage.setItem(STORE, '10');
    expect(widthOf(make().first)).toBe(100);
  });

  it('resets on double-click', () => {
    const { first, handle } = make();
    press(handle, 'ArrowRight', true);
    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(widthOf(first)).toBe(200);
    expect(localStorage.getItem(STORE)).toBeNull();
  });

  it('works when storage is off', () => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error('off');
    };
    Storage.prototype.setItem = () => {
      throw new Error('off');
    };
    try {
      const { first, handle } = make();
      press(handle, 'ArrowRight');
      expect(widthOf(first)).toBe(216);
    } finally {
      Storage.prototype.getItem = get;
      Storage.prototype.setItem = set;
    }
  });

  describe('on a dock at the right', () => {
    const RIGHT = 'brumate:devtools:split:demo:right';

    it('stacks the panes under a horizontal handle', () => {
      const { box, first, handle } = make(OPTIONS, 600, true);
      expect(box.className).toBe('split stack');
      expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
      expect(heightOf(first)).toBe(200);
      expect(first.style.minHeight).toBe('100px');
      expect(first.style.maxHeight).toBe('calc(100% - 150px)');
    });

    it('drags by the vertical position and holds the minimums', () => {
      const { first, handle } = make(OPTIONS, 600, true);
      pointer(handle, 'pointerdown', 0, 300);
      pointer(handle, 'pointermove', 500, 360);
      expect(heightOf(first)).toBe(260);
      pointer(handle, 'pointermove', 0, -1000);
      expect(heightOf(first)).toBe(100);
      pointer(handle, 'pointermove', 0, 5000);
      expect(heightOf(first)).toBe(450);
      pointer(handle, 'pointerup', 0, 5000);
      expect(localStorage.getItem(RIGHT)).toBe('450');
      expect(localStorage.getItem(STORE)).toBeNull();
    });

    it('moves with the up and down keys and ignores left and right', () => {
      const { first, handle } = make(OPTIONS, 600, true);
      press(handle, 'ArrowDown');
      expect(heightOf(first)).toBe(216);
      press(handle, 'ArrowDown', true);
      expect(heightOf(first)).toBe(280);
      press(handle, 'ArrowUp');
      expect(heightOf(first)).toBe(264);
      press(handle, 'ArrowRight', true);
      expect(heightOf(first)).toBe(264);
      expect(localStorage.getItem(RIGHT)).toBe('264');
      expect(heightOf(make(OPTIONS, 600, true).first)).toBe(264);
    });
  });
});
