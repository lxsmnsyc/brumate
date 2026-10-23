import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MERGE, minifiedSize } from '../src/codegen/client.ts';
import { classText, decodeAttribute, literalClasses } from '../src/codegen/markup.ts';
import { compile, inspect } from '../src/index.ts';
import { parseExpression } from '../src/oxc.ts';
import { classValue } from '../src/runtime/html.ts';

/** The client parts of a component whose handler calls `f`, declared as given. */
function parts(declaration: string): string {
  const { parts: modules } = compile(
    `<script>\n  import { $signal } from 'brumate/signals';\n  let s = $signal('a');\n  ${declaration}\n</script>\n<button onClick=(() => (s = s + f(s)))>{s}</button>`,
    { filename: 'T.brm' },
  );
  return Object.values(modules).join('\n');
}

describe('client functions', () => {
  it.each([
    ['an arrow with parentheses', 'const f = (n) => n.length;', 'const f$ = ($$s, n) =>'],
    [
      'an arrow with types',
      'const f = (n: string): number => n.length;',
      'const f$ = ($$s, n: string): number =>',
    ],
    ['an arrow without parentheses', 'const f = n => n.length;', 'const f$ = ($$s, n) =>'],
    [
      'an async arrow',
      'const f = async (n: string) => n.length;',
      'const f$ = async ($$s, n: string) =>',
    ],
    ['a function', 'function f(n: string) { return n.length; }', 'function f$($$s, n: string)'],
    ['a function without parameters', 'function f() { return 1; }', 'function f$($$s)'],
  ])('takes the scope before the parameters of %s', (_, declaration, expected) => {
    const code = parts(declaration);
    expect(code).toContain(expected);
    expect(parseSync('part.ts', code).errors).toEqual([]);
  });
});

describe('$untrack', () => {
  it('reads through a called function without depending on what it reads', () => {
    const { report } = inspect(
      [
        '<script>',
        "  import { $effect, $signal, $untrack } from 'brumate/signals';",
        '  let query = $signal(0);',
        '  let runs = $signal(0);',
        '  function run() {',
        '    runs++;',
        '  }',
        '  $effect(() => {',
        '    void query;',
        '    $untrack(run());',
        '  });',
        '  $effect(() => {',
        '    run();',
        '  });',
        '</script>',
        '<button onClick=(() => query++)>{query}</button>',
      ].join('\n'),
      { filename: 'T.brm' },
    );
    const effects = report.changes.filter((change) => change.label === 'effect');
    expect(effects.map((effect) => effect.reason)).toEqual([
      'reads signal query',
      'reads signal runs',
    ]);
  });
});

describe('hidden server function names', () => {
  it('uses the same hashed ID in the server table, the client stubs and forms', () => {
    const source = `<script>
  import { $action, $memo } from 'brumate/signals';
  import { getEvent } from 'brumate/server';

  async function listSecretThings() {
    'use server';
    return [1];
  }

  async function deleteEverything(form: FormData) {
    'use server';
    getEvent().refresh(listSecretThings);
    return String(form.get('x'));
  }

  const result = $action(deleteEverything);
  const things = $memo(listSecretThings());
</script>

<form action=deleteEverything><button>Go</button></form>
<button onClick=(() => deleteEverything(new FormData()))>Now</button>
<p>{things.length} {result}</p>
`;
    const shown = compile(source, { filename: 'Secret.brm' });
    const hidden = compile(source, { filename: 'Secret.brm', hideNames: true });
    expect(shown.server).toContain('#deleteEverything');
    const browser = [hidden.client, ...Object.values(hidden.parts), hidden.render].join('\n');
    expect(browser).not.toMatch(
      /listSecretThings"|deleteEverything"|#listSecretThings|#deleteEverything/,
    );
    const ids = [...hidden.server.matchAll(/"(Secret_\w+#f\w+)": (\w+)/g)].map((match) => match[1]);
    expect(ids).toHaveLength(2);
    // The browser calls and refreshes the functions by the IDs of the server table.
    for (const id of ids) {
      expect(browser).toContain(JSON.stringify(id));
    }
  });
});

