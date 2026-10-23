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

/** The opening tags in the server module of a build. */
function tags(markup: string, style: string, hideNames = true): string[] {
  const { server, plan } = compile(`${markup}\n\n<style>\n${style}\n</style>`, {
    filename: 'Scoped.brm',
    hideNames,
  });
  const attribute = plan.styles.attribute;
  return [...server.matchAll(/(?<=[">])<(\w+)( s-\w+)?/g)].map(
    ([, tag, scoped]) => `${tag}${scoped === ` ${attribute}` ? '+' : ''}`,
  );
}

describe('scope attribute', () => {
  it('marks only the elements that a scoped selector can match', () => {
    expect(
      tags(
        '<div class="card"><p>Hi</p><span class="x">a</span><i>b</i></div><meta charset="utf-8">',
        '  .card p { color: red; }\n  span.x { color: blue; }',
      ),
    ).toEqual(['div+', 'p+', 'span+', 'i', 'meta']);
  });

  it('marks elements whose classes are not known', () => {
    const markup = [
      '<script>',
      '  let active = $signal(true);',
      "  import { $signal } from 'brumate/signals';",
      '</script>',
      '<b class={ on: active }>a</b><i {...{}}>b</i><u onClick=(() => {})>c</u><s>d</s><p class="on">e</p>',
    ].join('\n');
    expect(tags(markup, '  .on { color: red; }')).toEqual(['b+', 'i+', 'u+', 's', 'p+']);
  });

  it('makes a selector for each item of a list in :global', () => {
    const result = compile(
      '<div class="card"><h1>Hi</h1></div>\n<style>\n  :global(h1, h2) { margin: 0; }\n  .card :global(h1, h2) span { color: red; }\n</style>',
      {
        filename: 'List.brm',
      },
    );
    const [plain, scoped] = result.plan.styles.css.split('\n').map((line) => line.trim());
    expect(plain).toBe('h1,h2 { margin: 0; }');
    // The scoped parts around the list are in each selector.
    expect(scoped).toMatch(
      /^\.card\[[\w-]+\] h1 span\[[\w-]+\],\.card\[[\w-]+\] h2 span\[[\w-]+\] \{/,
    );
  });

  it('marks no element when every rule is global', () => {
    expect(
      tags('<div class="a"><p>Hi</p></div>', '  :global(.a) :global(p) { margin: 0; }'),
    ).toEqual(['div', 'p']);
  });

  it('marks every element when a selector can match any element', () => {
    expect(tags('<div><p>Hi</p></div>', '  [hidden] { display: none; }')).toEqual(['div+', 'p+']);
  });

  it('marks every element in development, so changes to the styles apply', () => {
    expect(tags('<div><p>Hi</p></div>', '  p { margin: 0; }', false)).toEqual(['div+', 'p+']);
  });
});

describe('minified styles', () => {
  const style =
    '<style>\n  /* note */\n  .card,\n  p {\n    color: red;\n    margin: 0 auto !important;\n  }\n</style>';

  it('leaves out comments and whitespace in a build', () => {
    const { server, render } = compile(source(style), { filename: 'Card.brm', hideNames: true });
    for (const code of [server, render]) {
      expect(code).toMatch(
        /const \$\$css = "\.card\[s-\w+\], p\[s-\w+\]\{color:red;margin:0 auto!important\}";/,
      );
    }
  });

  it('keeps the styles readable in development', () => {
    const result = compile(source(style), { filename: 'Card.brm' });
    expect(result.server).toContain(`const $$css = ${JSON.stringify(result.css)};`);
    expect(result.css).toContain('/* note */');
  });
});
