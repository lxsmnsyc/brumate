import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { compile } from '../src/index.ts';

const path = fileURLToPath(new URL('./styles/Card.brm', import.meta.url));

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

  it('imports files next to the component', () => {
    const scss = compile(
      source('<style lang="scss">\n  @use "theme";\n  p { color: theme.$brand; }\n</style>'),
      {
        filename: 'Card.brm',
        path,
      },
    );
    expect(scss.plan.styles.css).toMatch(/color: rebeccapurple/);
    const less = compile(
      source('<style lang="less">\n  @import "theme.less";\n  p { color: @brand; }\n</style>'),
      {
        filename: 'Card.brm',
        path,
      },
    );
    expect(less.plan.styles.css).toMatch(/color: teal/);
  });

  it('puts text that touches an interpolation into the variable, such as a unit', () => {
    const result = compile(
      source(
        '<style>\n  p { margin: -${size}px; color: #${hex}; width: calc(${size}px + 1rem); content: "${label} items"; }\n</style>',
      ).replace("const color = 'red';", 'const size = 2; const hex = "fff"; const label = "a";'),
      { filename: 'Card.brm' },
    );
    expect(result.plan.styles.css).toMatch(
      /margin: var\(--s-\w+-0\); color: var\(--s-\w+-1\); width: calc\(var\(--s-\w+-2\) \+ 1rem\); content: "var\(--s-\w+-3\) items"/,
    );
    expect(
      result.plan.styles.variables.map((variable) => [variable.prefix, variable.suffix]),
    ).toEqual([
      ['-', 'px'],
      ['#', ''],
      ['', 'px'],
      ['', ''],
    ]);
    expect(result.server).toContain('$$b.affix("-", (size), "px")');
  });
});
