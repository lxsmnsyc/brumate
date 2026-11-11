import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { compile } from '../../src/index.ts';
import type { CompileResult } from '../../src/index.ts';
import { render } from '../../src/runtime/server.ts';

const output = new URL('../.output/block-styles/', import.meta.url);

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
});

interface Rendered {
  html: string;
  results: Record<string, CompileResult>;
}

/** Compiles the files, which import each other by name, and renders the first on the server. */
async function renderFiles(files: Record<string, string>, hideNames = false): Promise<Rendered> {
  const results: Record<string, CompileResult> = {};
  for (const [name, source] of Object.entries(files)) {
    const result = compile(source, { filename: name, hideNames });
    results[name] = result;
    writeFileSync(new URL(`${name}.ts`, output), result.server.replace(/\.brm'/g, ".brm.ts'"));
  }
  const entry = Object.keys(files)[0]!;
  const module = await import(new URL(`${entry}.ts`, output).href);
  return { html: (await render(module.default, {})).html, results };
}

/** The attributes of each element that has a class, as `class: [attributes, …]`, in order. */
function elements(html: string): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const [, attributes] of html.matchAll(/<[a-z]+( [^>]*class="[^"]*"[^>]*)>/g)) {
    const name = /class="([^"]*)"/.exec(attributes!)![1]!;
    (found[name] ??= []).push(attributes!.replace(/ class="[^"]*"/, '').trim());
  }
  return found;
}

/** The scope attributes of an element, such as `b-c-abc b-c-abc-1`. */
function marks(attributes: string): string {
  return attributes
    .split(/\s+/)
    .filter((name) => /^b-c-[\w-]+$/.test(name))
    .join(' ');
}

const tags = `<script>
  const tags = [
    { id: 1, name: 'a', color: 'red' },
    { id: 2, name: 'b', color: 'blue' },
  ];
</script>`;

describe('scope of a block style', () => {
  it('reaches the elements of the block, and none outside it or next to it', async () => {
    const { html, results } = await renderFiles({
      'scopeFor.brm': `${tags}
<p class="outside">outside</p>
#for (tag of tags by tag.id) {
  <span class="tag">{tag.name}</span>
  <style>
    .tag { border: 1px solid; }
  </style>
}
#for (tag of tags by tag.id) {
  <u class="next">{tag.name}</u>
}`,
    });
    const { styles } = results['scopeFor.brm']!.plan;
    const block = `${styles.attribute}-1`;
    expect(styles.blocks.map((item) => item.attribute)).toEqual([block]);
    expect(styles.css).toBe(`.tag[${block}] { border: 1px solid; }`);
    const found = elements(html);
    expect(found.tag!.map(marks)).toEqual([block, block]);
    // The component has no style of its own, so its elements carry no attribute of it.
    expect(found.outside!.map(marks)).toEqual(['']);
    expect(found.next!.map(marks)).toEqual(['', '']);
  });

  it('gives the elements of a nested block the attributes of every block around them', async () => {
    const { html, results } = await renderFiles({
      'scopeNested.brm': `${tags}
<style>
  .tag { margin: 0; }
</style>
#for (tag of tags by tag.id) {
  <span class="tag">{tag.name}</span>
  <style>
    .tag { padding: 1px; }
  </style>
  #if (tag.id === 1) {
    <b class="tag inner">{tag.name}</b>
    <style>
      .inner { color: green; }
    </style>
  }
}
<i class="tag">after</i>`,
    });
    const { styles } = results['scopeNested.brm']!.plan;
    const [outer, inner] = [`${styles.attribute}-1`, `${styles.attribute}-2`];
    const found = elements(html);
    expect(found.tag!.map(marks)).toEqual([
      `${styles.attribute} ${outer}`,
      `${styles.attribute} ${outer}`,
      `${styles.attribute}`,
    ]);
    expect(found['tag inner']!.map(marks)).toEqual([`${styles.attribute} ${outer} ${inner}`]);
    // The component first, then the outer block, then the inner one, so an inner rule wins at the
    // same specificity.
    const rules = styles.css.split('\n');
    expect(rules).toEqual([
      `.tag[${styles.attribute}] { margin: 0; }`,
      `.tag[${outer}] { padding: 1px; }`,
      `.inner[${inner}] { color: green; }`,
    ]);
  });

  it('numbers the blocks in source order, with the outer one first', () => {
    const { plan } = compile(
      `${tags}
#if (tags.length) {
  #for (tag of tags by tag.id) {
    <p class="inner">{tag.name}</p>
    <style>.inner { color: red; }</style>
  }
  <p class="outer">x</p>
  <style>.outer { color: blue; }</style>
}`,
      { filename: 'order.brm' },
    );
    const { attribute, css } = plan.styles;
    // The `#if` is the outer block, though its style comes after the `#for`.
    expect(css.split('\n')).toEqual([
      `.outer[${attribute}-1] { color: blue; }`,
      `.inner[${attribute}-2] { color: red; }`,
    ]);
  });

  it('keeps the style of an #if branch to its branch', async () => {
    const { html, results } = await renderFiles({
      'scopeIf.brm': `<script>
  const open = true;
</script>
#if (open) {
  <p class="a">one</p>
  <style>.a { color: red; }</style>
} #else {
  <p class="a">two</p>
  <style>.a { color: blue; }</style>
}
<p class="a">three</p>`,
    });
    const { attribute } = results['scopeIf.brm']!.plan.styles;
    expect(results['scopeIf.brm']!.plan.styles.css.split('\n')).toEqual([
      `.a[${attribute}-1] { color: red; }`,
      `.a[${attribute}-2] { color: blue; }`,
    ]);
    // The first branch shows. The branch that does not show has no element to carry its attribute.
    expect(elements(html).a!.map(marks)).toEqual([`${attribute}-1`, '']);
  });

  it('makes a #template body a block of its own', async () => {
    const { html, results } = await renderFiles({
      'scopeTemplate.brm': `<p class="mark">outside</p>
#template card(label: string) {
  <i class="mark">{label}</i>
  <style>.mark { color: red; }</style>
}
{card('one')}`,
    });
    const { attribute } = results['scopeTemplate.brm']!.plan.styles;
    expect(elements(html).mark!.map(marks)).toEqual(['', `${attribute}-1`]);
  });

  it('does not give an element that the component passes in through children the attribute', async () => {
    const { html, results } = await renderFiles({
      'scopeParent.brm': `<script>
  import Frame from './Frame.brm';
</script>
<Frame><em class="slot">passed</em></Frame>`,
      'Frame.brm': `<script>
  import { $props } from 'brumate/signals';

  const { children } = $props();
</script>
#if (true) {
  <div class="slot">{children}</div>
  <style>.slot { color: red; }</style>
}`,
    });
    const { attribute } = results['Frame.brm']!.plan.styles;
    // The `div` of the block has the attribute. The `em` was written in the parent, which has none.
    expect(elements(html).slot!.map(marks)).toEqual([`${attribute}-1`, '']);
  });

  it('marks only the elements that a selector of the block could match in a build', async () => {
    const { html, results } = await renderFiles(
      {
        'scopeBuild.brm': `${tags}
#for (tag of tags by tag.id) {
  <span class="tag">{tag.name}</span>
  <em class="plain">{tag.name}</em>
  <style>.tag { color: red; }</style>
}`,
      },
      true,
    );
    const { attribute } = results['scopeBuild.brm']!.plan.styles;
    const found = elements(html);
    expect(found.tag!.map(marks)).toEqual([`${attribute}-1`, `${attribute}-1`]);
    expect(found.plain!.map(marks)).toEqual(['', '']);
  });
});

