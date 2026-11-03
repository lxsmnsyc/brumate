import { describe, expect, it } from 'vitest';
import { parse } from '../src/index.ts';

function error(source: string): string {
  try {
    parse(source, { filename: 'Test.brm' });
  } catch (caught) {
    // The code of the catalog entry sits before the place. The tests name the message.
    return (caught as Error).message.replace(/ \[BRM\d+\]/, '');
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
    ['#if (a) x', 'Expected "{" or one markup child after #if (Test.brm:1:9)'],
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
      '<Item onKeyDown:prevent=go />',
      'Modifiers apply to elements. Put ":prevent" on the element that the component renders (Test.brm:1:7)',
    ],
    [
      '<input onKeydown=go />',
      '"onKeydown" is not an event name. Write "onKeyDown" (Test.brm:1:8)',
    ],
    [
      '<input {onFocusout} />',
      '"onFocusout" is not an event name. Write "onFocusOut" (Test.brm:1:8)',
    ],
    [
      '<window onHashchange=go />',
      '"onHashchange" is not an event name. Write "onHashChange" (Test.brm:1:9)',
    ],
    [
      '<document onVisibilitychange=go />',
      '"onVisibilitychange" is not an event name. Write "onVisibilityChange" (Test.brm:1:11)',
    ],
    [
      '<window onPointerdown=go />',
      '"onPointerdown" is not an event name. Write "onPointerDown" (Test.brm:1:9)',
    ],
    [
      '<button onClick="go()">x</button>',
      'An event handler must be an expression, not a string (Test.brm:1:9)',
    ],
    [
      '<p icon=<Icon />>x</p>',
      'Markup is not allowed in attribute values. Use a #template. (Test.brm:1:9)',
    ],
    ['<p ref=(a)>x</p>', 'ref takes $bind, as in ref=$bind(name) (Test.brm:1:8)'],
    [
      '<p prefetch="idle">x</p>',
      'prefetch is removed. The code of the page loads when it starts (Test.brm:1:4)',
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

describe('#reveal', () => {
  const reveal = (source: string) => parse(source, { filename: 'Test.brm' }).children[0];

  it('parses the order and collapsed, with sequential by default', () => {
    expect(reveal("#reveal ('together') {\n  <p>One</p>\n}")).toMatchObject({
      kind: 'fragment',
      reveal: { order: 'together', collapsed: false },
      children: [{ kind: 'element' }],
    });
    expect(reveal('#reveal (collapsed) {}')).toMatchObject({
      reveal: { order: 'sequential', collapsed: true },
    });
    expect(reveal('#reveal {}')).toMatchObject({
      reveal: { order: 'sequential', collapsed: false },
    });
  });

  it('refuses another order, and collapsed with an order other than sequential', () => {
    expect(() => reveal("#reveal ('random') {}")).toThrow('#reveal takes an order');
    expect(() => reveal("#reveal ('together', collapsed) {}")).toThrow(
      "it needs the order 'sequential', not 'together'",
    );
    expect(() => reveal('#reveal {\n  <script>let a = 1;</script>\n}')).toThrow(
      '#reveal has no script of its own',
    );
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
    let actual: string | undefined;
    if (value && 'value' in value && value.value !== true && typeof value.value !== 'string') {
      actual = value.value.code;
    } else if (value && 'handler' in value) {
      actual = value.handler.code;
    }
    expect(actual).toBe(code);
  });
});

describe('block bodies without braces', () => {
  /** The body of the first block, as the printed kinds of its children. */
  function kinds(source: string): string[] {
    const block = parse(source).children[0];
    if (block?.kind !== 'if' && block?.kind !== 'for') {
      throw new Error('Expected a block');
    }
    const body = block.kind === 'if' ? block.branches[0]!.body : block.body;
    return body.children.map((child) => child.kind);
  }

  it.each([
    ['#if (a) <p>x</p>', ['element']],
    ['#if (a) <Row />', ['component']],
    ['#if (a) <{tag}>x</>', ['key']],
    ['#if (a) <>x</>', ['fragment']],
    ['#if (a) #if (b) <p />', ['if']],
    ['#for (item of items by item) <li />', ['element']],
  ])('%s has one child', (source, expected) => {
    expect(kinds(source)).toEqual(expected);
  });

  it.each([
    '#if (a) <p /> #else if (b) <q /> #else <r />',
    '#for (a of b) <p /> #else <q />',
    '#repeat (3) <p /> #else <q />',
    '#switch { #case (1) <p /> #case (2) <q /> #default <r /> }',
    '#key (a) <p />',
    '#try <A /> #catch (error, reset) <B {error} {reset} />',
    '#try <A /> #catch <B />',
    '#loading (a) <A /> #else <B />',
    '#portal (a) <A />',
    '#head <title>x</title>',
    '#client ("visible") <A /> #else <B />',
    '#defer ("visible") <A /> #else <B />',
    '#offscreen (a) <A />',
    '#reveal <A />',
  ])('%s parses', (source) => {
    expect(() => parse(source)).not.toThrow();
  });

  it('gives the else to the nearest if', () => {
    const outer = parse('#if (a) #if (b) <p /> #else <q />').children[0];
    if (outer?.kind !== 'if') {
      throw new Error('Expected an if');
    }
    expect(outer.fallback).toBeUndefined();
    const inner = outer.branches[0]!.body.children[0];
    expect(inner?.kind === 'if' && inner.fallback?.children[0]?.kind).toBe('element');
  });

  it('keeps `{` as the start of a braced body with text', () => {
    const block = parse('#if (x) {name}').children[0];
    if (block?.kind !== 'if') {
      throw new Error('Expected an if');
    }
    expect(block.branches[0]!.body.children).toMatchObject([{ kind: 'text', value: 'name' }]);
  });

  it.each([
    ['#if (a) x', 'Test.brm:1:9'],
    ['#if (a) <script>let a = 1;</script>', 'Test.brm:1:9'],
    ['#if (a) <style>p {}</style>', 'Test.brm:1:9'],
    ['#if (a) #template Row() { <p /> }', 'Test.brm:1:9'],
    ['#if (a) </p>', 'Test.brm:1:9'],
    ['#try <A /> #catch (e) x', 'Test.brm:1:23'],
  ])('rejects %s', (source, place) => {
    expect(() => parse(source, { filename: 'Test.brm' })).toThrow(
      new RegExp(`^Expected "\\{" or one markup child after #\\w+ \\[BRM044\\] \\(${place}\\)`),
    );
  });

  it('takes one child only', () => {
    const file = parse('#if (a) <p /> <q />');
    expect(file.children.map((child) => child.kind)).toEqual(['if', 'text', 'element']);
  });
});

describe('block bodies without braces, else and text', () => {
  /** The kinds of a block's own else body, or undefined. */
  function elseOf(source: string): string | undefined {
    const block = parse(source, { filename: 'Test.brm' }).children[0] as {
      fallback?: { children: { kind: string }[] };
    };
    return block.fallback?.children[0]?.kind;
  }

  it.each([
    '#for (a of b) #if (c) <p /> #else <q />',
    '#loading #if (c) <p /> #else <q />',
    "#client ('visible') #if (c) <p /> #else <q />",
    "#defer ('visible') #if (c) <p /> #else <q />",
  ])('%s gives the else to the inner block', (source) => {
    const block = parse(source, { filename: 'Test.brm' }).children[0] as {
      fallback?: unknown;
      body?: { children: { kind: string; fallback?: unknown }[] };
    };
    expect(block.fallback).toBeUndefined();
    expect(block.body?.children[0]?.kind).toBe('if');
    expect(block.body?.children[0]?.fallback).toBeDefined();
  });

  it.each([
    ['#for (a of b) <p /> #else <q />', 'element'],
    ['#loading <p /> #else <q />', 'element'],
    ["#client ('visible') <p /> #else <q />", 'element'],
    ["#defer ('visible') <p /> #else <q />", 'element'],
  ])('%s has its own else', (source, kind) => {
    expect(elseOf(source)).toBe(kind);
  });

  it('rejects an else after a #catch body', () => {
    expect(() => parse('#try <p /> #catch <q /> #else <r />', { filename: 'Test.brm' })).toThrow(
      /BRM013/,
    );
  });

  it('gives the else to the outer block with braces', () => {
    const outer = parse('#if (a) { #if (b) <p /> } #else <q />').children[0];
    if (outer?.kind !== 'if') {
      throw new Error('Expected an if');
    }
    expect(outer.fallback?.children[0]?.kind).toBe('element');
    const inner = outer.branches[0]!.body.children[0];
    expect(inner?.kind === 'if' && inner.fallback).toBeUndefined();
  });

  it('holds a short #if in a #switch case', () => {
    const block = parse('#switch { #case (1) #if (a) <p /> #else <q /> #default <r /> }')
      .children[0];
    if (block?.kind !== 'switch') {
      throw new Error('Expected a switch');
    }
    const inner = block.cases[0]!.body.children[0];
    expect(inner?.kind === 'if' && inner.fallback).toBeDefined();
    expect(block.fallback?.children[0]?.kind).toBe('element');
  });

  it("keeps `use {'#if'} <b>x</b>` as text", () => {
    const kinds = parse("use {'#if'} <b>x</b>").children.map((child) => child.kind);
    expect(kinds).toEqual(['text', 'insert', 'text', 'element']);
  });

  it('does not take a comment as the child', () => {
    expect(() => parse('#if (a) <!-- c --> <p />', { filename: 'Test.brm' })).toThrow(/BRM044/);
  });
});
