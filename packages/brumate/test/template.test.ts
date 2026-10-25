// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { clonedTemplate } from '../src/codegen/template.ts';
import { clone, init, template } from '../src/runtime/client.ts';

// The cloned templates of markup that the browser renders: which renders get one, and what the
// browser finds in a clone.

const row = [
  { static: '<tr' },
  { code: "$$b.attribute(\"class\", (row.done ? 'done' : ''))" },
  { static: ' b-b="' },
  { code: '$$s2' },
  { static: ':0"><td title="a > b" b-b="' },
  { code: '$$s2' },
  { static: ':1">' },
  { code: '$$b.insert((row.label))' },
  { static: '</td><td><a b-on="click=App#h3">x</a></td></tr>' },
];

it('marks the elements that a render writes, with their attributes, anchors and content', () => {
  const found = clonedTemplate(row)!;
  expect(found.html).toBe(
    '<tr b-x="0"><td b-x="1" title="a > b"></td><td><a b-on="click=App#h3">x</a></td></tr>',
  );
  expect(found.writes).toEqual([
    [
      { kind: 'attribute', name: '"class"', value: "(row.done ? 'done' : '')" },
      { kind: 'anchor', scope: '$$s2', anchor: 0 },
    ],
    [
      { kind: 'anchor', scope: '$$s2', anchor: 1 },
      { kind: 'content', value: '(row.label)' },
    ],
  ]);
});

it('puts a comment for a text insert between static text, and none at the end of an element', () => {
  const found = clonedTemplate([
    { static: '<p>Hello <!--t' },
    { code: '$$s2' },
    { static: ':0-->' },
    { code: '$$b.insert((name))' },
    { static: '<!--/t-->, and <!--t' },
    { code: '$$s2' },
    { static: ':1-->' },
    { code: '$$b.insert((other))' },
    { static: '<!--/t--></p>' },
  ])!;
  expect(found.html).toBe('<p b-x="1">Hello <!--x0-->, and </p>');
  expect(found.writes).toEqual([
    [{ kind: 'text', scope: '$$s2', anchor: 0, value: '(name)' }],
    [{ kind: 'last', scope: '$$s2', anchor: 1, value: '(other)' }],
  ]);
});

it('marks the start of a nested block with nothing in it, which a call fills', () => {
  const found = clonedTemplate([
    { static: '<ul><!--b' },
    { code: '$$s2' },
    { static: ':0--><!--/b--></ul><!--b' },
    { code: '$$s2' },
    { static: ':1:-1--><!--/b-->' },
  ])!;
  expect(found.html).toBe('<ul><!--x0--><!--/b--></ul><!--x1--><!--/b-->');
  expect(found.writes).toEqual([
    [{ kind: 'block', scope: '$$s2', anchor: 0 }],
    [{ kind: 'block', scope: '$$s2', anchor: 1 }],
  ]);
});

it('gives an insert that can hold children the scope where it renders', () => {
  const found = clonedTemplate([
    { static: '<div b-b="' },
    { code: '$$s2' },
    { static: ':0">' },
    { code: '$$b.insert((children), undefined, $$p)' },
    { static: '</div>' },
  ])!;
  expect(found.writes).toEqual([
    [
      { kind: 'anchor', scope: '$$s2', anchor: 0 },
      { kind: 'content', value: '(children)', at: '$$p' },
    ],
  ]);
});

it('renders a child component in the place of a comment', () => {
  const found = clonedTemplate([
    { static: '<div>' },
    { code: '$$b.component(Badge, { "label": (name) }, undefined, $$s2, 0)' },
    { static: '</div>' },
  ])!;
  expect(found.html).toBe('<div><!--x0--></div>');
  expect(found.writes).toEqual([
    [
      {
        kind: 'component',
        call: '$$b.componentNodes(Badge, { "label": (name) }, undefined, $$s2, 0)',
      },
    ],
  ]);
});

it('marks the start of a block whose markup is in the template', () => {
  const found = clonedTemplate([
    { static: '<ul><!--b' },
    { code: '$$s2' },
    { static: ':0:1--><li>a</li><!--/b--></ul>' },
  ])!;
  expect(found.html).toBe('<ul><!--x0--><li>a</li><!--/b--></ul>');
  expect(found.writes).toEqual([[{ kind: 'marker', scope: '$$s2', anchor: 0, suffix: ':1' }]]);
});

