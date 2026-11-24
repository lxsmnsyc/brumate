import { mkdirSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { compile } from '../../src/index.ts';
import { getFeatures } from '../../src/features.ts';
import { findError } from '../../src/error-catalog.ts';
import { render } from '../../src/runtime/server.ts';

const output = new URL('../.output/external-scripts/', import.meta.url);

/** The message that compiling a file gives, or undefined when it compiles. */
function failure(source: string): string | undefined {
  try {
    compile(source, { filename: 'Scripts.brm' });
  } catch (error) {
    return (error as Error).message;
  }
  return undefined;
}

describe('errors', () => {
  const cases: [string, string, string][] = [
    [
      'src with inline',
      '<script src="https://a.test/a.js" inline trigger="idle"></script>',
      'A <script> with src is not inline. Give it src or inline, not both',
    ],
    [
      'code in a script with src',
      '<script src="https://a.test/a.js" trigger="idle">window.a = 1;</script>',
      'A <script> with src has no code inside. Write the code in <script inline>',
    ],
    [
      'a trigger in braces',
      '<script src="https://a.test/a.js" trigger=(when)></script>',
      'The trigger of a <script> is a plain string: idle, visible, interaction or load',
    ],
    [
      'a trigger that does not exist',
      '<script src="https://a.test/a.js" trigger="later"></script>',
      'The trigger of a <script> is a plain string: idle, visible, interaction or load',
    ],
    [
      'a trigger without a value',
      '<script src="https://a.test/a.js" trigger></script>',
      'The trigger of a <script> is a plain string: idle, visible, interaction or load',
    ],
    [
      'visible in #head',
      '#head {\n  <script src="https://a.test/a.js" trigger="visible"></script>\n}',
      'A script in #head cannot wait to be visible, since no element follows it. Use idle or interaction',
    ],
    [
      'a trigger with data-rerun',
      '<script src="https://a.test/a.js" trigger="idle" data-rerun></script>',
      'A script with a trigger runs once per page, so data-rerun does not apply. Remove one of them',
    ],
  ];
  for (const [name, source, message] of cases) {
    it(`names the fix for ${name}`, () => {
      const text = failure(source);
      expect(text).toContain(message);
      expect(findError(text!)?.code).toMatch(/^BRM21\d$/);
    });
  }

  it('keeps the errors of the script of a component', () => {
    expect(failure('<div><script>let a = 1;</script></div>')).toContain(
      '<script> must be at the top level or at the start of a block',
    );
    expect(failure('<script trigger="idle"></script>')).toContain('Unknown <script> attribute');
  });
});

describe('compile', () => {
  const PAGE = `#head {
  <script src="https://a.test/idle.js" trigger="idle"></script>
  <script src="https://a.test/plain.js" async></script>
}
<script src="https://a.test/seen.js" trigger="visible" data-x="1"></script>
<script inline trigger="interaction">if (a < b) { window.x = "<div>"; }</script>
<script src="https://a.test/now.js"></script>
`;

  it('writes a template for a trigger and a script where HTML runs it as it is', () => {
    const { server } = compile(PAGE, { filename: 'Scripts.brm' });
    expect(server).toContain('<template src=\\"https://a.test/idle.js\\" b-script=\\"idle\\"');
    expect(server).toContain('<script src=\\"https://a.test/plain.js\\" async');
    expect(server).toContain(
      '<template src=\\"https://a.test/seen.js\\" data-x=\\"1\\" b-script=\\"visible\\"',
    );
    expect(server).toContain('<template b-script=\\"interaction\\"');
    // The code stays as written, in a script that the template keeps inert.
    expect(server).toContain('><script>if (a < b) { window.x = \\"<div>\\"; }</script></template>');
    // Outside `#head`, a script without a trigger runs at `load`.
    expect(server).toContain('<template src=\\"https://a.test/now.js\\" b-script=\\"load\\"');
    expect(server).not.toContain('trigger');
    expect(server).not.toContain('inline');
  });

  it('writes the template in the markup that the browser renders, also in #head', () => {
    const result = compile(PAGE, { filename: 'Scripts.brm' });
    const client = `${result.client}\n${result.render}`;
    expect(client).toContain('b-script=\\"load\\"');
    expect(client).toContain(
      '<template src=\\"https://a.test/plain.js\\" async b-script=\\"load\\"',
    );
    expect(client).not.toContain('nonce');
  });

  it('turns the scripts feature on only for a page that has a script', () => {
    expect(getFeatures(compile(PAGE, { filename: 'Scripts.brm' })).scripts).toBe(true);
    expect(getFeatures(compile('<p>Hello</p>', { filename: 'Plain.brm' })).scripts).toBe(false);
    // A shell that writes a script as a string is no script in markup.
    const shell = `<script>
  import { raw } from 'brumate/html';
</script>
{raw('<script type="module" src="/src/client.ts"></script>')}`;
    const shelled = compile(shell, { filename: 'Shell.brm' });
    expect(getFeatures(shelled).scripts).toBe(false);
    const script = '<script>\n  let a = 1;\n</script>\n<p>{a}</p>';
    const result = compile(script, { filename: 'Plain.brm' });
    expect(getFeatures(result).scripts).toBe(false);
    expect(result.server).not.toContain('b-script');
  });
});

describe('render', () => {
  const PAGE = `#head {
  <script src="https://a.test/idle.js" trigger="idle"></script>
  <script src="https://a.test/plain.js"></script>
  <script inline>window.plain = 1;</script>
}
<p>Page</p>
<script src=('https://a.test/' + 'seen.js') trigger="visible" crossorigin="anonymous"></script>
<script inline trigger="idle">window.count = (window.count || 0) + 1 < 2;</script>
`;

  beforeAll(() => {
    mkdirSync(output, { recursive: true });
    writeFileSync(new URL('Page.brm.ts', output), compile(PAGE, { filename: 'Page.brm' }).server);
  });

  // oxlint-disable-next-line typescript/no-explicit-any -- The compiled module is loaded at runtime.
  const load = (): Promise<any> => import(new URL('Page.brm.ts', output).href);

  it('gives the elements the nonce of the render', async () => {
    const module = await load();
    const request = new Request('http://localhost/');
    const result = await render(module.default, {}, { request, nonce: 'abc123' });
    expect(result.head).toContain(
      '<template src="https://a.test/idle.js" b-script="idle" nonce="abc123"></template>',
    );
    expect(result.head).toContain('<script src="https://a.test/plain.js" nonce="abc123"></script>');
    expect(result.head).toContain('<script nonce="abc123">window.plain = 1;</script>');
    expect(result.head).not.toMatch(/<script[^>]* src="https:\/\/a\.test\/idle\.js"/);
    expect(result.html).toContain(
      '<template src="https://a.test/seen.js" crossorigin="anonymous" b-script="visible" nonce="abc123"></template>',
    );
    expect(result.html).toContain(
      '<template b-script="idle" nonce="abc123"><script>window.count = (window.count || 0) + 1 &lt; 2;</script></template>'.replace(
        '&lt;',
        '<',
      ),
    );
  });

  it('writes no nonce when the render has none', async () => {
    const module = await load();
    const result = await render(module.default, {}, { request: new Request('http://localhost/') });
    expect(result.head).not.toContain('nonce');
    expect(result.html).not.toContain('nonce');
  });
});
