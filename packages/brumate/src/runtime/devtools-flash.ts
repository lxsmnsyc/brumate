import type { DevtoolsState } from './devtools.ts';

/** Where the choice to outline changed elements is kept. */
const FLASH_KEY = 'brumate:devtools:flash';
/** How long an outline shows. */
export const FLASH_MS = 700;
/** The most outlines that one frame draws, so a big change does not stall the page. */
export const MAX_FLASHES = 200;

/** The colours of an outline, by how often the element changes. */
const HEAT = {
  cool: { line: '#7fd99a', fill: 'rgb(127 217 154 / 0.08)' },
  warm: { line: '#ffd166', fill: 'rgb(255 209 102 / 0.1)' },
  hot: { line: '#ff7a7a', fill: 'rgb(255 122 122 / 0.12)' },
};

export type Heat = keyof typeof HEAT;

/** One outline: the element, where it is in the viewport, its colour and when it began. */
export interface OutlineBox {
  /** Measured again on scroll and resize while the element is connected. */
  element: Element;
  x: number;
  y: number;
  width: number;
  height: number;
  heat: Heat;
  start: number;
}

export interface Outlines {
  /** The boxes that are showing, oldest first. */
  boxes: OutlineBox[];
  canvas: HTMLCanvasElement;
}

/** The heat of an outline, by how many times the element changed in the last second. */
function pickHeat(count: number): Heat {
  if (count >= 5) {
    return 'hot';
  }
  return count >= 2 ? 'warm' : 'cool';
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Outlines the elements that change, as an update writes them: green for an
 * element that changes now and then, yellow and red for one that changes
 * often. A MutationObserver sees every change of the page, so it needs no
 * hook of the core. The boxes are drawn on one canvas in the shadow root, so
 * the page itself does not change.
 */
export function installFlash(state: DevtoolsState, root: ShadowRoot, host: Element): Outlines {
  const canvas = document.createElement('canvas');
  canvas.className = 'flashes';
  canvas.style.cssText =
    'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646';
  root.append(canvas);
  const context = canvas.getContext('2d');
  const boxes: OutlineBox[] = [];
  // How many times each element changed lately, for its colour.
  const heat = new WeakMap<Element, { count: number; time: number }>();
  const pending = new Set<Element>();
  let observed = false;
  let mutationFrame = 0;
  let loop = 0;

  function fit(): void {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(innerWidth * ratio);
    const height = Math.round(innerHeight * ratio);
    // Setting the size clears the canvas, so only do it when it changed.
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
  }

  function paint(now: number): void {
    if (!context) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, innerWidth, innerHeight);
    const still = reducedMotion();
    context.lineWidth = 2;
    for (const box of boxes) {
      const colours = HEAT[box.heat];
      context.globalAlpha = still ? 1 : Math.max(0, 1 - (now - box.start) / FLASH_MS);
      context.fillStyle = colours.fill;
      context.strokeStyle = colours.line;
      context.beginPath();
      const x = box.x;
      const y = box.y;
      if (typeof context.roundRect === 'function') {
        context.roundRect(x, y, box.width, box.height, 3);
      } else {
        context.rect(x, y, box.width, box.height);
      }
      context.fill();
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  /** One frame of the loop: drops the boxes that ran out, draws the rest and goes on while any is left. */
  function tick(): void {
    loop = 0;
    const now = performance.now();
    let kept = 0;
    for (const box of boxes) {
      if (now - box.start < FLASH_MS) {
        boxes[kept++] = box;
      }
    }
    boxes.length = kept;
    paint(now);
    if (boxes.length > 0) {
      loop = requestAnimationFrame(tick);
    }
  }

  /** Measures the boxes again, since a scroll moves the elements but not the fixed ones. */
  function repaint(): void {
    if (boxes.length === 0) {
      return;
    }
    for (const box of boxes) {
      // A box whose element left the page keeps its last rect.
      if (box.element.isConnected) {
        const rect = box.element.getBoundingClientRect();
        box.x = rect.left;
        box.y = rect.top;
        box.width = rect.width;
        box.height = rect.height;
      }
    }
    paint(performance.now());
  }

  function resize(): void {
    fit();
    repaint();
  }

  function collect(): void {
    mutationFrame = 0;
    let drawn = 0;
    for (const target of pending) {
      if (drawn >= MAX_FLASHES) {
        break;
      }
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        continue;
      }
      const now = performance.now();
      const last = heat.get(target);
      const count = last && now - last.time < 1000 ? last.count + 1 : 1;
      heat.set(target, { count, time: now });
      boxes.push({
        element: target,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        heat: pickHeat(count),
        start: now,
      });
      drawn++;
    }
    pending.clear();
    if (drawn > 0) {
      fit();
      paint(performance.now());
      if (loop === 0) {
        loop = requestAnimationFrame(tick);
      }
    }
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      let target: Node | null = record.target;
      if (record.type === 'childList') {
        // The elements that came in, or else the element that lost some.
        let added = 0;
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) {
            pending.add(node as Element);
            added++;
          }
        }
        if (added > 0) {
          continue;
        }
      }
      if (target.nodeType !== 1) {
        target = target.parentElement;
      }
      if (
        target &&
        target !== host &&
        target !== document.documentElement &&
        target !== document.body
      ) {
        pending.add(target as Element);
      }
    }
    for (const target of pending) {
      // The devtools change their own markup, and the host carries their styles.
      if (target === host || host.contains(target)) {
        pending.delete(target);
      }
    }
    if (pending.size > 0 && mutationFrame === 0) {
      mutationFrame = requestAnimationFrame(collect);
    }
  });

  state.setFlash = (on) => {
    state.flash = on;
    if (on && !observed) {
      observed = true;
      fit();
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      addEventListener('resize', resize);
      addEventListener('scroll', repaint, { passive: true, capture: true });
    } else if (!on && observed) {
      observed = false;
      observer.disconnect();
      removeEventListener('resize', resize);
      removeEventListener('scroll', repaint, { capture: true });
      pending.clear();
      boxes.length = 0;
      if (loop !== 0) {
        cancelAnimationFrame(loop);
        loop = 0;
      }
      paint(performance.now());
    }
    try {
      localStorage.setItem(FLASH_KEY, on ? '1' : '0');
    } catch {
      // Storage can be off.
    }
    state.changed?.();
  };
  let saved = false;
  try {
    saved = localStorage.getItem(FLASH_KEY) === '1';
  } catch {
    // Storage can be off.
  }
  if (saved) {
    state.setFlash(true);
  }
  return { boxes, canvas };
}
