import { createBrumateVirtualCode } from '@brumate/language-core';
import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { diagnose } from '../src/index.ts';

function document(text: string): TextDocument {
  return TextDocument.create('file:///App.brm', 'brumate', 1, text);
}

function snapshot(text: string) {
  return {
    getText: (start: number, end: number) => text.slice(start, end),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}

describe('diagnostics', () => {
  it('reports the warnings of the compiler at their range', () => {
    const text = `<script>\n  import { $signal } from 'brumate/signals';\n  let todos = $signal([]);\n  function add() {\n    todos.push(1);\n  }\n</script>\n\n<button onClick=add>Add</button>\n`;
    const [warning] = diagnose(document(text), '/App.brm');
    expect(warning?.severity).toBe(2);
    expect(warning?.range).toEqual({
      start: { line: 4, character: 4 },
      end: { line: 4, character: 17 },
    });
  });

  it('reports a compile-time function that is not imported', () => {
    const text = `<script>\n  let count = $signal(0);\n</script>\n<p>{count}</p>\n`;
    const [error] = diagnose(document(text), '/App.brm');
    expect(error?.severity).toBe(1);
    expect(error?.message).toContain("Import $signal from 'brumate/signals'");
    expect(error?.range.start).toEqual({ line: 1, character: 14 });
  });

  it('reports a syntax error at its position, without the file name', () => {
    const [error] = diagnose(document('<p>{count</p>\n'), '/App.brm');
    expect(error?.severity).toBe(1);
    expect(error?.message).not.toMatch(/App\.brm/);
  });
});

describe('styles', () => {
  it('maps each style block to its own code, with interpolations kept the same length', () => {
    const text = `<script>\n  const size = 2;\n</script>\n<p>Hi</p>\n<style lang="scss">\n  p { margin: \${size}rem; }\n</style>\n`;
    const code = createBrumateVirtualCode('/App.brm', snapshot(text));
    const style = code.embeddedCodes?.find((embedded) => embedded.id === 'style_0');
    expect(style?.languageId).toBe('scss');
    const css = style!.snapshot.getText(0, style!.snapshot.getLength());
    expect(css).toBe('\n  p { margin: _______rem; }\n');
    const start = style!.mappings[0]!.sourceOffsets[0]!;
    expect(text.slice(start, start + css.length)).toBe('\n  p { margin: ${size}rem; }\n');
  });
});
