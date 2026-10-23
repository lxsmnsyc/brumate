import { describe, expect, it } from 'vitest';
import { originalPosition } from '../src/sourcemap.ts';

describe('originalPosition', () => {
  // Line 1: column 0 maps to a.ts 1:0, column 4 to a.ts 1:6. Line 2: column 2 maps to a.ts 3:2.
  const map = { sources: ['a.ts'], mappings: 'AAAA,IAAM;EAEJ' };

  it('finds the segment at or before the column', () => {
    expect(originalPosition(map, 1, 1)).toEqual({ source: 'a.ts', line: 1, column: 1 });
    expect(originalPosition(map, 1, 9)).toEqual({ source: 'a.ts', line: 1, column: 7 });
    expect(originalPosition(map, 2, 5)).toEqual({ source: 'a.ts', line: 3, column: 3 });
  });

  it('has no place before the first segment of a line, or on a line without one', () => {
    expect(originalPosition(map, 2, 1)).toBeUndefined();
    expect(originalPosition(map, 5, 1)).toBeUndefined();
  });
});
