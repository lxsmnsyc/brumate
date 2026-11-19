// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { NotReady, get, pend } from '../src/runtime/client/updates.ts';
import type { Scope } from '../src/runtime/client/state.ts';

// A render that reads a memo that is still loading computes again once the memo settles.

function open(): { source: Promise<void>; settle: () => void } {
  let settle!: () => void;
  const source = new Promise<void>((done) => {
    settle = done;
  });
  return { source, settle };
}

describe('pend', () => {
  it('computes again once the source settles, and gives the value', async () => {
    const { source, settle } = open();
    let ready = false;
    const value = pend(() => {
      if (!ready) {
        throw new NotReady(source);
      }
      return 'ada';
    });
    expect(value).toBeInstanceOf(Promise);
    ready = true;
    settle();
    expect(await value).toBe('ada');
  });

  it('stops after a second wait at the same slot that is never written', async () => {
    const scope = { id: -1, k: 0, s: [] } as unknown as Scope;
    let runs = 0;
    const value = pend(() => {
      runs++;
      // A slot that the scope has not written: `get` waits for it.
      return get(scope, 3);
    });
    await expect(value).rejects.toBeInstanceOf(NotReady);
    expect(runs).toBe(2);
  });

  it('computes nothing more once the scope is gone', async () => {
    const { source, settle } = open();
    const scope = { id: -2, k: 0, s: [] } as unknown as Scope;
    let runs = 0;
    const value = pend(() => {
      runs++;
      throw new NotReady(source);
    }, scope);
    scope.gone = true;
    settle();
    expect(await value).toBeUndefined();
    expect(runs).toBe(1);
  });

  it('computes again for a scope that stays', async () => {
    const { source, settle } = open();
    const scope = { id: -3, k: 0, s: [] } as unknown as Scope;
    let runs = 0;
    const value = pend(() => {
      runs++;
      if (runs === 1) {
        throw new NotReady(source);
      }
      return runs;
    }, scope);
    settle();
    expect(await value).toBe(2);
  });
});
