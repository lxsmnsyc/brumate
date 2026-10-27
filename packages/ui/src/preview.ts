// The page around an open preview of a PreviewTrigger: what keeps it open, what closes it, and
// how Tab moves between the trigger and the preview, which renders at the end of the page.
import { tabbables } from './overlay.ts';

/** How long a touch holds the trigger to open the preview, in milliseconds. */
export const LONG_PRESS = 500;

interface Handlers {
  /** The pointer or focus is on the trigger or in the preview. */
  keep: () => void;
  /** The pointer left both, so the preview closes after its delay. */
  leave: () => void;
  /** Focus left both, or Escape, so the preview closes at once. */
  close: () => void;
}

/** The layer of the preview, which holds its panel and the overlays inside it. */
function layerOf(overlayId: string): Element | null {
  return document.getElementById(overlayId)?.closest('[data-layer]') ?? null;
}

/**
 * Follows the page while the preview is open. Returns the function that stops it.
 *
 * - The pointer over the trigger or the preview keeps it open, and elsewhere closes it.
 * - Focus elsewhere closes it at once. Escape closes it, and gives focus to the trigger.
 * - Tab on the trigger moves into the preview. Tab past its end moves on to the element after
 *   the trigger, and Shift+Tab before its start goes back to the trigger.
 */
export function followPreview(
  triggerId: string,
  overlayId: string,
  handlers: Handlers,
): () => void {
  const trigger = (): HTMLElement | null => document.getElementById(triggerId);
  const inside = (target: EventTarget | null): boolean =>
    target instanceof Node &&
    (Boolean(trigger()?.contains(target)) || Boolean(layerOf(overlayId)?.contains(target)));

  const over = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') {
      return;
    }
    if (inside(event.target)) {
      handlers.keep();
    } else if (!inside(document.activeElement)) {
      // Focus on the trigger or in the preview keeps it open, as a hover end does not close it
      // while the trigger has focus.
      handlers.leave();
    }
  };
  // The pointer left the window, or went into a frame, where no pointerover comes.
  const out = (event: PointerEvent): void => {
    if (
      event.pointerType !== 'touch' &&
      event.relatedTarget === null &&
      !inside(document.activeElement)
    ) {
      handlers.leave();
    }
  };
  const focusIn = (event: FocusEvent): void => {
    if (inside(event.target)) {
      handlers.keep();
    } else {
      handlers.close();
    }
  };
  const keyDown = (event: KeyboardEvent): void => {
    const active = document.activeElement;
    const layer = layerOf(overlayId);
    const button = trigger();
    if (!button || !layer) {
      return;
    }
    // Escape closes it wherever focus is, as content that a hover shows must close in WCAG.
    if (event.key === 'Escape') {
      // Where focus is, before closing takes the preview from the page.
      const within = inside(active);
      handlers.close();
      if (within) {
        event.preventDefault();
        // The focus that comes back does not open it again.
        dismissed.add(triggerId);
        button.focus({ preventScroll: true });
      }
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const panel = document.getElementById(overlayId);
    const order = panel ? tabbables(panel) : [];
    if (active === button && !event.shiftKey) {
      event.preventDefault();
      (order[0] ?? panel)?.focus({ preventScroll: true });
    } else if (layer.contains(active)) {
      const at = order.indexOf(active as HTMLElement);
      if (event.shiftKey && at <= 0) {
        event.preventDefault();
        button.focus({ preventScroll: true });
      } else if (!event.shiftKey && at === order.length - 1) {
        // The element after the trigger in the page, outside the preview.
        const page = tabbables(document.body).filter((element) => !layer.contains(element));
        const next = page[page.indexOf(button) + 1];
        if (next) {
          event.preventDefault();
          next.focus();
        }
      }
    }
  };
  document.addEventListener('pointerover', over, true);
  document.addEventListener('pointerout', out, true);
  document.addEventListener('focusin', focusIn, true);
  document.addEventListener('keydown', keyDown, true);
  return () => {
    document.removeEventListener('pointerover', over, true);
    document.removeEventListener('pointerout', out, true);
    document.removeEventListener('focusin', focusIn, true);
    document.removeEventListener('keydown', keyDown, true);
  };
}

/** The triggers whose preview Escape closed, until focus leaves them. */
export const dismissed = new Set<string>();

/** The timers of long presses, by the ID of the trigger. */
const presses = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Opens the preview when a touch holds the trigger for a moment.
 * The press of the trigger is cancelled, so the release that follows presses nothing, and its
 * click is swallowed, so a link does not navigate. The menu of the browser for a held link does
 * not show.
 */
export function startLongPress(
  triggerId: string,
  pointerId: number | undefined,
  open: () => void,
): void {
  cancelLongPress(triggerId);
  const element = document.getElementById(triggerId);
  const menu = (event: Event): void => {
    if (element?.contains(event.target as Node)) {
      event.preventDefault();
    }
  };
  document.addEventListener('contextmenu', menu, true);
  menus.set(triggerId, () => document.removeEventListener('contextmenu', menu, true));
  presses.set(
    triggerId,
    setTimeout(() => {
      presses.delete(triggerId);
      open();
      // The press of the trigger ends without a press, as the browser ends a press it takes over.
      element?.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId }));
      const swallow = (event: Event): void => {
        if (element?.contains(event.target as Node)) {
          event.preventDefault();
          event.stopPropagation();
        }
      };
      document.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => {
        document.removeEventListener('click', swallow, true);
        stopMenu(triggerId);
      }, 1000);
    }, LONG_PRESS),
  );
}

/** The listeners that keep the menu of the browser away during a long press, by trigger. */
const menus = new Map<string, () => void>();

function stopMenu(triggerId: string): void {
  menus.get(triggerId)?.();
  menus.delete(triggerId);
}

export function cancelLongPress(triggerId: string): void {
  // A press that was long already keeps the menu away until its click.
  if (presses.has(triggerId)) {
    stopMenu(triggerId);
  }
  clearTimeout(presses.get(triggerId));
  presses.delete(triggerId);
}