describe('variables of a block style', () => {
  it('writes the values of each instance on its top-level elements', async () => {
    const { html, results } = await renderFiles({
      'varsFor.brm': `${tags}
#for (tag of tags by tag.id) {
  <script>
    const shade = tag.color + '-dark';
  </script>
  <span class="tag">{tag.name}</span>
  <div class="box"><u class="deep">{tag.name}</u></div>
  <style>
    .tag { background: \${tag.color}; border-color: \${shade}; }
  </style>
}`,
    });
    const { attribute } = results['varsFor.brm']!.plan.styles;
    const names = [`--s-${attribute.slice(4)}-1-0`, `--s-${attribute.slice(4)}-1-1`];
    expect(results['varsFor.brm']!.plan.styles.css).toBe(
      `.tag[${attribute}-1] { background: var(${names[0]}); border-color: var(${names[1]}); }`,
    );
    expect(html).toContain(`<span ${attribute}-1 style="${names[0]}:red;${names[1]}:red-dark"`);
    expect(html).toContain(`<span ${attribute}-1 style="${names[0]}:blue;${names[1]}:blue-dark"`);
    // The elements inside a top-level element inherit them.
    expect(elements(html).box!.map((value) => value.includes('style='))).toEqual([true, true]);
    expect(elements(html).deep!.map((value) => value.includes('style='))).toEqual([false, false]);
  });

  it('keeps the own style of the element and the variables of the component', async () => {
    const { html, results } = await renderFiles({
      'varsMixed.brm': `${tags}
<style>
  p { color: \${tags[0].color}; }
</style>
#for (tag of tags by tag.id) {
  <p class="a" style="margin: 0">{tag.name}</p>
  <style>.a { background: \${tag.color}; }</style>
}`,
    });
    const { attribute } = results['varsMixed.brm']!.plan.styles;
    const hash = attribute.slice(4);
    expect(html).toContain(
      `style="--s-${hash}-0:red;--s-${hash}-1-0:red;margin: 0"`.replace(
        /(.*);(margin: 0)/,
        '$1;$2',
      ),
    );
  });

  it('puts the variables of a block at the top level of another on one element', async () => {
    const { html, results } = await renderFiles({
      'varsNested.brm': `${tags}
#for (tag of tags by tag.id) {
  <style>.row { color: \${tag.color}; }</style>
  #if (tag.id === 1) {
    <b class="row">{tag.name}</b>
    <style>.row { outline-color: \${tag.name}; }</style>
  }
  <div>
    #if (tag.id === 1) {
      <i class="row">{tag.name}</i>
      <style>.row { outline-color: \${tag.name}; }</style>
    }
  </div>
}`,
    });
    const hash = results['varsNested.brm']!.plan.styles.attribute.slice(4);
    // A top-level element of the inner block is a top-level element of the outer one.
    expect(elements(html).row![0]).toContain(`style="--s-${hash}-1-0:red;--s-${hash}-2-0:a"`);
    // The `i` is inside a `div`: it inherits the outer variable and sets its own.
    expect(elements(html).row![1]).toContain(`style="--s-${hash}-3-0:a"`);
  });

  it('gives different values to the rows of a list', async () => {
    const { html } = await renderFiles({
      'varsRows.brm': `${tags}
#for (tag of tags by tag.id) {
  <span class="tag">{tag.name}</span>
  <style>.tag { background: \${tag.color}; }</style>
}`,
    });
    expect(html).toMatch(/style="--s-[\w-]+:red"[^>]*>a<\/span>/);
    expect(html).toMatch(/style="--s-[\w-]+:blue"[^>]*>b<\/span>/);
  });

  it('writes the attributes and the variables in the markup that the browser renders', () => {
    const result = compile(
      `${tags}
#for (tag of tags by tag.id) {
  <span class="tag">{tag.name}</span>
  <style>.tag { background: \${tag.color}; }</style>
}`,
      { filename: 'varsClient.brm' },
    );
    const { attribute } = result.plan.styles;
    const name = `--s-${attribute.slice(4)}-1-0`;
    const code = [result.render, ...Object.values(result.parts), result.client].join('\n');
    expect(code).toContain(`${attribute}-1`);
    expect(code).toContain(name);
    expect(code).toContain('$$b.vars(');
  });
});

