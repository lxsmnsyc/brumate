// The structural compare that the resume repair and the store updates use.
import { describe, expect, it } from 'vitest';
import { sameData } from '../src/runtime/store.ts';

/** A plain object whose keys all point back to itself, with a mark. */
function cycle(keys: number, mark: number): Record<string, unknown> {
  const value: Record<string, unknown> = { mark };
  for (let index = 0; index < keys; index++) {
    value[`k${index}`] = value;
  }
  return value;
}

describe('sameData', () => {
  it('compares arrays and plain objects by content', () => {
    expect(sameData({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(sameData({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
    expect(sameData([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(sameData({ a: 1 }, { b: 1 })).toBe(false);
    expect(sameData(Number.NaN, Number.NaN)).toBe(true);
    expect(sameData(0, -0)).toBe(false);
  });

  it('counts other objects as changed', () => {
    expect(sameData(new Date(0), new Date(0))).toBe(false);
    expect(sameData(new Map(), new Map())).toBe(false);
  });

  it('ends on cycles, in time that grows with the keys, not as a power of them', () => {
    expect(sameData(cycle(1, 1), cycle(1, 1))).toBe(true);
    expect(sameData(cycle(1, 1), cycle(1, 2))).toBe(false);
    const start = performance.now();
    expect(sameData(cycle(8, 1), cycle(8, 1))).toBe(true);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('compares data that is deeper than any fixed limit', () => {
    let left: unknown = 0;
    let right: unknown = 0;
    for (let index = 0; index < 100; index++) {
      left = { next: left };
      right = { next: right };
    }
    expect(sameData(left, right)).toBe(true);
  });
});
