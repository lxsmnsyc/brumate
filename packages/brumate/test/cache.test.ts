import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cached,
  memoryStore,
  revalidate,
  setCacheStore,
  storageStore,
} from '../src/runtime/cache.ts';
import { RequestEvent, getEvent, withEvent } from '../src/runtime/request.ts';

afterEach(() => {
  setCacheStore(memoryStore());
});

describe('cached', () => {
  it('keeps a result by its arguments for maxAge seconds', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(0);
    const load = vi.fn<(status: string) => Promise<{ status: string; at: Date }>>(
      async (status) => ({
        status,
        at: new Date(0),
      }),
    );
    const list = cached(load, { maxAge: 30 });
    expect(await list('open')).toEqual({ status: 'open', at: new Date(0) });
    await list('open');
    await list('closed');
    expect(load).toHaveBeenCalledTimes(2);
    now.mockReturnValue(31_000);
    await list('open');
    expect(load).toHaveBeenCalledTimes(3);
    now.mockRestore();
  });

  it('gives each caller its own copy', async () => {
    const list = cached(async () => ({ items: [1, 2] }), { maxAge: 30 });
    const first = await list();
    first.items.push(3);
    expect(await list()).toEqual({ items: [1, 2] });
  });

  it('shares one run between calls with the same arguments', async () => {
    let finish!: () => void;
    const load = vi.fn<() => Promise<number>>(
      () => new Promise<number>((done) => (finish = () => done(1))),
    );
    const one = cached(load, { maxAge: 30 });
    const both = Promise.all([one(), one()]);
    await vi.waitFor(() => expect(load).toHaveBeenCalled());
    finish();
    expect(await both).toEqual([1, 1]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not keep an error', async () => {
    const load = vi.fn<() => Promise<string>>(async () => {
      if (load.mock.calls.length === 1) {
        throw new Error('down');
      }
      return 'up';
    });
    const status = cached(load, { maxAge: 30 });
    await expect(status()).rejects.toThrow('down');
    expect(await status()).toBe('up');
  });

  it('runs without the request, so a result never holds one user', async () => {
    const event = new RequestEvent(new Request('https://example.com/'));
    const user = cached(async () => getEvent().getCookie('session'), { maxAge: 30 });
    await expect(withEvent(event, () => user())).rejects.toThrow('getEvent() works in');
  });

  it('drops the results of a tag on revalidate', async () => {
    const load = vi.fn<(status: string) => Promise<string>>(async (status) => status);
    const list = cached(load, { maxAge: 300, tags: (status) => ['issues', `issues:${status}`] });
    await list('open');
    await list('closed');
    await revalidate('issues:open');
    await list('open');
    await list('closed');
    expect(load.mock.calls.map(([status]) => status)).toEqual(['open', 'closed', 'open']);
    await revalidate('issues');
    await list('closed');
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('needs a name with a store that other processes share', async () => {
    const values = new Map<string, string>();
    setCacheStore(
      storageStore({
        getItem: async (key) => values.get(key) ?? null,
        setItem: async (key, value) => void values.set(key, value),
      }),
    );
    await expect(cached(async () => 1, { maxAge: 30 })()).rejects.toThrow('Give cached a name');
    const named = cached(async () => 1, { maxAge: 30, name: 'one' });
    expect(await named()).toBe(1);
    expect([...values.keys()]).toEqual([expect.stringMatching(/^brumate:cache:one:/)]);
  });

  it('keeps at most size values in memory', async () => {
    setCacheStore(memoryStore(2));
    const load = vi.fn<(n: number) => Promise<number>>(async (n) => n);
    const square = cached(load, { maxAge: 30 });
    await square(1);
    await square(2);
    await square(3);
    await square(1);
    expect(load).toHaveBeenCalledTimes(4);
  });
});
