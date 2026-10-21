import { describe, expect, it } from 'vitest';
import { checkAccessibility } from '../src/a11y.ts';
import { compile, parse } from '../src/index.ts';

/** The tag that each warning points at, and the start of its message. */
function warnings(markup: string): string[] {
  const file = parse(markup, { filename: 'Test.brm' });
  return checkAccessibility(file).map(
    (warning) =>
      `${markup.slice(warning.range.start, warning.range.end)} ${warning.message.split('.')[0]}`,
  );
}

describe('accessibility warnings', () => {
  it('asks images for alt text', () => {
    expect(warnings('<img src="a.png"><img src="b.png" alt=""><img alt=label>')).toEqual([
      '<img An <img> needs alt text',
    ]);
  });

  it('asks click handlers on other elements for a role and a key handler', () => {
    expect(
      warnings(
        [
          '<div onClick=open>Open</div>',
          '<li role="button" tabindex="0" onClick=open>Open</li>',
          '<li role="button" tabindex="0" onClick=open onKeyDown=open>Open</li>',
          '<button onClick=open>Open</button>',
        ].join(''),
      ),
    ).toEqual([
      '<div A click handler on <div> works only with a pointer',
      '<li A click handler on <li> works only with a pointer',
    ]);
  });

  it('asks form fields for a label', () => {
    expect(
      warnings(
        [
          '<input placeholder="Name">',
          '<label>Name <input></label>',
          '<label for="email">Email</label><input id="email">',
          '<input aria-label="Search">',
          '<input type="hidden" name="id">',
          '<textarea></textarea>',
          '<select id=dynamic></select>',
        ].join(''),
      ),
    ).toEqual(['<input A <input> needs a label', '<textarea A <textarea> needs a label']);
  });

  it('asks links and buttons for text', () => {
    expect(
      warnings(
        [
          '<a href="/"></a>',
          '<a href="/"><img src="logo.png" alt=""></a>',
          '<a href="/"><img src="logo.png" alt="Home"></a>',
          '<a href="/">{label}</a>',
          '<a href="/" aria-label="Home"><svg></svg></a>',
          '<button><span aria-hidden="true">x</span></button>',
          '<button><Icon /></button>',
        ].join(''),
      ),
    ).toEqual([
      '<a A link needs text that says where it goes, or aria-label',
      '<a A link needs text that says where it goes, or aria-label',
      '<button A button needs text that says what it does, or aria-label',
    ]);
  });

  it('skips elements whose attributes are spread, and looks inside blocks', () => {
    expect(warnings('<img {...props}>#if (a) {<img src="x.png">}')).toEqual([
      '<img An <img> needs alt text',
    ]);
  });

  it('warns from compile, unless turned off', () => {
    const source = '<img src="a.png">';
    expect(compile(source).warnings.map((warning) => warning.message)).toHaveLength(1);
    expect(compile(source, { a11y: false }).warnings).toEqual([]);
  });
});
