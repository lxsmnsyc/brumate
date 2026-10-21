import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { INITIAL, Registry, parseRawGrammar } from 'vscode-textmate';
import type { IGrammar } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import { beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
let grammar: IGrammar;

beforeAll(async () => {
  await loadWASM(readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer);
  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (sources) => new OnigScanner(sources),
      createOnigString: (text) => new OnigString(text),
    }),
    // Embedded languages are empty here. Their scopes come from the brumate grammar.
    loadGrammar: async (scopeName) =>
      scopeName === 'source.brm'
        ? parseRawGrammar(
            readFileSync(new URL('../syntaxes/brumate.tmLanguage.json', import.meta.url), 'utf8'),
            'brumate.tmLanguage.json',
          )
        : ({ scopeName, patterns: [], repository: {} } as never),
  });
  grammar = (await registry.loadGrammar('source.brm'))!;
});

/** The scopes of each token of the lines, as `text: scope scope`. */
function tokens(source: string): string[] {
  let state = INITIAL;
  const result: string[] = [];
  for (const line of source.split('\n')) {
    const { tokens: lineTokens, ruleStack } = grammar.tokenizeLine(line, state);
    state = ruleStack;
    for (const token of lineTokens) {
      const text = line.slice(token.startIndex, token.endIndex);
      if (text.trim()) {
        result.push(`${text.trim()}: ${token.scopes.slice(1).join(' ')}`);
      }
    }
  }
  return result;
}

/** The scopes of the first token with this text. */
function scopeOf(source: string, text: string): string {
  const token = tokens(source).find((item) => item.startsWith(`${text}:`));
  return token?.slice(text.length + 2) ?? '';
}

describe('grammar', () => {
  it('embeds TypeScript in scripts and CSS in styles, by lang', () => {
    const source =
      '<script>\n  let a = 1;\n</script>\n<style lang="scss">\n  p { color: red; }\n</style>';
    expect(scopeOf(source, 'let a = 1;')).toBe('meta.embedded.block.ts');
    expect(scopeOf(source, 'p { color: red; }')).toBe('meta.embedded.block.scss');
    expect(scopeOf(source, 'style')).toBe('entity.name.tag.style.brumate');
  });

  it('marks blocks, their headers and the brace that closes them', () => {
    const source = '#for (todo of todos by todo.id) {\n  <li>{todo.title}</li>\n} #else {\n}';
    expect(scopeOf(source, '#')).toBe('keyword.control.block.brumate');
    expect(scopeOf(source, 'for')).toBe('keyword.control.block.brumate');
    expect(scopeOf(source, 'todo of todos by todo.id')).toBe('meta.embedded.expression.ts');
    expect(scopeOf(source, 'todo.title')).toBe('meta.embedded.expression.ts');
    expect(tokens(source)).toContain('}: punctuation.section.block.end.brumate');
    expect(scopeOf(source, 'else')).toBe('keyword.control.block.brumate');
  });

  it('marks components, events and attribute values without quotes', () => {
    const source = '<Foo value=fetchUser(id) onClick:prevent=add class={ done: x } label="hi" />';
    expect(scopeOf(source, 'Foo')).toBe('meta.tag.brumate support.class.component.brumate');
    expect(scopeOf(source, 'onClick:prevent')).toBe(
      'meta.tag.brumate entity.other.attribute-name.event.brumate',
    );
    expect(scopeOf(source, 'fetchUser')).toBe('meta.tag.brumate meta.embedded.expression.ts');
    expect(scopeOf(source, 'id')).toBe(
      'meta.tag.brumate meta.embedded.expression.ts meta.embedded.expression.ts',
    );
    expect(scopeOf(source, 'done: x')).toBe('meta.tag.brumate meta.embedded.expression.ts');
    expect(scopeOf(source, 'hi')).toBe('meta.tag.brumate string.quoted.double.brumate');
    expect(scopeOf(source, '/>')).toBe('meta.tag.brumate punctuation.definition.tag.end.brumate');
  });

  it('keeps text after a value without quotes as markup', () => {
    const source = '<input value=draft>text';
    expect(scopeOf(source, 'text')).toBe('');
    expect(scopeOf(source, 'draft')).toBe('meta.tag.brumate meta.embedded.expression.ts');
  });
});
