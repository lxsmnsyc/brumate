import { describe, expect, it } from 'vitest';
import { parse } from '../src/index.ts';

function error(source: string): string {
  try {
    parse(source, { filename: 'Test.brm' });
  } catch (caught) {
    return (caught as Error).message;
  }
  throw new Error('Expected a syntax error');
}

describe('syntax errors', () => {
  it.each([
    ['<p disabled=a+b>x</p>', 'Wrap this attribute value in parentheses (Test.brm:1:13)'],
    ['<a title="a"href="b">x</a>', 'Expected whitespace between attributes (Test.brm:1:13)'],
    ['<div>', 'Unexpected end of file, expected a closing tag (Test.brm:1:6)'],
    ['<div></span>', 'Expected </div> (Test.brm:1:6)'],
    ['<p {a + b}>x</p>', 'Expected a spread or a shorthand attribute (Test.brm:1:4)'],
    ['#if () { x }', 'Expected an expression after #if (Test.brm:1:6)'],
    ['#if (a) x', 'Expected "{" after #if (Test.brm:1:9)'],
    ['#else { x }', '#else must follow its block (Test.brm:1:1)'],
    [
      '#for (item in list) { x }',
      'Expected "item of list" or "item, index of list" after #for (Test.brm:1:7)',
    ],
    ['#try { x }', '#try needs a #catch block (Test.brm:1:11)'],
    [
      '#switch { #default { a } #case (b) { c } }',
      '#default must be the last branch of #switch (Test.brm:1:26)',
    ],
    ['#switch { <p>x</p> }', 'Only #case and #default are allowed in #switch (Test.brm:1:11)'],
    [
      '#client (soon) { x }',
      'The trigger of #client must be "visible", "idle" or "load" (Test.brm:1:10)',
    ],
    ['#offscreen { x }', 'Expected "(" after #offscreen (Test.brm:1:12)'],
    ['#offscreen () { x }', 'Expected an expression after #offscreen (Test.brm:1:13)'],
    [
      '<p>#defer (later) { x }</p>',
      'The trigger of #defer must be "visible", "idle" or "load" (Test.brm:1:12)',
    ],
    ['<button onClick:later=go>x</button>', 'Unknown event modifier ":later" (Test.brm:1:9)'],
    [
      '<button onClick:prevent(Enter)=go>x</button>',
      'Only :prevent of a keyboard event takes keys, such as onKeyDown:prevent(ArrowDown Enter) (Test.brm:1:9)',
    ],
    [
      '<input onKeyDown:stop(Enter)=go>',
      'Only :prevent of a keyboard event takes keys, such as onKeyDown:prevent(ArrowDown Enter) (Test.brm:1:8)',
    ],
    [
      '<input onKeyDown:prevent(Enter =)=go>',
      'Name keys by their event.key, with letters and digits, such as ArrowDown or Space, not "=" (Test.brm:1:8)',
    ],
    [
      '<Item onKeyDown:prevent(Enter)=go />',
      'Modifiers apply to elements. Put ":prevent" on the element that the component renders (Test.brm:1:7)',
    ],
    [
      '<input onKeyDown:prevent()=go>',
      'Name keys by their event.key, with letters and digits, such as ArrowDown or Space (Test.brm:1:8)',
    ],
    [
      '<button onClick="go()">x</button>',
      'An event handler must be an expression, not a string (Test.brm:1:9)',
    ],
    [
      '<p icon=<Icon />>x</p>',
      'Markup is not allowed in attribute values. Use a #template. (Test.brm:1:9)',
    ],
    ['<p ref=(a)>x</p>', 'Expected the name of a signal after "ref=" (Test.brm:1:8)'],
    [
      '<p prefetch="soon">x</p>',
      'prefetch must be "hover", "visible", "idle" or "none" (Test.brm:1:4)',
    ],
    ['<window onKeyDown=close>', '<window> must end with "/>" (Test.brm:1:24)'],
    ['<window class="a" />', 'Only event handlers are allowed here (Test.brm:1:9)'],
    [
      '<div><script>let a = 1;</script></div>',
      '<script> must be at the top level or at the start of a block (Test.brm:1:6)',
    ],
    [
      '<script>let a = 1;</script><script>let b = 1;</script>',
      'A file can have one <script> (Test.brm:1:28)',
    ],
    ['<p>{}</p>', 'Expected an expression (Test.brm:1:5)'],
  ])('%s', (source, message) => {
    expect(error(source)).toBe(message);
  });
});

describe('#offscreen', () => {
  it('parses the expression and the body', () => {
    const file = parse('#offscreen (tab === 1) {\n  <p>One</p>\n  Text\n}', {
      filename: 'Test.brm',
    });
    const [block] = file.children;
    expect(block?.kind).toBe('offscreen');
    if (block?.kind !== 'offscreen') {
      return;
    }
    expect(block.visible.code).toBe('tab === 1');
    expect(block.body.children.map((child) => child.kind)).toEqual(['element', 'text']);
    expect(block.end).toBe(file.source.length);
  });

  it('keeps #offscreen and #defer as text without a header or a body', () => {
    const file = parse('<p>#offscreen and #defer</p>', { filename: 'Test.brm' });
    const [paragraph] = file.children;
    expect(paragraph?.kind === 'element' && paragraph.children[0]).toMatchObject({
      kind: 'text',
      value: '#offscreen and #defer',
    });
  });
});

describe('text', () => {
  it('keeps # that does not start a block', () => {
    const file = parse('<p>C# and #hashtag and #if without parentheses</p>');
    const paragraph = file.children[0];
    expect(paragraph?.kind === 'element' && paragraph.children).toEqual([
      { kind: 'text', start: 3, end: 46, value: 'C# and #hashtag and #if without parentheses' },
    ]);
  });

  it('drops whitespace-only text across lines', () => {
    const file = parse('<ul>\n  <li>a</li>\n</ul>');
    const list = file.children[0];
    expect(list?.kind === 'element' && list.children.map((child) => child.kind)).toEqual([
      'element',
    ]);
  });
});

describe('attribute values', () => {
  it.each([
    ['onClick=increment', 'increment'],
    ['value=props.label', 'props.label'],
    ['label=items[0]?.name', 'items[0]?.name'],
    ['disabled=!valid', '!valid'],
    ['tabIndex=0', '0'],
    ['href=(base + path)', 'base + path'],
    ['id=`item-${id}`', '`item-${id}`'],
    ['items=[1, 2]', '[1, 2]'],
    ['pattern=/a+/g', '/a+/g'],
    ['style={ color: "red" }', '{ color: "red" }'],
    ['onClick=select(item, 1)', 'select(item, 1)'],
  ])('%s', (attribute, code) => {
    const file = parse(`<p ${attribute}>x</p>`);
    const element = file.children[0];
    if (element?.kind !== 'element') {
      throw new Error('Expected an element');
    }
    const value = element.attributes[0];
    expect(
      value && 'value' in value && value.value !== true && typeof value.value !== 'string'
        ? value.value.code
        : value && 'handler' in value
          ? value.handler.code
          : undefined,
    ).toBe(code);
  });
});