it('builds the element of a dynamic tag in the place of a comment', () => {
  const found = clonedTemplate([
    { static: '<div>' },
    { code: '$$b.dynamic((tag), {}, undefined, undefined, $$s2)' },
    { static: '</div>' },
  ])!;
  expect(found.html).toBe('<div><!--x0--></div>');
  expect(found.writes).toEqual([
    [{ kind: 'component', call: '$$b.dynamicNodes((tag), {}, undefined, undefined, $$s2)' }],
  ]);
});

it('puts an insert with no markers, names comments, and writes attributes that code gives', () => {
  const found = clonedTemplate([
    { static: '<!--i' },
    { code: '$$p.id' },
    { static: '--><li' },
    { code: '((done) ? " class=\\"done\\"" : "")' },
    { code: '$$b.action("action", "A#save", "method")' },
    { static: ' b-v="' },
    { code: '$$s2' },
    { static: '">' },
    { code: '$$b.insert((name))' },
    { static: ' and ' },
    { code: '$$b.insert((children), undefined, $$s2)' },
    { static: '</li>' },
  ])!;
  expect(found.html).toBe('<!--x0--><li b-x="1"><!--x2--> and <!--x3--></li>');
  expect(found.writes).toEqual([
    [{ kind: 'comment', data: '"i" + $$p.id' }],
    [
      { kind: 'call', call: '(done) && $$m.setAttribute("class", "done")' },
      { kind: 'call', call: '$$b.setAttrText($$m, $$b.action("action", "A#save", "method"))' },
      { kind: 'attribute', name: '"b-v"', value: '$$s2' },
    ],
    [{ kind: 'put', value: '(name)' }],
    [{ kind: 'put', value: '(children)', at: '$$s2' }],
  ]);
});

it('writes the text of a <textarea>, and attributes with static text and code in quotes', () => {
  const found = clonedTemplate([
    { static: '<textarea class="field' },
    { code: '((wide) ? " wide" : "")' },
    { static: '" b-b="' },
    { code: '$$s2' },
    { static: ':0">' },
    { code: '$$b.insert((text))' },
    { static: '</textarea><ul><!--i' },
    { code: '$$s3' },
    { static: '--><li>a</li><!--/i--></ul>' },
  ])!;
  expect(found.html).toBe('<textarea b-x="0"></textarea><ul><!--x1--><li>a</li><!--/i--></ul>');
  expect(found.writes[0]).toEqual([
    { kind: 'call', call: '$$b.setAttrText($$m, " class=\\"field" + (((wide) ? " wide" : "")) + "\\"")' },
    { kind: 'anchor', scope: '$$s2', anchor: 0 },
    { kind: 'content', value: '(text)', at: undefined },
  ]);
});

it('renders HTML for markers, raw text, blocks of the loader, and other code', () => {
  // The loader starts each <template> of a block once.
  expect(
    clonedTemplate([
      { static: '<template b-b="' },
      { code: '$$s2' },
      { static: ':0" b-client="load=App#k3"></template>' },
    ]),
  ).toBeUndefined();
  // Code that is not one of the writes.
  expect(clonedTemplate([{ static: '<p>' }, { code: 'await Child($$props)' }])).toBeUndefined();
});

it('clones markup with nothing to write', () => {
  expect(clonedTemplate([{ static: '<p>Hi</p>' }])).toEqual({ html: '<p>Hi</p>', writes: [] });
});

// The browser adds a <tbody>, which happy-dom does not. The paths come from the parsed template
// either way, so they follow what the parser did.
it('finds the marked elements in the parsed template, and removes their marks', () => {
  init({ load: () => undefined, listen: () => {} });
  const table = template('<table><tr><td b-x="0"></td><td>b</td><td b-x="1"></td></tr></table>', 2);
  const [fragment, elements] = clone(table);
  expect(elements.map((element) => element.tagName)).toEqual(['TD', 'TD']);
  expect(elements[1]!.previousElementSibling!.textContent).toBe('b');
  expect(fragment.querySelector('[b-x]')).toBeNull();
  // A second clone reads the same paths.
  const [, again] = clone(table);
  expect(again[0]).not.toBe(elements[0]);
  expect(again.map((element) => element.tagName)).toEqual(['TD', 'TD']);
});
