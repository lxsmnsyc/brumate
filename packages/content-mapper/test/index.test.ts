import { describe, expect, it } from 'vitest';
import { SYNTAX_ERROR, mapBrm } from '../src/index.ts';
import type { SpanMapping } from '../src/index.ts';

const SOURCE = `<script>
  const label = '😀 hi';
</script>

<Badge label=label />
`;

/** The original and virtual text of each span. */
function spans(source: string, text: string, mappings: SpanMapping[] = []): string[][] {
  return mappings.map(([virtualStart, virtualLength, originalStart, originalLength, kind]) => [
    String(kind),
    source.slice(originalStart, originalStart + originalLength),
    text.slice(virtualStart, virtualStart + virtualLength),
  ]);
}

describe('mapBrm', () => {
  it('maps copied code as the same text, and code that stands for a range as one unit', () => {
    const { text, mappings, extension } = mapBrm('App.brm', SOURCE);
    expect(extension).toBe('.ts');
    const all = spans(SOURCE, text, mappings);
    expect(all).toContainEqual(['0', "const label = '😀 hi';", "const label = '😀 hi';"]);
    // The braces of the props object stand for the `<` and the `>` of the tag.
    expect(all).toContainEqual(['1', '<', '{']);
    expect(all).toContainEqual(['1', '>', '}']);
  });

  it('counts positions in UTF-8 bytes when TypeScript asks for them', () => {
    const utf16 = mapBrm('App.brm', SOURCE, 'utf-16');
    const utf8 = mapBrm('App.brm', SOURCE, 'utf-8');
    const last16 = utf16.mappings!.at(-1)!;
    const last8 = utf8.mappings!.at(-1)!;
    // The emoji takes 2 UTF-16 units and 4 bytes.
    expect(last8[2]).toBe(Buffer.byteLength(SOURCE.slice(0, last16[2])));
    expect(last8[0]).toBe(Buffer.byteLength(utf16.text.slice(0, last16[0])));
  });

  it('reports a syntax error and keeps the scripts', () => {
    const source = `<script>\n  const value = 1;\n</script>\n<p>{value</p>\n`;
    const { text, diagnostics } = mapBrm('Broken.brm', source);
    expect(text).toContain('const value = 1;');
    expect(diagnostics).toEqual([
      {
        messageText: 'Unterminated regular expression',
        start: source.indexOf('/p>'),
        length: 1,
        code: SYNTAX_ERROR,
      },
    ]);
  });
});
