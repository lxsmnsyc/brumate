import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';

function source(style: string): string {
  return `<script>\n  const color = 'red';\n</script>\n\n${style}\n\n<div class="card"><p>Hi</p></div>`;
}

function css(style: string): string {
  return compile(source(style), { filename: 'Card.brm' }).plan.styles.css;
}

describe('style languages', () => {
  it('compiles SCSS, then scopes it', () => {
    const result = css(`<style lang="scss">
  $gap: 4px;
  .card {
    padding: $gap * 2;
    p {
      color: \${color};
    }
  }
</style>`);
    expect(result).toMatch(/\.card\[s-\w+\] \{\n\s+padding: 8px;\n\}/);
    expect(result).toMatch(/\.card\[s-\w+\] p\[s-\w+\] \{\n\s+color: var\(--s-\w+-0\);\n\}/);
  });

  it('compiles Less, then scopes it', () => {
    const result = css(`<style lang="less">
  @gap: 4px;
  .card {
    padding: (@gap * 2);
    p {
      color: \${color};
    }
  }
</style>`);
    expect(result).toMatch(/\.card\[s-\w+\] \{\n\s+padding: 8px;\n\}/);
    expect(result).toMatch(/\.card\[s-\w+\] p\[s-\w+\] \{\n\s+color: var\(--s-\w+-0\);\n\}/);
  });

  it('reports errors of the preprocessor', () => {
    expect(() =>
      compile(source('<style lang="scss">\n  .card { color: $missing; }\n</style>'), {
        filename: 'Card.brm',
      }),
    ).toThrow(/Undefined variable/);
  });
});
