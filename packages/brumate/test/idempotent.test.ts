import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryStore, setCacheStore } from '../src/runtime/cache.ts';
import { idempotent } from '../src/runtime/idempotent.ts';
import { RequestEvent, dedupe, isRedirect, redirect, withEvent } from '../src/runtime/request.ts';
import { Context, action } from '../src/runtime/server.ts';

afterEach(() => {
  setCacheStore(memoryStore());
});

/** Makes an idempotent function, registered under an ID as the server registers a file. */
function register<A extends unknown[], R>(fn: (...args: A) => R, id: string) {
  return dedupe(idempotent(fn), id);
}

/** Posts to a function with a key in the URL, as a form of it posts. */
function post<A extends unknown[], R>(fn: (...args: A) => R, key: string | undefined, ...args: A) {
  const url = `https://example.com/_brumate/f${key ? `?__key=${key}` : ''}`;
  return withEvent(new RequestEvent(new Request(url, { method: 'POST' })), () => fn(...args));
}

describe('idempotent', () => {
  it('runs once for a key, and gives a second post the first result', async () => {
    let orders = 0;
    const order = register(async (item: string) => ({ id: ++orders, item }), 'orders#order');
    const first = await post(order, 'key-00000001', 'tea');
    const second = await post(order, 'key-00000001', 'tea');
    expect(second).toEqual(first);
    expect(orders).toBe(1);
    // Another form, with another key, runs again.
    await post(order, 'key-00000002', 'tea');
    expect(orders).toBe(2);
  });

  it('makes a second post while the first runs wait for it', async () => {
    let finish!: () => void;
    const slow = vi.fn<() => Promise<string>>(
      () => new Promise((done) => (finish = () => done('done'))),
    );
    const order = register(slow, 'orders#slow');
    const both = Promise.all([post(order, 'key-00000003'), post(order, 'key-00000003')]);
    await vi.waitFor(() => expect(slow).toHaveBeenCalled());
    finish();
    expect(await both).toEqual(['done', 'done']);
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it('gives a second post the same redirect, and runs again after an error', async () => {
    let runs = 0;
    const order = register(async () => {
      runs++;
      if (runs === 1) {
        throw new Error('the database was busy');
      }
      redirect('/orders/7');
    }, 'orders#redirect');
    await expect(post(order, 'key-00000004')).rejects.toThrow('the database was busy');
    const caught = await post(order, 'key-00000004').catch((error: unknown) => error);
    const again = await post(order, 'key-00000004').catch((error: unknown) => error);
    expect(isRedirect(caught) && isRedirect(again) && again.location).toBe('/orders/7');
    expect(runs).toBe(2);
  });

  it('runs each call without a key, such as one from a handler', async () => {
    let runs = 0;
    const order = register(async () => ++runs, 'orders#plain');
    await post(order, undefined);
    await post(order, undefined);
    expect(runs).toBe(2);
  });

  it('puts a new key in each form that the server renders for it, and keeps the page private', () => {
    register(async () => 1, 'orders#form');
    const event = new RequestEvent(new Request('https://example.com/'));
    const ctx = new Context();
    ctx.event = event;
    const first = action(ctx, 'action', 'orders#form', 'method');
    const second = action(ctx, 'action', 'orders#form', 'method');
    expect(first).toMatch(/__key=[\w-]{36}/);
    expect(first).not.toBe(second);
    expect(event.personal).toBe(true);
    // A form of another function has no key.
    expect(action(ctx, 'action', 'notes#add', 'method')).not.toContain('__key');
  });
});
