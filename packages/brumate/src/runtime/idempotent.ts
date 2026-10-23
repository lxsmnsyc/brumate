// Forms that a second post must not run again, such as one that places an
// order. Each form that the server renders for such a function gets a key in
// its URL, and the server answers a post with a key that it has seen with
// the result that it kept, without running the function again.

import { fromJSON, toJSON } from 'seroval';
import { cacheStore } from './cache.ts';
import {
  IDEMPOTENT,
  currentEvent,
  idempotentId,
  isRedirect,
  redirect,
  withEvent,
} from './request.ts';
import { serialOptions, syncPlugins } from './serial.ts';

/** What a post with a key gave: a result, or a redirect. */
type Outcome = { result: unknown } | { redirect: { location: string; status: number } };

/** Runs that are going on, by key, so a second post while the first runs waits for it. */
const running = new Map<string, Promise<Outcome>>();

export interface IdempotentOptions {
  /** Seconds that the result of a key is kept. Defaults to 600. */
  maxAge?: number;
}

/**
 * Makes a server function that runs once for each form that the server
 * renders for it. A second post of the same form, such as a double click
 * before the page loaded or a post again after a reload, gets the result of
 * the first, or the same redirect, without running the function again.
 *
 * - It works for the exported functions of a `'use server'` file, used as the
 *   `action` of a form.
 * - The key is in the URL of the form, so a page with such a form is not
 *   cached for everyone. Each render has a new key.
 * - With scripts, the form gets a new key after each answer, so a post that
 *   the user means again runs again.
 * - A call without a key, such as from a handler, runs as usual.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
export function idempotent<F extends (...args: any[]) => unknown>(
  fn: F,
  options: IdempotentOptions = {},
): F {
  const maxAge = options.maxAge ?? 600;
  const wrapper = ((...args: unknown[]) => {
    const event = currentEvent();
    const key = event && new URL(event.request.url).searchParams.get('__key');
    const id = idempotentId.get(wrapper);
    if (!event || !key || !id || !/^[\w-]{8,64}$/.test(key)) {
      return fn(...args);
    }
    const storeKey = `brumate:once:${id}:${key}`;
    let run = running.get(storeKey);
    if (!run) {
      run = (async (): Promise<Outcome> => {
        const kept = await cacheStore().get(storeKey);
        if (kept) {
          return fromJSON(JSON.parse(kept) as never, { plugins: syncPlugins }) as Outcome;
        }
        let outcome: Outcome;
        try {
          outcome = { result: await withEvent(event, () => fn(...args)) };
        } catch (error) {
          // A redirect is the answer of the post, so a second post redirects too. Other errors
          // are not kept, so the post can be tried again.
          if (!isRedirect(error)) {
            throw error;
          }
          outcome = { redirect: { location: error.location, status: error.status } };
        }
        const text = JSON.stringify(toJSON(outcome, { plugins: syncPlugins, ...serialOptions() }));
        await cacheStore().set(storeKey, text, maxAge);
        return outcome;
      })();
      running.set(storeKey, run);
      void run.then(
        () => running.delete(storeKey),
        () => running.delete(storeKey),
      );
    }
    return run.then((outcome) => {
      if ('redirect' in outcome) {
        redirect(outcome.redirect.location, outcome.redirect.status);
      }
      return outcome.result;
    });
  }) as F;
  Object.defineProperty(wrapper, IDEMPOTENT, { value: true });
  return wrapper;
}
