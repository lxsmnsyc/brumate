// The queue of toasts. A queue lives in the browser's memory, by
// its name, so any handler can add a toast. Each change sends a `toastchange` event to the
// ToastRegion elements of the queue, so the code of a region loads with its first toast.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

declare module 'brumate/elements' {
  interface ElementEvents {
    /** A queue sends it to its regions when a toast is added, updated or closed. */
    toastchange: Event;
  }
}

/** A toast of a queue: its key, and the content that the region renders. */
export interface QueuedToast<T> {
  key: string;
  content: T;
}

export interface ToastOptions {
  /**
   * Closes the toast after this many milliseconds, at least 5000. The
   * time stops while the pointer or focus is in the region. Without it, the toast stays until
   * it is closed.
   */
  timeout?: number;
  /** Runs when the toast closes, by its timeout, its close button or `close`. */
  onClose?: () => void;
}

/** The shortest timeout, so people have time to read a toast. */
const MINIMUM_TIMEOUT = 5000;

/** A timer that can stop and go on with the time that it has left. */
class Timer {
  private left: number;
  private started = 0;
  private id: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly done: () => void,
    time: number,
  ) {
    this.left = time;
  }

  resume(): void {
    if (this.id === undefined) {
      this.started = Date.now();
      this.id = setTimeout(this.done, this.left);
    }
  }

  pause(): void {
    if (this.id !== undefined) {
      clearTimeout(this.id);
      this.id = undefined;
      this.left -= Date.now() - this.started;
    }
  }
}

interface Entry<T> extends QueuedToast<T> {
  onClose?: () => void;
  timer?: Timer;
}

let count = 0;

export class ToastQueue<T> {
  private readonly entries: Entry<T>[] = [];
  private paused = false;

  constructor(
    /** The name of the queue, which its ToastRegion elements name in `queue`. */
    readonly name: string,
    /** How many toasts show at a time. The others wait, in the order that they came. */
    public maxVisibleToasts = 5,
  ) {}

  /** The toasts that show, newest first. */
  get visibleToasts(): QueuedToast<T>[] {
    return this.entries
      .slice(0, this.maxVisibleToasts)
      .map(({ key, content }) => ({ key, content }));
  }

  /** Adds a toast, and returns its key. */
  add(content: T, options: ToastOptions = {}): string {
    const key = `toast-${++count}`;
    const entry: Entry<T> = { key, content, onClose: options.onClose };
    if (options.timeout !== undefined) {
      entry.timer = new Timer(() => this.close(key), Math.max(options.timeout, MINIMUM_TIMEOUT));
    }
    this.entries.unshift(entry);
    this.update();
    return key;
  }

  /** Closes a toast by its key. */
  close(key: string): void {
    const index = this.entries.findIndex((entry) => entry.key === key);
    if (index === -1) {
      return;
    }
    const [entry] = this.entries.splice(index, 1);
    entry!.timer?.pause();
    entry!.onClose?.();
    // The region leaves the page with its last toast, so no pointerleave or focusout comes to
    // resume the timeouts. The toasts that come next count down again.
    if (this.entries.length === 0) {
      this.paused = false;
    }
    this.update();
  }

  /** Stops the timeouts, while people look at the toasts. */
  pauseAll(): void {
    this.paused = true;
    for (const entry of this.entries) {
      entry.timer?.pause();
    }
  }

  /** Goes on with the timeouts of the toasts that show. */
  resumeAll(): void {
    this.paused = false;
    this.run();
  }

  private run(): void {
    if (this.paused) {
      return;
    }
    // Only the toasts that show count down.
    this.entries.forEach((entry, index) => {
      if (index < this.maxVisibleToasts) {
        entry.timer?.resume();
      } else {
        entry.timer?.pause();
      }
    });
  }

  private update(): void {
    this.run();
    for (const region of document.querySelectorAll(
      `[data-toast-region="${CSS.escape(this.name)}"]`,
    )) {
      region.dispatchEvent(new Event('toastchange'));
    }
  }
}

const queues = new Map<string, ToastQueue<unknown>>();

/**
 * The queue of toasts with a name, `default` by default. The first call makes it. A call that
 * passes `maxVisibleToasts`, the most toasts that show at a time, sets it, also on a queue that
 * another call made.
 */
export function toastQueue<T = unknown>(
  name = 'default',
  maxVisibleToasts?: number,
): ToastQueue<T> {
  let queue = queues.get(name);
  if (!queue) {
    queue = new ToastQueue<unknown>(name, maxVisibleToasts);
    queues.set(name, queue);
  } else if (maxVisibleToasts !== undefined) {
    // A call with a limit sets it, also when another call made the queue first.
    queue.maxVisibleToasts = maxVisibleToasts;
  }
  return queue as ToastQueue<T>;
}

/** What a ToastRegion gives its toasts: the name of its queue. */
export const ToastRegionContext: Context<{ queue: string } | null> = createContext<{
  queue: string;
} | null>('brumate-ui:toast-region', null);

/** What a Toast gives its ToastContent: the IDs of its title and its description. */
export const ToastContext: Context<{ titleId: string; descriptionId: string } | null> =
  createContext<{ titleId: string; descriptionId: string } | null>('brumate-ui:toast', null);

/** The element that had focus before focus moved into the toasts of a queue, by its name. */
const before = new Map<string, Element>();

export function rememberFocus(queue: string, element: Element | null): void {
  if (element && element !== document.body) {
    before.set(queue, element);
  }
}

/** Gives focus back to the element that had it before focus moved into the toasts. */
export function restoreFocus(queue: string): void {
  const element = before.get(queue);
  before.delete(queue);
  if (element instanceof HTMLElement && element.isConnected && !element.closest('[inert]')) {
    element.focus({ preventScroll: true });
  }
}

/** The keys of the toasts that leave, which stay in the region until their leave ends. */
export const leavingToasts = new Set<string>();

let landmarks = false;

/**
 * F6 moves focus to the newest toast, and F6 or Shift+F6 in the toasts gives it back to the
 * element that had it. Shift+F6 outside the toasts does nothing. The key is prevented only when
 * focus moves. This lets a keyboard user reach a ToastRegion, which is not in the order of Tab.
 * It starts with the first toast.
 */
export function listenForF6(): void {
  if (landmarks) {
    return;
  }
  landmarks = true;
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'F6') {
      return;
    }
    const active = document.activeElement;
    const inside = active?.closest<HTMLElement>('[role=region][data-queue]');
    if (inside) {
      restoreFocus(inside.dataset.queue!);
      // Without an element to give focus back to, the key keeps its default.
      if (document.activeElement !== active) {
        event.preventDefault();
      }
      return;
    }
    // Shift+F6 outside the toasts is not for them.
    if (event.shiftKey) {
      return;
    }
    // A toast that leaves is inert, so F6 goes to the first one that stays.
    const toast = [
      ...document.querySelectorAll<HTMLElement>('[role=region][data-queue] [data-toast-key]'),
    ].find((element) => !element.closest('[inert]'));
    if (toast) {
      toast.focus();
      // A toast that cannot take focus leaves the key to the browser.
      if (document.activeElement === toast) {
        event.preventDefault();
        rememberFocus(toast.closest<HTMLElement>('[data-queue]')!.dataset.queue!, active);
      }
    }
  });
}
