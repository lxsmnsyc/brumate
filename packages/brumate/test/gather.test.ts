import { describe, expect, it } from 'vitest';
import { gather } from '../src/runtime/gather.ts';

async function* values<T>(...items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

async function all<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const value of stream) {
    result.push(value);
  }
  return result;
}

describe('gather', () => {
  it('gives the list so far after each value, starting empty', async () => {
    expect(await all(gather(values('a', 'b')))).toEqual([[], ['a'], ['a', 'b']]);
  });

  it('puts a value with a key that came before in place of its item', async () => {
    const stream = values({ id: 1, text: 'draft' }, { id: 2, text: 'b' }, { id: 1, text: 'done' });
    const lists = await all(gather(stream, { key: (item) => item.id }));
    expect(lists.at(-1)).toEqual([
      { id: 1, text: 'done' },
      { id: 2, text: 'b' },
    ]);
  });

  it('takes a promise of a stream, as a server function call gives', async () => {
    expect(await all(gather(Promise.resolve(values(1))))).toEqual([[], [1]]);
  });

  it('does not start the stream for the first, empty list', async () => {
    let started = false;
    async function* reply(): AsyncGenerator<string> {
      started = true;
      yield 'hi';
    }
    const lists = gather(reply());
    expect((await lists.next()).value).toEqual([]);
    // The server stops after the first value, as it does for a memo.
    await lists.return();
    expect(started).toBe(false);
  });
});
