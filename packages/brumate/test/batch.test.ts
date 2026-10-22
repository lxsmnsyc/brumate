// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { batched } from '../src/runtime/batch.ts';
import { RequestEvent, withEvent } from '../src/runtime/request.ts';

/** A read of many keys that records each call, and finds a name for each ID. */
function reader(fail: (ids: string[]) => boolean = () => false) {
  const calls: string[][] = [];
  const readMany = vi.fn<(ids: string[]) => Promise<Map<string, string>>>(async (ids) => {
    calls.push(ids);
    if (fail(ids)) {
      throw new Error(`No read of ${ids.join(',')}`);
    }
    return new Map(ids.map((id) => [id, `name ${id}`]));
  });
  return { calls, readMany };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('batched', () => {
  it('reads the keys of one moment with one call, and each call gets its own value', async () => {
    const { calls, readMany } = reader();
    const getName = batched(readMany, (found, id: string) => found.get(id) ?? null);
    const values = await Promise.all(['1', '2', '1', '3'].map(getName));
    expect(values).toEqual(['name 1', 'name 2', 'name 1', 'name 3']);
    expect(calls).toEqual([['1', '2', '3']]);
    // A later moment is a batch of its own.
    expect(await getName('4')).toBe('name 4');
    expect(calls).toHaveLength(2);
  });

  it('splits a batch at the limit, and a failed read rejects only its own calls', async () => {
    const { calls, readMany } = reader((ids) => ids.includes('3'));
    const getName = batched(readMany, (found, id: string) => found.get(id), { limit: 2 });
    const results = await Promise.allSettled(['1', '2', '3'].map(getName));
    expect(calls).toEqual([['1', '2'], ['3']]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled', 'rejected']);
  });

  it('rejects only the calls of a key whose lookup throws', async () => {
    const { readMany } = reader();
    const getName = batched(readMany, (found, id: string) => {
      if (id === 'gone') {
        throw new Error('Gone');
      }
      return found.get(id);
    });
    const [kept, gone, again] = await Promise.allSettled(['1', 'gone', 'gone'].map(getName));
    expect(kept).toEqual({ status: 'fulfilled', value: 'name 1' });
    expect(gone).toEqual({ status: 'rejected', reason: new Error('Gone') });
    expect(again!.status).toBe('rejected');
  });

  it('tells keys that are objects apart with `key`, and gathers for `wait`', async () => {
    const readMany = vi.fn<(keys: { id: number }[]) => Promise<number[]>>(async (keys) =>
      keys.map((key) => key.id * 10),
    );
    const getValue = batched(readMany, (found, key: { id: number }) => found[0]! + key.id, {
      key: (key) => key.id,
      wait: 20,
    });
    const first = getValue({ id: 1 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = getValue({ id: 1 });
    const third = getValue({ id: 2 });
    expect(await Promise.all([first, second, third])).toEqual([11, 11, 12]);
    expect(readMany).toHaveBeenCalledTimes(1);
    expect(readMany.mock.calls[0]![0]).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('reads each key at once on the server', async () => {
    const { calls, readMany } = reader();
    const getName = batched(readMany, (found, id: string) => found.get(id));
    vi.stubGlobal('document', undefined);
    expect(await Promise.all(['1', '2'].map(getName))).toEqual(['name 1', 'name 2']);
    expect(calls).toEqual([['1'], ['2']]);
    vi.unstubAllGlobals();
    // While the server answers a request in a test, also with a DOM.
    const event = new RequestEvent(new Request('http://localhost/'));
    const value = withEvent(event, () => getName('3'));
    expect(calls.at(-1)).toEqual(['3']);
    expect(await value).toBe('name 3');
  });
});
