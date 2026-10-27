// The tests of ToastRegion, Toast and ToastContent.
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import { ToastQueue, toastQueue } from '../src/toast.ts';
import Toasts from './fixtures/toasts.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  for (const region of document.querySelectorAll('[data-toast-region]')) {
    region.remove();
  }
  const queue = toastQueue('tests');
  for (const toast of queue.visibleToasts) {
    queue.close(toast.key);
  }
});

async function toasts() {
  const page = await mount(Toasts, {});
  unmount = page.unmount;
  return page;
}

const all = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];

it('leaves out aria-describedby of a toast without a description', async () => {
  const page = await toasts();
  pressWith(page.get('.add-quiet'));
  await page.waitFor(() => expect(document.querySelector('.toast')).not.toBeNull());
  const toast = document.querySelector('.toast')!;
  await page.waitFor(() => expect(toast.hasAttribute('aria-describedby')).toBe(false), 3000);
});

it('renders no landmark until a toast comes, at the end of the page', async () => {
  const page = await toasts();
  expect(document.querySelector('[role=region]')).toBeNull();
  const holder = document.querySelector('[data-toast-region="tests"]')!;
  expect(page.get('.page').contains(holder)).toBe(false);
});

it('shows each toast, newest first, named and described by its content', async () => {
  const page = await toasts();
  pressWith(page.get('.add'));
  await page.waitFor(() => expect(all('.toast')).toHaveLength(1));
  pressWith(page.get('.add'));
  await page.waitFor(() =>
    expect(all('.title').map((title) => title.textContent)).toEqual(['Saved 2', 'Saved 1']),
  );
  const region = document.querySelector<HTMLElement>('[role=region]')!;
  expect(region.getAttribute('aria-label')).toBe('Notifications');
  const toast = all('.toast')[0]!;
  expect(toast.getAttribute('role')).toBe('alertdialog');
  expect(toast.getAttribute('aria-modal')).toBe('false');
  expect(toast.getAttribute('aria-labelledby')).toBe(toast.querySelector('.title')!.id);
  expect(toast.getAttribute('aria-describedby')).toBe(toast.querySelector('.description')!.id);
  expect(toast.querySelector('.content')!.getAttribute('role')).toBe('alert');
  expect(toast.querySelector('.close')!.getAttribute('aria-label')).toBe('Close');
});

it('closes with its close button, and focus moves to the next toast, then back', async () => {
  const page = await toasts();
  pressWith(page.get('.add'));
  pressWith(page.get('.add'));
  await page.waitFor(() => expect(all('.toast')).toHaveLength(2));
  const field = page.get('.field');
  field.focus();
  // F6 moves focus to the newest toast.
  press('F6', field);
  await page.waitFor(() => expect(document.activeElement).toBe(all('.toast')[0]));
  all('.close')[0]!.focus();
  pressWith(all('.close')[0]!);
  await page.waitFor(() =>
    expect(all('.title').map((title) => title.textContent)).toEqual(['Saved 1']),
  );
  await page.waitFor(() => expect(document.activeElement).toBe(all('.toast')[0]));
  pressWith(all('.close')[0]!);
  await page.waitFor(() => expect(document.querySelector('[role=region]')).toBeNull());
  await page.waitFor(() => expect(document.activeElement).toBe(field));
});

it('closes a toast after its timeout, at least 5 seconds, and stops the time while paused', () => {
  vi.useFakeTimers();
  try {
    const queue = new ToastQueue<string>('timers');
    const closed: string[] = [];
    queue.add('short', { timeout: 1000, onClose: () => closed.push('short') });
    queue.add('stays');
    vi.advanceTimersByTime(4000);
    expect(closed).toEqual([]);
    queue.pauseAll();
    vi.advanceTimersByTime(5000);
    expect(closed).toEqual([]);
    queue.resumeAll();
    vi.advanceTimersByTime(1000);
    expect(closed).toEqual(['short']);
    expect(queue.visibleToasts.map((toast) => toast.content)).toEqual(['stays']);
  } finally {
    vi.useRealTimers();
  }
});

it('counts down again once the last toast closes while the toasts were paused', () => {
  vi.useFakeTimers();
  try {
    const queue = new ToastQueue<string>('emptied');
    const closed: string[] = [];
    const key = queue.add('looked at');
    // The pointer is over the region, and the user closes its only toast. The region leaves the
    // page, so no pointerleave resumes the timeouts.
    queue.pauseAll();
    queue.close(key);
    queue.add('next', { timeout: 5000, onClose: () => closed.push('next') });
    vi.advanceTimersByTime(5000);
    expect(closed).toEqual(['next']);
  } finally {
    vi.useRealTimers();
  }
});

it('takes the limit of the call that names one, also when the queue is there', () => {
  const first = toastQueue('limited');
  expect(first.maxVisibleToasts).toBe(5);
  expect(toastQueue('limited', 2).maxVisibleToasts).toBe(2);
});

it('shows at most maxVisibleToasts, and counts down only those', () => {
  vi.useFakeTimers();
  try {
    const queue = new ToastQueue<string>('few', 1);
    queue.add('first', { timeout: 5000 });
    queue.add('second', { timeout: 5000 });
    expect(queue.visibleToasts.map((toast) => toast.content)).toEqual(['second']);
    vi.advanceTimersByTime(5000);
    expect(queue.visibleToasts.map((toast) => toast.content)).toEqual(['first']);
    vi.advanceTimersByTime(5000);
    expect(queue.visibleToasts).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

it('runs the steps of a transition on each toast as it comes and goes', async () => {
  const page = await toasts();
  const flags: string[] = [];
  new MutationObserver(() => {
    for (const toast of all('.toast')) {
      flags.push(
        ['data-closed', 'data-enter', 'data-leave', 'inert']
          .filter((name) => toast.hasAttribute(name))
          .join(' '),
      );
    }
  }).observe(document.body, { attributes: true, childList: true, subtree: true });
  pressWith(page.get('.add'));
  await page.waitFor(() => expect(flags).toContain('data-closed data-enter'));
  await page.waitFor(() => expect(all('.toast')[0]!.hasAttribute('data-enter')).toBe(false));
  pressWith(all('.close')[0]!);
  await page.waitFor(() => expect(all('.toast')).toHaveLength(0));
  expect(flags.some((step) => step.includes('data-leave') && step.includes('inert'))).toBe(true);
});
