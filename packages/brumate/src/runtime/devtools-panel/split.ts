// The split of a workspace: two panes with a handle between them. The first column keeps the size
// that the handle sets and the second takes the rest. The size is kept per split and dock side.

import { element } from './dom.ts';
import type { Columns, DockContext, SplitOptions } from './workspace.ts';

const STYLE = `
.split > .handle { position: relative; flex: none; width: 0; z-index: 3; touch-action: none; outline: none; cursor: col-resize; }
.split > .handle::before { content: ""; position: absolute; top: 0; bottom: 0; left: -4px; width: 9px; }
.split > .handle::after { content: ""; position: absolute; top: 0; bottom: 0; left: -0.5px; width: 1px; background: var(--accent); opacity: 0; transition: opacity .15s, width .15s; border-radius: 2px; }
.split > .handle i { position: absolute; top: 50%; left: 0; width: 4px; height: 28px; border-radius: 3px; background: var(--accent); opacity: 0; transform: translate(-50%, -50%); transition: opacity .15s; }
.split > .handle:hover::after, .split > .handle.on::after { opacity: .7; }
.split > .handle:hover i, .split > .handle.on i { opacity: 1; }
.split > .handle:focus-visible::after { opacity: 1; width: 2px; left: -1px; }
.split > .handle:focus-visible i { opacity: 1; }
.split.stack { flex-direction: column; }
.split.stack > .list { width: auto; border-right: 0; border-bottom: 1px solid var(--line); }
.split.stack > .handle { width: auto; height: 0; cursor: row-resize; }
.split.stack > .handle::before { top: -4px; bottom: auto; left: 0; right: 0; width: auto; height: 9px; }
.split.stack > .handle::after { top: -0.5px; bottom: auto; left: 0; right: 0; width: auto; height: 1px; }
.split.stack > .handle i { top: 0; left: 50%; width: 28px; height: 4px; transform: translate(-50%, -50%); }
.split.stack > .handle:focus-visible::after { width: auto; height: 2px; top: -1px; left: 0; }
@media (prefers-reduced-motion: reduce) { .split > .handle::after, .split > .handle i { transition: none; } }
`;

/** The step of an arrow key, and of an arrow key with Shift, in pixels. */
const STEP = 16;
const BIG_STEP = 64;

function storeName(key: string, side: string): string {
  return `brumate:devtools:split:${key}:${side}`;
}

function readSize(name: string): number | undefined {
  try {
    const value = Number(localStorage.getItem(name));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  } catch {
    // Storage can be off. The start size stays.
    return undefined;
  }
}

function writeSize(name: string, size: number | undefined): void {
  try {
    if (size === undefined) {
      localStorage.removeItem(name);
    } else {
      localStorage.setItem(name, String(size));
    }
  } catch {
    // Storage can be off.
  }
}

/** Makes the `split` of a dock context. The sizes are kept for the side the dock has when it is drawn. */
export function createSplit(root: ShadowRoot): DockContext['split'] {
  return function split({ key, min, start }: SplitOptions): Columns {
    // The styles go in the shadow root once.
    if (!root.querySelector('style[data-split]')) {
      root.append(element('style', { 'data-split': '' }, STYLE));
    }
    const side = root.querySelector('.panel.right') ? 'right' : 'bottom';
    // A dock on the right is narrow, so the panes stack and the handle is horizontal.
    const stacked = side === 'right';
    const name = storeName(key, side);

    const first = element('div', { class: 'list' });
    const second = element('div', { class: 'detail' });
    const grab = element('i');
    const handle = element(
      'div',
      {
        class: 'handle',
        role: 'separator',
        tabindex: '0',
        'aria-orientation': stacked ? 'horizontal' : 'vertical',
        'aria-label': 'Resize the panels',
        title: 'Drag, or use the arrow keys. Double-click to reset.',
      },
      grab,
    );
    const box = element('div', { class: stacked ? 'split stack' : 'split' }, first, handle, second);
    // The browser holds the minimums at any width. The size below follows them.
    const [low, high] = stacked
      ? (['minHeight', 'maxHeight'] as const)
      : (['minWidth', 'maxWidth'] as const);
    first.style[low] = `${min[0]}px`;
    first.style[high] = `calc(100% - ${min[1]}px)`;
    second.style[low] = `${min[1]}px`;
    if (stacked) {
      first.style.width = 'auto';
    }

    // The greatest size of the first side. Before the box has a width there is no limit.
    function most(): number {
      const total = stacked ? box.clientHeight : box.clientWidth;
      return total > 0 ? Math.max(min[0], total - min[1]) : Infinity;
    }
    function clamp(size: number): number {
      return Math.round(Math.min(most(), Math.max(min[0], size)));
    }

    let size = clamp(readSize(name) ?? start);
    function apply(next: number): void {
      size = clamp(next);
      first.style[stacked ? 'height' : 'width'] = `${size}px`;
      handle.setAttribute('aria-valuenow', String(size));
      handle.setAttribute('aria-valuemin', String(min[0]));
      if (most() !== Infinity) {
        handle.setAttribute('aria-valuemax', String(most()));
      }
    }
    apply(size);

    // A resized dock moves the greatest size.
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => apply(size)).observe(box);
    }

    let from: { x: number; size: number } | undefined;
    function end(event: PointerEvent): void {
      if (!from) {
        return;
      }
      from = undefined;
      handle.classList.remove('on');
      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      writeSize(name, size);
    }
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      // The capture sends every move and the release here, also outside the dock.
      handle.setPointerCapture(event.pointerId);
      handle.focus();
      handle.classList.add('on');
      // The box may have had no width when the size was set.
      size = clamp(size);
      from = { x: stacked ? event.clientY : event.clientX, size };
    });
    handle.addEventListener('pointermove', (event) => {
      if (from) {
        apply(from.size + (stacked ? event.clientY : event.clientX) - from.x);
      }
    });
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    handle.addEventListener('dblclick', () => {
      apply(start);
      writeSize(name, undefined);
    });
    handle.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? BIG_STEP : STEP;
      size = clamp(size);
      let next: number;
      if (event.key === (stacked ? 'ArrowDown' : 'ArrowRight')) {
        next = size + step;
      } else if (event.key === (stacked ? 'ArrowUp' : 'ArrowLeft')) {
        next = size - step;
      } else if (event.key === 'Home') {
        next = min[0];
      } else if (event.key === 'End') {
        next = most();
      } else {
        return;
      }
      event.preventDefault();
      apply(next === Infinity ? size : next);
      writeSize(name, size);
    });

    return { box, first, second };
  };
}
