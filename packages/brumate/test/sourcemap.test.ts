import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import type { SourceMap } from '../src/index.ts';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** The source line and column of each mapped position, by generated line. */
function decode(map: SourceMap): [column: number, line: number, sourceColumn: number][][] {
  let line = 0;
  let sourceColumn = 0;
  return map.mappings.split(';').map((group) => {
    let column = 0;
    return group
      .split(',')
      .filter(Boolean)
      .map((segment) => {
        const values: number[] = [];
        let value = 0;
        let shift = 0;
        for (const char of segment) {
          const digit = BASE64.indexOf(char);
          value += (digit & 31) << shift;
          if (digit & 32) {
            shift += 5;
          } else {
            values.push(value & 1 ? -(value >> 1) : value >> 1);
            value = 0;
            shift = 0;
          }
        }
        column += values[0]!;
        line += values[2]!;
        sourceColumn += values[3]!;
        return [column, line, sourceColumn] as [number, number, number];
      });
  });
}

/** Where a text of the generated code maps to in the file, as `line:column`, both from 1. */
function origin(code: string, map: SourceMap, text: string): string {
  const offset = code.indexOf(text);
  const before = code.slice(0, offset).split('\n');
  const line = before.length - 1;
  const column = before.at(-1)!.length;
  // The last segment at or before the column.
  const segments = decode(map)[line]!;
  const segment = segments.findLast(([start]) => start <= column)!;
  return `${segment[1] + 1}:${segment[2] + 1 + (column - segment[0])}`;
}

const source = `<script>
  import { $memo, $signal } from 'brumate/signals';

  let count = $signal(0);
  const double = $memo(count * 2);

  function add(step: number) {
    count += step;
  }
</script>

<button onClick=(() => add(1))>{count}</button>
<p>{double}</p>
`;

describe('source maps', () => {
  const result = compile(source, { filename: 'Counter.brm' });

  it('point the code of the file back to it, in each module', () => {
    // The handler part holds the function that the click calls.
    const name = Object.keys(result.parts).find((part) => part !== 'update')!;
    expect(origin(result.parts[name]!, result.maps.parts[name]!, 'step: number')).toBe('7:16');
    expect(origin(result.server, result.maps.server, 'count * 2')).toBe('5:24');
  });

  it('name the file and hold its source', () => {
    expect(result.maps.client).toMatchObject({
      version: 3,
      sources: ['Counter.brm'],
      sourcesContent: [source],
    });
  });

  it('leave no marks in the code', () => {
    for (const code of [
      result.server,
      result.client,
      result.render,
      ...Object.values(result.parts),
    ]) {
      expect(code).not.toMatch(/[]/);
    }
  });
});