describe('functions of a use server file', () => {
  it('loads memos that call one again when a server function refreshes it', () => {
    const source = `<script>
  import { $memo } from 'brumate/signals';
  import { listNotes } from './notes.ts';
  import { format } from './format.ts';

  const notes = $memo(listNotes());
  const label = $memo(format(1));
</script>

<p>{notes.length} {label}</p>
`;
    const { client } = compile(source, {
      filename: 'Notes.brm',
      serverImport: (specifier, name) =>
        specifier === './notes.ts' ? `notes_1#${name}` : undefined,
    });
    expect(client).toMatch(/export const refresh = \{ "notes_1#listNotes": \[\[1, "m\d+"\]\] \};/);
  });
});

/** A component with a signal that an update reads, one that none reads, and a local function. */
const counterSource = (handlers: string): string =>
  `<script>\n  import { $signal } from 'brumate/signals';\n  let count = $signal(0);\n  let hidden = $signal(0);\n  function bump(by: number) {\n    count += by;\n  }\n</script>\n${handlers}\n<p>{count}</p>`;

/** A step of a generated handler, about 75 bytes after minifying. */
const step = (index: number): string =>
  `  arr = arr.map((v, i) => (v * ${index + 3} + i) % ${index + 97}).filter((v) => v % ${index + 5} !== 1);`;

/** A component with `count` handlers of about 1.2 kB each, after minifying. */
const widgetSource = (count: number): string => {
  const handlers = Array.from({ length: count }, (_, index) =>
    [
      `<button onClick=(() => {`,
      '  let arr = [...items];',
      ...Array.from({ length: 16 }, (__, line) => step(index * 16 + line)),
      `  items = arr;`,
      '})>Run</button>',
    ].join('\n'),
  );
  return [
    '<script>',
    "  import { $signal } from 'brumate/signals';",
    '  let items = $signal([1, 2, 3]);',
    '</script>',
    '#for (value, index of items by index) {',
    '  <li>{value}</li>',
    '}',
    ...handlers,
  ].join('\n');
};

/** The estimated minified size of the parts of a component, as `merge` counts it. */
const partsSize = (source: string): number =>
  Object.values(compile(source, { filename: 'T.brm' }).parts).reduce(
    (total, code) => total + minifiedSize(code),
    0,
  );