describe('style languages in a block', () => {
  it('compiles SCSS and Less in a block, then scopes them', () => {
    for (const [lang, style] of [
      ['scss', '$gap: 4px;\n  .tag { padding: $gap * 2; b { color: ${tag.color}; } }'],
      ['less', '@gap: 4px;\n  .tag { padding: (@gap * 2); b { color: ${tag.color}; } }'],
    ] as const) {
      const { plan } = compile(
        `${tags}\n#for (tag of tags by tag.id) {\n  <p class="tag"><b>{tag.name}</b></p>\n  <style lang="${lang}">\n  ${style}\n  </style>\n}`,
        { filename: `${lang}.brm` },
      );
      const { attribute, css } = plan.styles;
      expect(css).toMatch(new RegExp(`\\.tag\\[${attribute}-1\\] \\{\\n\\s+padding: 8px;\\n\\}`));
      expect(css).toMatch(
        new RegExp(
          `\\.tag\\[${attribute}-1\\] b\\[${attribute}-1\\] \\{\\n\\s+color: var\\(--s-\\w+-1-0\\);\\n\\}`,
        ),
      );
    }
  });
});

function failure(source: string): Error {
  try {
    compile(source, { filename: 'Error.brm' });
  } catch (error) {
    return error as Error;
  }
  throw new Error('compiled');
}

describe('errors', () => {
  it('rejects <style global> in a block', () => {
    expect(
      failure('#if (true) {\n  <p>x</p>\n  <style global>p { margin: 0; }</style>\n}').message,
    ).toMatch(/<style global> is not allowed in a block.*\[BRM205\]/);
  });

  it('rejects :global(…) in the style of a block', () => {
    expect(
      failure('#if (true) {\n  <p>x</p>\n  <style>:global(body) { margin: 0; }</style>\n}').message,
    ).toMatch(/:global\(…\) is not allowed in the <style> of a block.*\[BRM206\]/);
    // Also from a nested rule.
    expect(
      failure('#if (true) {\n  <p>x</p>\n  <style>p { :global(b) { margin: 0; } }</style>\n}')
        .message,
    ).toMatch(/\[BRM206\]/);
  });

  it('rejects a <style> inside an element', () => {
    expect(failure('<div><style>p { margin: 0; }</style></div>').message).toMatch(
      /<style> must be at the top level of the file or of a block.*\[BRM011\]/,
    );
    expect(
      failure('#if (true) {\n  <div><style>p { margin: 0; }</style></div>\n}').message,
    ).toMatch(/\[BRM011\]/);
  });

  it('rejects an unknown attribute', () => {
    expect(
      failure('#if (true) {\n  <p>x</p>\n  <style scoped>p { margin: 0; }</style>\n}').message,
    ).toMatch(/Unknown <style> attribute "scoped".*\[BRM189\]/);
  });

  it('rejects a <style> in a #reveal', () => {
    expect(failure('#reveal {\n  <style>p { margin: 0; }</style>\n  <p>x</p>\n}').message).toMatch(
      /#reveal has no style of its own.*\[BRM207\]/,
    );
  });

  it('reports invalid CSS in a block', () => {
    expect(failure('#if (true) {\n  <p>x</p>\n  <style>p { color: </style>\n}').message).toMatch(
      /Invalid CSS/,
    );
  });
});
