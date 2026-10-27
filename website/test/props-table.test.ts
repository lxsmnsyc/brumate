import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PART_FILES, SECTIONS, readProps, renderProps } from '../plugins/props-table.ts';

const fixture = (name: string): URL => new URL(`./fixtures/${name}.brm`, import.meta.url);

describe('readProps', () => {
  it('reads types, defaults and descriptions, with `as` first', () => {
    expect(readProps('Sample', fixture('Sample'))).toEqual([
      {
        name: 'as',
        type: 'AsTarget',
        default: "'section'",
        required: false,
        description:
          'Renders another element or a component. The other props are those of the target.',
      },
      {
        name: 'label',
        type: 'string | null',
        default: "'none'",
        required: false,
        description: 'The label. A `string` or `null`, on two lines.',
      },
      {
        name: 'mode',
        type: "'a' | 'b' | ((value: number) => void)",
        default: '',
        required: true,
        description: '',
      },
      { name: 'count', type: 'number', default: '2 + 1', required: false, description: '' },
      { name: 'children', type: 'unknown', default: '', required: false, description: '' },
    ]);
  });

  it('reads a part without `as` from its Props type', () => {
    expect(readProps('Plain', fixture('Plain'))).toEqual([
      {
        name: 'title',
        type: 'string',
        default: "''",
        required: false,
        description: 'The <title> & more.',
      },
    ]);
  });

  it('fails for a part with no exported type', () => {
    expect(() => readProps('Missing', fixture('Plain'))).toThrow(/Missing: no exported/);
  });

  it('matches ButtonOwnProps', () => {
    const rows = readProps('Button');
    const source = readFileSync(new URL('Button.brm', PART_FILES), 'utf8');
    const block = /export interface ButtonOwnProps[^{]*\{([\s\S]*?)\n  \}/.exec(source)![1]!;
    // The names at the top level of the interface, found without the parser.
    const names = [...block.matchAll(/^ {4}(\w+)\??:/gm)].map((match) => match[1]);
    expect(rows.map((row) => row.name)).toEqual(['as', ...names]);
    const by = Object.fromEntries(rows.map((row) => [row.name, row]));
    expect(by.as).toMatchObject({ type: 'AsTarget', default: "'button'" });
    expect(by.type).toMatchObject({
      type: "'button' | 'submit' | 'reset'",
      default: "'button'",
    });
    expect(by.isPending!.description).toMatch(/^Pending: the button keeps its focus/);
    expect(by.onPress).toMatchObject({ type: '(event: PressEvent) => void', required: false });
  });

  it('never lists the props of the target', () => {
    const names = readProps('Button').map((row) => row.name);
    expect(names).not.toContain('className');
    expect(names).not.toContain('[attribute: string]');
  });
});

describe('renderProps', () => {
  it('escapes the cells and marks code and required props', () => {
    const html = renderProps([
      {
        name: 'a',
        type: 'Map<string, X>',
        default: '',
        required: true,
        description: 'Use `x` <b>',
      },
      { name: 'b', type: 'number', default: '1', required: false, description: '' },
    ]);
    expect(html).toContain('<code>Map&lt;string, X&gt;</code>');
    expect(html).toContain('<td><em>required</em></td>');
    expect(html).toContain('Use <code>x</code> &lt;b&gt;');
    expect(html).toContain('<td><code>1</code></td>');
  });
});

describe('the button page', () => {
  const page = readFileSync(new URL('../ui/button.md', import.meta.url), 'utf8');

  it('shows the props table of Button', () => {
    expect(page).toMatch(/^```props Button\n*```$/m);
  });

  it('keeps the order of the sections', () => {
    const headings = [...page.matchAll(/^## (.+)$/gm)].map((match) => match[1]!);
    const known = headings.filter((heading) => SECTIONS.includes(heading));
    expect(known).toEqual(SECTIONS.filter((section) => known.includes(section)));
    expect(known).toContain('Props');
  });
});
