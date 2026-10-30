import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import { component, render } from '../src/runtime/server.ts';
import type { Context } from '../src/runtime/server.ts';

/** The error that compiling the markup gives, or undefined. */
function failure(markup: string): string | undefined {
  try {
    compile(markup, { filename: 'Test.brm' });
  } catch (error) {
    return (error as Error).message;
  }
  return undefined;
}

describe('markup that the HTML parser closes or moves', () => {
  it.each([
    ['<p>text <div>x</div></p>', '<div> cannot be inside <p>'],
    ['<p><span><section>x</section></span></p>', '<section> cannot be inside <p>'],
    ['<p>#if (true) {\n<ul><li>x</li></ul>\n}</p>', '<ul> cannot be inside <p>'],
    ['<p><p>x</p></p>', '<p> cannot be inside <p>'],
    ['<h1>a<h2>b</h2></h1>', '<h2> cannot be inside <h1>'],
    ['<ul><li>a<li>b</li></li></ul>', '<li> cannot be inside <li>'],
    ['<a href="/a"><a href="/b">x</a></a>', '<a> cannot be inside <a>'],
    ['<a href="/a"><div><a href="/b">x</a></div></a>', '<a> cannot be inside <a>'],
    ['<form><div><form></form></div></form>', '<form> cannot be inside <form>'],
    ['<button><button>x</button></button>', '<button> cannot be inside <button>'],
    ['<table><div>x</div></table>', '<div> cannot be inside <table>'],
    ['<table><tbody><div>x</div></tbody></table>', '<div> cannot be inside <tbody>'],
    ['<table><tr><span>x</span></tr></table>', '<span> cannot be inside <tr>'],
  ])('reports %s', (markup, message) => {
    const error = failure(markup);
    expect(error).toContain(message);
    expect(error).toContain('[BRM185]');
    expect(error).toContain('as="span"');
  });

  it.each([
    '<p>text <span>x</span> <b>y</b> <a href="/">z</a></p>',
    '<div><p>x</p><p>y</p></div>',
    '<ul><li><p>x</p></li><li>y<ul><li>z</li></ul></li></ul>',
    '<p><button><div>x</div></button></p>',
    '<p><svg><foreignObject><div>x</div></foreignObject></svg></p>',
    '<p><template><div>x</div></template></p>',
    '<a href="/a"><button>x</button></a>',
    '<form><button>x</button></form><form></form>',
    '<table><caption><div>x</div></caption><thead><tr><th>a</th></tr></thead><tbody><tr><td><div>x</div><p>y</p></td></tr></tbody></table>',
    '<table>#for (row of [1]) {\n<tr><td>{row}</td></tr>\n}</table>',
    '<table><form></form><tr><td></td></tr></table>',
    '<dl><dt>a</dt><dd>b</dd><dt>c</dt></dl>',
    '<h1>a</h1><h2>b</h2><h2><span>c</span></h2>',
    '<p><b><i>x</i></b></p><div>y</div>',
    '<ul><li><a href="/">x</a><ul><li>y</li></ul></li></ul>',
  ])('stays silent for %s', (markup) => {
    expect(failure(markup)).toBeUndefined();
  });

  it('does not look through a component, a dynamic tag or a portal', () => {
    const script = "<script>import Box from './Box.brm';</script>\n";
    expect(failure(`${script}<p><Box><div>x</div></Box></p>`)).toBeUndefined();
    expect(failure(`${script}<p><Box /></p>`)).toBeUndefined();
    expect(failure('<p>#portal (document.body) {\n<div>x</div>\n}</p>')).toBeUndefined();
  });

  it('marks a component inside a <p> for the server, and no other', () => {
    const script = "<script>import Box from './Box.brm';</script>\n";
    const inside = compile(`${script}<p>T <Box /></p>`, { filename: 'Page.brm' }).server;
    expect(inside).toContain('"<Box> in Page.brm:2:6"');
    const outside = compile(`${script}<div><Box /></div><p><b><Box /></b></p>`, {
      filename: 'Page.brm',
    }).server;
    expect(outside).toContain('"<Box> in Page.brm:2:25"');
    expect(outside).not.toContain('Page.brm:2:6"');
    const other = compile(`${script}<div><Box /></div><p><button><Box /></button></p>`, {
      filename: 'Page.brm',
    }).server;
    expect(other).not.toContain('<Box> in');
  });
});

const where = '<Transition> in Page.brm:3:6';
async function Block(): Promise<string> {
  return '<!--b--><div>x</div><!--/b-->';
}
async function Inline(): Promise<string> {
  return '<span>x</span>';
}
function page(Child: () => Promise<string>, hint: string | undefined) {
  return (_props: unknown, ctx: Context): Promise<string> =>
    component(Child, {}, ctx, undefined, undefined, hint).then((html) => `<p>T ${html}</p>`);
}

describe('a component whose element closes the <p>', () => {
  it('throws in development, with the component and the file', async () => {
    await expect(render(page(Block, where), {}, { dev: true })).rejects.toThrow(
      /<Transition> in Page\.brm:3:6 renders <div>.*\[BRM185\].*as="span"/,
    );
  });

  it('renders as before in production', async () => {
    const { html } = await render(page(Block, where), {});
    expect(html).toContain('<p>T <!--b--><div>x</div><!--/b--></p>');
  });

  it('is silent for an element that the <p> keeps, and for a component with no mark', async () => {
    const { html } = await render(page(Inline, where), {}, { dev: true });
    expect(html).toContain('<p>T <span>x</span></p>');
    await expect(render(page(Block, undefined), {}, { dev: true })).resolves.toBeDefined();
  });
});