describe('client entries and handlers', () => {
  it('passes the scope to calls of local functions, and exports a named handler as it is', () => {
    const { parts: modules } = compile(
      counterSource('<button onClick=bump>A</button><button onClick=(() => bump(2))>B</button>'),
      { filename: 'T.brm' },
    );
    const code = Object.values(modules).join('\n');
    expect(code).toMatch(/export \{ bump\$ as h\d+ \};/);
    expect(code).toContain('bump$($$s, 2)');
    expect(code).not.toContain('.bind(');
  });

  it('starts loading the updates with a handler that writes a slot that they read', () => {
    const { client } = compile(
      counterSource(
        '<button onClick=(() => bump(1))>A</button><button onClick=(() => hidden++)>B</button>',
      ),
      { filename: 'T.brm' },
    );
    expect(client).toMatch(/"h\d+": \(\) => \(update\(\)\.catch\(\(\) => \{\}\), import\(/);
    // `hidden` has no update, so its handler loads its own part only.
    expect(client).toMatch(/"h\d+": \(\) => import\("\.\/T\.brm\?brumate-client&part=h\d+"\),/);
  });

  it('puts the code of a small component into its entry', () => {
    const {
      client,
      parts: modules,
      clientCode,
    } = compile(counterSource('<button onClick=bump>A</button>'), {
      filename: 'T.brm',
      merge: 2048,
    });
    expect(modules).toEqual({});
    expect(clientCode).toBe(true);
    expect(client).toMatch(/export \{ bump\$ as h\d+ \};/);
    expect(client).not.toContain('export function load');
  });

  it('merges a component of a few kB with the default of the Vite plugin', () => {
    // Two handlers and the updates: as large as a dashboard widget, so one module.
    expect(partsSize(widgetSource(2))).toBeGreaterThan(2048);
    const small = compile(widgetSource(2), { filename: 'T.brm', merge: DEFAULT_MERGE });
    expect(small.parts).toEqual({});
    expect(small.client).not.toContain('export function load');
    expect(Object.keys(small.loaders)).toHaveLength(3);
    // Eight handlers keep one module per part, so an event loads only its own.
    expect(partsSize(widgetSource(8))).toBeGreaterThan(DEFAULT_MERGE);
    const large = compile(widgetSource(8), { filename: 'T.brm', merge: DEFAULT_MERGE });
    expect(Object.keys(large.parts)).toHaveLength(9);
    expect(large.client).toContain('export function load');
  });
});

describe('compact markup', () => {
  const { server } = compile(
    [
      '<script>',
      "  import { $signal } from 'brumate/signals';",
      "  import Card from './Card.brm';",
      '  let on = $signal(false);',
      "  let tag = $signal('section');",
      '</script>',
      '<div class={ active: on }>',
      '  <span><button class="nested" onClick=(() => (on = !on))>A</button></span>',
      '  <Card><button class="child" onClick=(() => (on = !on))>B</button></Card>',
      '  #if (on) {',
      '    <button class="block" onClick=(() => (on = !on))>C</button>',
      '  }',
      '  #portal {',
      '    <button class="portal" onClick=(() => (on = !on))>D</button>',
      '  }',
      '  <{tag}><button class="dynamic" onClick=(() => (on = !on))>E</button></>',
      '  <textarea>{String(on)}</textarea>',
      '  <p class="spaced"> {String(on)} </p>',
      '  <p class="only">{String(on)}</p>',
      '</div>',
      '<button class="top" onClick=(() => (on = !on))>F</button>',
      '<p class={ active: on }><button class="paragraph" onClick=(() => (on = !on))>G</button></p>',
    ].join('\n'),
    { filename: 'T.brm' },
  );
  /** The markup that the server writes after an element's static attributes. */
  const after = (name: string): string => server.split(`class=\\"${name}\\"`)[1]!.slice(0, 5);

  it('leaves out the anchor of an element whose handlers find their scope from an element around it', () => {
    expect(after('nested')).toBe(' b-on');
  });

  it('keeps the anchor where the element around it can be in another scope or place', () => {
    // Children render inside the component, a block body has its own scope, a portal renders
    // elsewhere, and the children of a dynamic tag can render inside a component.
    // The browser ends a `<p>` at a `<div>`, which a component inside it can render.
    for (const name of ['child', 'block', 'portal', 'dynamic', 'top', 'paragraph']) {
      expect(after(name)).toBe(' b-b=');
    }
  });

  it('updates a text that is the whole content of its element through the element', () => {
    expect(after('only')).toBe(' b-b=');
    expect(server).toMatch(/class=\\"only\\" b-b=[^]*?\\">" \+ \(typeof/);
    // Whitespace around the text keeps the markers.
    expect(server).toContain('<p class=\\"spaced\\"> <!--t');
    // A comment in an element whose content is text would be text too, so the element has the anchor.
    expect(server).toMatch(/<textarea b-b=[^]*?">" \+ \(typeof/);
    expect(server).not.toContain('<textarea><!--t');
  });
});

/** The server module of a component with a live list whose item body is `body`. */
function listServer(body: string): string {
  return compile(
    [
      '<script>',
      "  import { $signal } from 'brumate/signals';",
      '  let rows = $signal([1, 2]);',
      '</script>',
      '<button onClick=(() => (rows = [...rows, rows.length + 1]))>Add</button>',
      '#for (row of rows) {',
      `  ${body}`,
      '}',
    ].join('\n'),
    { filename: 'T.brm' },
  ).server;
}

describe('list items of one element', () => {
  it('marks the item with the anchor of its element', () => {
    for (const body of ['<li>{row}</li>', '<tr><td>{row}</td></tr>', '<div><b>{row}</b></div>']) {
      const code = listServer(body);
      expect(code).not.toContain('<!--i');
      expect(code).toMatch(/"<(li|tr|div) b-b=\\"" \+ \$\$s2 \+ ":0\\">/);
    }
  });

  it('keeps the markers when the browser can split the element, or there are more nodes', () => {
    for (const body of [
      '<p>{row}</p>',
      '<tr><b>{row}</b></tr>',
      '<li>{row}</li> <li>again</li>',
      '<li>{row}</li> text',
    ]) {
      expect(listServer(body)).toContain('<!--i');
    }
  });
});

function failParse(message: string): never {
  throw new Error(message);
}

/** The classes of a literal class value, from its source. */
function classes(source: string): ReturnType<typeof literalClasses> {
  return literalClasses(parseExpression(source, 0, failParse), (start, end) =>
    source.slice(start, end),
  );
}

describe('literal class values', () => {
  const values = [true, false, 0, '', 'x', null, undefined, 1];

  it.each([
    '{ one: a }',
    "{ one: a, 'two-x': b, three: c }",
    "{ '&<\"x>': a, y: b }",
    "['base', { on: a, off: !a }, 'tail']",
    "[{ on: a }, 'a&b', [{ deep: b }, ''], , 'x  y']",
    '{}',
    '[]',
    '{ a, b }',
    '{ x: true, y: 0, z: c, w: null }',
  ])('sets the text that the runtime makes of %s', (source) => {
    const found = classes(source);
    expect(found).toBeDefined();
    // oxlint-disable-next-line typescript/no-implied-eval -- The compiled code runs as the client runs it.
    const text = new Function('a', 'b', 'c', `return ${classText(found!)};`);
    // oxlint-disable-next-line typescript/no-implied-eval -- The value that the runtime reads.
    const value = new Function('a', 'b', 'c', `return (${source});`);
    for (const a of values) {
      for (const b of values) {
        for (const c of values) {
          expect(text(a, b, c)).toBe(classValue(value(a, b, c)));
        }
      }
    }
  });

  it.each([
    '{ 1: a, z: b }',
    '{ ...x }',
    '{ [a]: b }',
    '{ a: 1, a: b }',
    '{ __proto__: a }',
    "{ '': a }",
    '{ m() {} }',
    "['a', x]",
    'x',
    "'a b'",
  ])('leaves %s to the runtime', (source) => {
    expect(classes(source)).toBeUndefined();
  });
});

/** Compiles a component whose markup is `markup`, with a signal that a handler changes. */
function compileBlock(markup: string): void {
  compile(
    `<script>\n  import { $signal } from 'brumate/signals';\n  let open = $signal(false);\n</script>\n<button onClick=(() => (open = !open))>Toggle</button>\n${markup}`,
    { filename: 'T.brm' },
  );
}

describe('$route and $navigation', () => {
  it('read contexts that the runtime provides', () => {
    const { server, render } = compile(
      "<script>\n  import { $navigation, $route } from 'brumate/signals';\n  const route = $route('/issues/[id]');\n  const navigation = $navigation();\n</script>\n<p>{route.params.id} {navigation.pending}</p>",
      { filename: 'T.brm' },
    );
    // Each has a slot, so the browser updates what reads it when navigation changes it.
    expect(server).toContain('const route = $$ctx.consume($$b.routeContext, $$s1, 0);');
    expect(server).toContain('const navigation = $$ctx.consume($$b.navigationContext, $$s1, 1);');
    expect(render).toContain('const route = $$b.consumeContext($$b.routeContext, $$s1, 0);');
  });

  it.each([
    ['let route = $route();', 'Read the route with "const name = $route()"'],
    ['const navigation = $navigation(1);', '$navigation takes no arguments'],
  ])('report a wrong declaration: %s', (declaration, message) => {
    expect(() =>
      compile(
        `<script>\n  import { $navigation, $route } from 'brumate/signals';\n  ${declaration}\n</script>\n<p>Hi</p>`,
        { filename: 'T.brm' },
      ),
    ).toThrow(message);
  });
});

describe('#defer', () => {
  it.each([
    ['#client { #defer { <p>x</p> } }', '#defer cannot be inside a #client body'],
    ['#if (open) { #defer { <p>x</p> } }', '#defer cannot be in markup that the browser renders'],
  ])('reports a block that the server cannot render again: %s', (markup, message) => {
    expect(() => compileBlock(markup)).toThrow(message);
  });

  it.each([
    '#defer { <p>x</p> } #else { <p>…</p> }',
    '#loading { #defer { <p>x</p> } }',
    '#loading { <p>x</p> } #else { #defer { <p>y</p> } }',
    '#defer { #defer { <p>x</p> } }',
  ])('accepts a block in markup that the server renders: %s', (markup) => {
    expect(() => compileBlock(markup)).not.toThrow();
  });
});

describe('await', () => {
  const header = `<script>\n  import { $memo, $signal } from 'brumate/signals';\n  import { load, loadTags } from './data.ts';\n  let id = $signal(1);\n`;

  it('starts every memo of a run of awaited declarations, then waits for all of them', () => {
    const { server, parts: modules } = compile(
      `${header}  const user = await $memo(load(id));\n  const tags = await $memo(loadTags(user));\n</script>\n<p>{user.name} {tags.length}</p>\n<button onClick=(() => id++)>+</button>`,
      { filename: 'T.brm' },
    );
    expect(server).toContain('const $$p_user = $$b.memo(() => (load(id)), $$ctx, "user");');
    expect(server).toContain(
      'const $$p_tags = $$b.memo(() => (loadTags($$b.read($$p_user))), $$ctx, "tags");',
    );
    expect(server).toContain(
      'if (($$t = $$b.waitAll([$$p_user, $$p_tags])) !== undefined) await $$t;',
    );
    expect(server).toContain('const user = $$b.read($$p_user);');
    expect(server).toContain('const tags = $$b.read($$p_tags);');
    // The browser runs the memos as any other.
    expect(modules.update).toContain('$$b.memo($$s, 1, () => load($$b.get($$s, 0)));');
    expect(modules.update).toContain('$$b.memo($$s, 2, () => loadTags($$b.get($$s, 1)));');
    expect(parseSync('update.ts', modules.update!).errors).toEqual([]);
  });

  it('does not put a declaration without the keyword in a run', () => {
    const { server } = compile(
      `${header}  const user = await $memo(load(id));\n  const tags = $memo(loadTags(id));\n</script>\n<p>{user.name} {tags.length}</p>`,
      { filename: 'T.brm' },
    );
    expect(server).toContain(
      'const user = (($$t = $$b.ready($$p_user)) instanceof Promise ? await $$t : $$t);\n  const $$p_tags',
    );
    expect(server).toContain(
      'const tags = (($$t = $$b.ready($$p_tags)) instanceof Promise ? await $$t : $$t);',
    );
    expect(server).not.toContain('$$b.waitAll(');
  });

  it('waits for one awaited declaration where it is, and reads it after other statements', () => {
    const { server } = compile(
      `${header}  const user = await $memo(load(id));\n  let count = $signal(0);\n  const tags = await $memo(loadTags(user));\n</script>\n<p>{user.name} {tags.length} {count}</p>`,
      { filename: 'T.brm' },
    );
    expect(server).toContain(
      'const user = (($$t = $$b.ready($$p_user)) instanceof Promise ? await $$t : $$t);\n  let count = (0);',
    );
    expect(server).not.toContain('$$b.waitAll(');
  });

  it('reads a memo with await as a plain value, in a memo, in markup and in a handler', () => {
    const {
      server,
      parts: modules,
      render,
    } = compile(
      `${header}  const user = $memo(load(id));\n  const upper = $memo((await user).name.toUpperCase());\n</script>\n<p>{(await user).name} {upper}</p>\n<button onClick=(async () => console.log((await user).name, id++))>+</button>`,
      { filename: 'T.brm' },
    );
    // The page waits for the memos where they are declared, one after the other: no keyword, no run.
    expect(server).toContain(
      'const user = (($$t = $$b.ready($$p_user)) instanceof Promise ? await $$t : $$t);',
    );
    expect(server).toContain(
      '$$b.memo(() => (($$b.read($$p_user)).name.toUpperCase()), $$ctx, "upper")',
    );
    expect(server).not.toContain('$$b.waitAll(');
    expect(server).toContain('$$b.insert(((user).name)');
    // In the browser the value is settled, so the memo and the update code do not wait.
    expect(modules.update).toContain(
      '$$b.memo($$s, 2, () => ($$b.get($$s, 1)).name.toUpperCase());',
    );
    expect(modules.update).toContain('$$b.text($$s, 0, ($$b.get($$s, 1)).name);');
    expect(modules.h5).toContain(
      'console.log(($$b.get($$s, 1)).name, $$b.update($$s, 0, 1, false))',
    );
    expect(render).toContain('$$b.insert(((user).name))');
    for (const code of [...Object.values(modules), render]) {
      expect(parseSync('code.ts', code).errors).toEqual([]);
    }
  });

  it('waits for a memo that a #loading body awaits before the block, and streams the rest', () => {
    const { server } = compile(
      `${header}  const user = $memo(load(id));\n  const tags = $memo(loadTags(id));\n</script>\n#loading {\n  <p>{(await user).name} {tags.length}</p>\n} #else {\n  <p>…</p>\n}`,
      { filename: 'T.brm' },
    );
    expect(server).toContain(
      'const user = (($$t = $$b.ready($$p_user)) instanceof Promise ? await $$t : $$t);',
    );
    // The body renders in place when the tags are ready too, and streams otherwise.
    expect(server).toContain('if ($$b.settled([$$p_tags]) && $$ctx.mayShow()) {');
    expect(server).toContain('$$ctx.enter($$boundary0);');
    expect(server).toContain('const tags = $$b.read($$p_tags);');
    expect(server).toContain('$$ctx.defer($$boundary0, async ($$ctx) => {');
    expect(server).toContain(
      'const tags = (($$t = $$b.ready($$p_tags)) instanceof Promise ? await $$t : $$t);',
    );
  });

  it('waits for a memo that a nested #loading body awaits in the body around it', () => {
    const { server } = compile(
      `${header}  const user = $memo(load(id));\n  const tags = $memo(loadTags(id));\n</script>\n#loading {\n  <p>{tags.length}</p>\n  #loading {\n    <p>{(await user).name}</p>\n  }\n}`,
      { filename: 'T.brm' },
    );
    // The page does not wait: the outer body does, before it reaches the inner block.
    expect(server.indexOf('const user = (($$t = $$b.ready($$p_user))')).toBeGreaterThan(
      server.indexOf('$$ctx.defer($$boundary0'),
    );
    expect(server).toContain('if ($$b.settled([$$p_tags, $$p_user]) && $$ctx.mayShow()) {');
    expect(server).toMatch(
      /defer\(\$\$boundary0, async \(\$\$ctx\) => \{\n\s+let \$\$html = '';\n\s+const tags = .*\n\s+const user = /,
    );
    // The inner body waits for nothing of its own, so it always renders in place.
    expect(server).toContain('$$ctx.enter();');
    expect(server).not.toContain('$$b.settled([])');
  });

  it.each([
    ['a child component', '<Child />'],
    ['a dynamic tag', '<{tag} />'],
    ['an insert of a prop', '{children}'],
    ['a template', '{row(1)}'],
  ])('always streams a #loading body that renders %s', (_, markup) => {
    const { server } = compile(
      `<script>\n  import { $memo, $props } from 'brumate/signals';\n  import Child from './Child.brm';\n  import { load } from './data.ts';\n  const { children, tag } = $props();\n  const user = $memo(load(1));\n</script>\n#template row(n) { <td>{n}</td> }\n#loading {\n  <p>{user.name}</p>\n  ${markup}\n} #else {\n  <p>…</p>\n}`,
      { filename: 'T.brm' },
    );
    expect(server).not.toContain('$$b.settled(');
    expect(server).toContain('$$ctx.defer($$boundary0');
  });

  it('renders a #loading body in place when it reads no memo that can load', () => {
    const { server } = compile(
      `${header}  const double = $memo(id * 2);\n</script>\n#loading {\n  <p>{double}</p>\n} #else {\n  <p>…</p>\n}`,
      { filename: 'T.brm' },
    );
    expect(server).toContain('$$ctx.enter();');
    expect(server).not.toContain('$$b.settled(');
    expect(server).not.toContain('$$ctx.defer(');
  });

  it('throws in the render module of a component whose script awaits a promise', () => {
    const { render, server } = compile(
      `${header}  const settings = await load(0);\n</script>\n<p>{settings.theme} {id}</p>\n<button onClick=(() => id++)>+</button>`,
      { filename: 'T.brm' },
    );
    expect(server).toContain('const settings = await load(0);');
    expect(render).toMatch(
      /export default function T\(\$\$props: [^)]*\): string \{\n  throw new Error\("T awaits a promise in its script or markup, so only the server can render it"\);\n\}/,
    );
    expect(parseSync('render.ts', render).errors).toEqual([]);
  });

  it('renders a component whose memos await promises, and whose handlers await', () => {
    const { render } = compile(
      `${header}  const user = $memo(await load(id));\n</script>\n<p>{user.name}</p>\n<button onClick=(async () => { await load(id); id++; })>+</button>`,
      { filename: 'T.brm' },
    );
    expect(render).not.toContain('throw new Error');
    expect(render).toContain('const user = (async () => (await load(id)))();');
  });

  it.each([
    [
      'a body that the browser renders',
      '#if (id > 1) {\n  <script>\n    const settings = await load(id);\n  </script>\n  <p>{settings.theme}</p>\n}',
      'Markup that the browser renders can await only a memo. Load the promise in a memo instead',
    ],
    [
      'an insert that the browser updates',
      '<p>{(await load(id)).theme}</p>',
      'Code that the browser updates can await only a memo. Load the promise in a memo instead',
    ],
  ])('reports an await of a promise in %s', (_, markup, message) => {
    expect(() =>
      compile(`${header}</script>\n<button onClick=(() => id++)>+</button>\n${markup}`, {
        filename: 'T.brm',
      }),
    ).toThrow(message);
  });

  it('accepts an await of a memo in a body that the browser renders', () => {
    const { parts: modules } = compile(
      `${header}  const user = $memo(load(id));\n</script>\n<button onClick=(() => id++)>+</button>\n#if (id > 1) {\n  <p>{(await user).name}</p>\n}`,
      { filename: 'T.brm' },
    );
    expect(modules.update).toContain('$$b.insert(((user).name))');
    expect(parseSync('update.ts', modules.update!).errors).toEqual([]);
  });

  it('reports await of a compile-time function other than $memo', () => {
    expect(() =>
      compile(`${header}  let count = await $signal(0);\n</script>\n<p>{count}</p>`, {
        filename: 'T.brm',
      }),
    ).toThrow('await works with $memo, not $signal');
  });
});

/** A page with a `#try` whose body is `body`, and a counter button outside it. */
function tryPage(body: string): string {
  return `<script>\n  import { $signal } from 'brumate/signals';\n  let count = $signal(0);\n</script>\n#try {\n  ${body}\n} #catch (error) {\n  <p>{String(error)}</p>\n}\n<button onClick=(() => count++)>{count}</button>`;
}

describe('#try with client code', () => {
  it('ships both bodies and lists the block for the scopes inside its body', () => {
    const { client, server } = compile(
      tryPage('<button onClick=(() => { throw new Error("x"); })>Go</button>'),
      {
        filename: 'T.brm',
      },
    );
    // The block has a marker, because the browser replaces its content when a handler throws.
    expect(server).toContain('"<!--b" + $$s1 + ":0-->"');
    // The kinds inside the body point at the scope that holds the block, the anchor, both renders and both kinds.
    expect(client).toMatch(/export const t = \{ 2: \[1, 0, "r2", "r3", \[2, 3\]\] \};/);
  });

  it('ships nothing for a #try without client code in its body', () => {
    const { client, server } = compile(tryPage('<p>{count}</p>'), { filename: 'T.brm' });
    expect(server).not.toContain('<!--b');
    expect(client).not.toContain('export const t');
  });
});

describe('character references', () => {
  it('reads named and numeric references, and a number that is no character as U+FFFD', () => {
    expect(decodeAttribute('a&nbsp;b &amp; &copy; &#65;&#x42; &unknown;')).toBe(
      'a b & © AB &unknown;',
    );
    expect(decodeAttribute('&#x110000; &#0; &#xD800;')).toBe('� � �');
  });
});

describe('anchors', () => {
  it('knows the scope of every anchor, for the Elements tab of the devtools', () => {
    const { plan } = compile(
      `<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
</script>

<p>{count}</p>
<button onClick=(() => count++)>{count} and {count * 2}</button>
#if (count > 1) {
  <span>{count}</span>
}`,
      { filename: 'Anchors.brm' },
    );
    expect(plan.anchors.size).toBeGreaterThan(0);
    for (const target of plan.anchors.keys()) {
      expect(plan.anchorScopes.get(target)).toBeDefined();
    }
  });
});
