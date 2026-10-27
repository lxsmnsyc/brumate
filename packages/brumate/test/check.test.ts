import { describe, expect, it } from 'vitest';
import { compile, toTypeScript } from '../src/index.ts';

/** The generated code without the helper declarations at the top. */
function body(source: string): string {
  const { code } = toTypeScript(source, 'Card.brm');
  return code.slice(code.indexOf('export default'));
}

describe('toTypeScript', () => {
  it('copies the scripts, and types the props from $props', () => {
    const code = body(
      "<script>\n  import { $props } from 'brumate/signals';\n  import Badge from './Badge.brm';\n  const { label } = $props<{ label: string }>();\n</script>\n\n<Badge label=label />",
    );
    expect(code).toMatch(
      /^export default \$\$Component;\nasync function \$\$Component\(\$\$props: \(\{ label: string \}\)/,
    );
    expect(code).toContain('const { label } = $props<{ label: string }>();');
    // A direct call checks the props as a fresh object, so a prop that Badge does not take is an error.
    expect(code).toContain('Badge({ label: (label), });');
  });

  it('types the props from every call of $props', () => {
    const code = body(
      "<script>\n  import { $props } from 'brumate/signals';\n  const { label } = $props<{ label: string }>();\n  let { open } = $props<{ open?: Bindable<boolean> }>();\n</script>",
    );
    expect(code).toMatch(
      /\(\$\$props: \(\{ label: string \}\) & \(\{ open\?: Bindable<boolean> \}\),/,
    );
  });

  it('names a prop of a shorthand by the name after its brace', () => {
    const code = body(
      "<script>\n  import { $props } from 'brumate/signals';\n  import Badge from './Badge.brm';\n  const { label, onPick } = $props<{ label: string; onPick: () => void }>();\n</script>\n\n<Badge {label} {onPick} />",
    );
    expect(code).toContain('Badge({ label: (label), onPick: (onPick), });');
  });

  it('names the component function so that the file can import its component name', () => {
    const { code } = toTypeScript(
      "<script>\n  import { SignIn } from './auth.ts';\n</script>\n\n<p>{SignIn()}</p>",
      'sign-in.brm',
    );
    expect(code).not.toMatch(/function SignIn\b/);
    expect(code).not.toMatch(/\bSignIn\.brumateId/);
  });

  it('puts markup in blocks that match the control flow', () => {
    const code = body(`<script>
  import { $signal } from 'brumate/signals';
  let items = $signal([1, 2]);
</script>

#for (item, i of items by item) {
  <p onClick=(() => console.log(i))>{item}</p>
} #else {
  <p>None</p>
}
#try {
  <span />
} #catch (error, reset) {
  <button onClick=reset>{String(error)}</button>
}`);
    expect(code).toContain(
      'for (const item of ( items )) {\nconst i = 0 as number;\n$$use(( item));',
    );
    expect(code).toContain('$$on("p", "click", (() => console.log(i)));');
    expect(code).toContain('} catch (error) {\nconst reset = (): void => {};');
  });

  it('maps the event name to the attribute, also for a shorthand', () => {
    const source =
      '<script>\n  function save() {}\n</script>\n\n<p onDoubleClick=(save) /><button {save} /><b {onClick} />';
    const { code, mappings } = toTypeScript(source, 'Card.brm');
    for (const [name, event] of [
      ['onDoubleClick', 'doubleclick'],
      ['onClick', 'click'],
    ]) {
      const mapping = mappings.find(
        (item) =>
          source.startsWith(name, item.source) && code.startsWith(`"${event}"`, item.generated),
      );
      expect(mapping).toBeDefined();
      expect(mapping!.length).toBe(name.length);
    }
    expect(code).toContain('$$on("p", "doubleclick", (save));');
  });

  it('checks the expression and the body of #offscreen', () => {
    const code = body(`<script>
  import { $signal } from 'brumate/signals';
  let tab = $signal(1);
</script>

#offscreen (tab === 1) {
  <p>{tab}</p>
}`);
    expect(code).toContain('$$use((tab === 1));\n{\n$$use((tab));\n}');
  });

  it('checks the attributes of a plain element as one object, and its spreads apart', () => {
    const code = body(`<script>
  let box = $signal<HTMLElement>();
  const rest = { id: 'a' };
  const key = 'title';
</script>

<div ref=$bind(box) tabindex="0" hidden aria-label=(key) [key]=('x') {...rest} onClick=(() => {})></div>
<p></p>`);
    expect(code).toContain('$$on("div", "click", (() => {}));');
    expect(code).toContain('$$spread("div")(rest);\n$$element("div")({...$$present(rest) });');
    expect(code).toContain(
      '$$element("div")({ ref: $$bind(box), tabindex: "0", hidden: true, "aria-label": (key), [key]: (\'x\'), });',
    );
    expect(code).not.toContain('$$element("p"');
    // A namespaced name is not in the element types, so only its value is checked.
    const svg = body(
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href=(href) /></svg>',
    );
    expect(svg).toContain('$$use((href));');
    expect(svg).not.toContain('xlink');
  });

  it('maps the names of attributes, also quoted ones, and the children of a component', () => {
    const source =
      '<script>\n  import Badge from \'./Badge.brm\';\n</script>\n\n<p aria-label="a" [title]=(1)></p><Badge>some <b>text</b></Badge>';
    const { code, mappings } = toTypeScript(source, 'Card.brm');
    /** The source range that a generated range maps to, from its first and last characters. */
    const spanOf = (text: string) => {
      const start = code.indexOf(text);
      const end = start + text.length;
      const first = mappings.find(
        (item) => item.generated <= start && start < item.generated + item.length,
      )!;
      const last = mappings.find(
        (item) => item.generated < end && end <= item.generated + item.length,
      )!;
      return source.slice(
        first.source + start - first.generated,
        last.source + end - last.generated,
      );
    };
    expect(spanOf('"aria-label"')).toBe('aria-label');
    expect(spanOf('[title]')).toBe('[title]');
    expect(spanOf('children')).toBe('some <b>text</b>');
    expect(code).toContain('Badge({ children: $$markup, });');
  });

  it('leaves the names of the other $props calls out of the type of a rest', () => {
    const code = body(`<script>
  const { label, ...rest } = $props<{ label: string; open?: Bindable<boolean> }>();
  let { open } = $props<{ open?: Bindable<boolean> }>();
</script>`);
    expect(code).toContain(
      'const { label, ...rest } = $props<$$Omit<{ label: string; open?: Bindable<boolean> }, "open">>();',
    );
    expect(code).toContain('let { open } = $props<{ open?: Bindable<boolean> }>();');
  });

  it('maps copied code to the file', () => {
    const source =
      "<script>\n  import { $signal } from 'brumate/signals';\n  let count = $signal(0);\n</script>\n\n<p>{count + 1}</p>";
    const { code, mappings } = toTypeScript(source, 'Card.brm');
    const insert = source.indexOf('count + 1');
    const mapping = mappings.find((item) => item.source === insert)!;
    expect(code.slice(mapping.generated, mapping.generated + mapping.length)).toBe('count + 1');
  });

  it('keeps the scripts when the markup has a syntax error', () => {
    const result = toTypeScript(
      '<script>\n  const a: number = 1;\n</script>\n\n<p>{a</p>',
      'Card.brm',
    );
    expect(result.error?.message).toMatch(/Card\.brm/);
    expect(result.code).toContain('const a: number = 1;');
  });
});

describe('await', () => {
  it('keeps await of a memo, so its type is the value, and makes templates async', () => {
    const code = body(`<script>
  import { $memo, $signal } from 'brumate/signals';
  let id = $signal(1);
  const user = await $memo(Promise.resolve({ name: 'Ada', id }));
  const tags = $memo(Promise.resolve(['a']));
</script>

#template row(n: number) {
  <td>{(await tags)[n]}</td>
}
<p>{user.name} {(await tags).length} {row(0)}</p>`);
    expect(code).toContain("const user = await $memo(Promise.resolve({ name: 'Ada', id }));");
    expect(code).toContain('$$use((user.name));');
    expect(code).toContain('$$use(((await tags).length));');
    expect(code).toContain('async function row(n: number): Promise<$$Markup> {');
  });
});

describe('signals that bind to a ref', () => {
  const script = `<script>
  import { $signal } from 'brumate/signals';
  import Toolbar from './Toolbar.brm';
  let el = $signal<HTMLElement>();
  let fn = $signal<() => void>();
</script>
`;

  it('lets a signal that only a ref of a component binds hold an element', () => {
    const code = body(`${script}<Toolbar ref=$bind(el) />`);
    expect(code).not.toContain('$$sendable(el');
    expect(code).toContain('$$sendableRef(el');
  });

  it('still checks a function in a signal that only a ref of a component binds', () => {
    const code = body(`${script}<Toolbar ref=$bind(fn) />`);
    expect(code).not.toContain('$$sendable(fn');
    expect(code).toContain('$$sendableRef(fn');
  });

  it('checks a signal that a ref of a component and another prop bind', () => {
    const code = body(`${script}<Toolbar ref=$bind(el) other=$bind(el) />`);
    expect(code).toContain('$$sendable(el');
  });

  it('checks a signal that another prop binds', () => {
    const code = body(`${script}<Toolbar value=$bind(fn) />`);
    expect(code).toContain('$$sendable(fn');
  });
});

describe('props used as a whole', () => {
  const message = 'is the props object, so read one key at a time';

  function page(script: string, markup = '<p>x</p>'): string {
    return `<script>
  import { $props, $memo, $signal, $setContext, $createContext } from 'brumate/signals';
${script}
</script>

${markup}`;
  }

  const banned: [string, string][] = [
    [
      'a spread in script code',
      'const { id, ...rest } = $props();\n  const all = { ...rest, id };',
    ],
    [
      'a spread in $memo',
      'const { ...rest } = $props();\n  const all = $memo({ ...rest, class: "box" });',
    ],
    ['a call', 'const { ...rest } = $props();\n  console.log(rest);'],
    ['$memo', 'const { ...rest } = $props();\n  const all = $memo(rest);'],
    ['$setContext', 'const { ...rest } = $props();\n  $setContext(Context, rest);'],
    ['a signal', 'const { ...rest } = $props();\n  let copy = $signal(rest);'],
    ['a variable', 'const { ...rest } = $props();\n  const more = rest;'],
    ['the props object', 'const props = $props();\n  const more = props;'],
  ];

  for (const [name, script] of banned) {
    it(`rejects ${name}`, () => {
      expect(() => compile(page(script), { filename: 'Card.brm' })).toThrow(message);
    });
  }

  it('rejects the rest as a value in markup', () => {
    expect(() =>
      compile(page('const { ...rest } = $props();', '<p title=rest>x</p>'), {
        filename: 'Card.brm',
      }),
    ).toThrow(message);
  });

  it('rejects a rest in markup as a shorthand value', () => {
    expect(() =>
      compile(
        page(
          "import Badge from './Badge.brm';\n  const { ...rest } = $props();",
          '<Badge {rest} />',
        ),
        { filename: 'Card.brm' },
      ),
    ).toThrow(message);
  });

  it('rejects a cast of the whole object', () => {
    expect(() =>
      compile(page('const { ...rest } = $props();\n  const x = rest as Record<string, unknown>;'), {
        filename: 'Card.brm',
      }),
    ).toThrow(message);
  });

  it('allows a key read through a cast or parentheses', () => {
    for (const read of [
      '(rest as any).key',
      '(rest satisfies object).key',
      'rest!.key',
      '(rest).key',
    ]) {
      expect(() =>
        compile(page(`const { ...rest } = $props();\n  const k = $memo(${read});`), {
          filename: 'Card.brm',
        }),
      ).not.toThrow();
    }
  });

  it('rejects a write to a key of the props', () => {
    for (const write of [
      'rest.a = 1',
      "rest['a'] = 1",
      'rest.a += 1',
      'rest.a++',
      '--rest.a',
      'delete rest.a',
      'props.a = 1',
      '(rest as any).a = 1',
    ]) {
      let error: unknown;
      try {
        compile(
          page(
            `const { ...rest } = $props();\n  const props = $props();\n  function f() { ${write}; }`,
          ),
          { filename: 'Card.brm' },
        );
      } catch (caught) {
        error = caught;
      }
      expect(`${write}: ${String((error as Error)?.message)}`).toContain('props are read-only');
    }
  });

  it('allows a markup spread through a cast or parentheses', () => {
    for (const value of [
      '(rest as Record<string, unknown>)',
      '(rest!)',
      '(rest)',
      '(rest satisfies object)',
    ]) {
      expect(() =>
        compile(page('const { ...rest } = $props();', `<button {...${value}}>x</button>`), {
          filename: 'Card.brm',
        }),
      ).not.toThrow();
    }
  });

  it('allows a markup spread, a key read and destructuring', () => {
    expect(() =>
      compile(
        page(
          "const { id, ...rest } = $props();\n  const props = $props();\n  const label = $memo(rest['aria-label'] ?? props.title ?? rest.id);",
          '<button {...rest} {...props} class="box">{label}</button>\n<section></section>',
        ),
        { filename: 'Card.brm' },
      ),
    ).not.toThrow();
  });
});

describe('templates passed to a prop', () => {
  const script = `<script>
  import List from './List.brm';
  const items = [{ id: 'a' }];
  const label = 'outer';
</script>
`;

  it('writes an untyped template at its use, so the prop types its parameter', () => {
    const code = body(`${script}<List {items} item=row />
<List {items} item=(row) />

#template row(a) {
  <p>{a.id}</p>
}`);
    expect(code).not.toContain('function row');
    expect(code).toContain(
      'List({ items: (items), item: (async (a): Promise<$$Markup> => {\n$$use((a.id));\nreturn $$markup;\n}), });',
    );
    expect(code.match(/async \(a\)/g)).toHaveLength(2);
  });

  it('writes a shorthand use, and one in #for and #if, at the use', () => {
    const code = body(`${script}#for (group of [items]) {
  #if (group.length) {
    <List items=(group) {row} />
  }
}

#template row(a) {
  <p>{a.id} {label}</p>
}`);
    expect(code).not.toContain('function row');
    expect(code).toContain('List({ items: (group), row: (async (a): Promise<$$Markup> => {');
  });

  it('maps the body at each use to the file', () => {
    const source = `${script}<List {items} item=row />
<List {items} item=row />

#template row(a) {
  <p>{a.id}</p>
}`;
    const { code, mappings } = toTypeScript(source, 'Card.brm');
    const read = source.indexOf('a.id');
    const copies = mappings.filter((item) => item.source === read);
    expect(copies).toHaveLength(2);
    for (const copy of copies) {
      expect(code.slice(copy.generated, copy.generated + copy.length)).toBe('a.id');
    }
    const param = source.indexOf('row(a)') + 4;
    expect(mappings.filter((item) => item.source === param)).toHaveLength(2);
  });

  it('writes a template whose parameter has its name at its use', () => {
    const code = body(`${script}<List {items} {item} />

#template item(item) {
  <p>{item.id}</p>
}`);
    expect(code).not.toContain('function item');
    expect(code).toContain('item: (async (item): Promise<$$Markup> => {\n$$use((item.id));');
  });

  it('keeps a template declared that calls itself', () => {
    const code = body(`${script}<List {items} item=row />

#template row(a) {
  <p>{a.id}</p>
  {row(a)}
}`);
    expect(code).toContain('async function row(a): Promise<$$Markup> {');
  });

  it('declares the name of a template written at its uses, and maps each use to it', () => {
    const source = `${script}<List {items} item=row />
<List {items} item=(row) />

#template row(a) {
  <p>{a.id}</p>
}`;
    const { code, mappings } = toTypeScript(source, 'Card.brm');
    expect(code).toContain('const row = $$template;');
    const at = (offset: number): string[] =>
      mappings
        .filter((item) => item.source === offset)
        .map((item) => code.slice(item.generated, item.generated + item.length));
    expect(at(source.indexOf('#template row') + 10)).toEqual(['row']);
    expect(at(source.indexOf('item=row') + 5)).toEqual(['row']);
    expect(at(source.indexOf('item=(row)') + 6)).toEqual(['row']);
    expect(code).toContain('$$use(row);\nList({');
  });

  it('keeps a typed template, or one without parameters, declared', () => {
    const code = body(`${script}<List {items} item=row heading=title />

#template row(a: { id: string }) {
  <p>{a.id}</p>
}
#template title() {
  <h2>Items</h2>
}`);
    expect(code).toContain('async function row(a: { id: string }): Promise<$$Markup> {');
    expect(code).toContain('async function title(): Promise<$$Markup> {');
    expect(code).toContain('item: (row),');
  });

  it('keeps a template declared that the code reads in another way', () => {
    for (const markup of [
      '<List {items} item=row />\n<p>{row({ id: "b" })}</p>',
      '<List {items} item=(cond ? row : row) />',
      '<List {items} item=row />\n<div title=row></div>',
    ]) {
      const code = body(`${script}${markup}

#template row(a) {
  <p>{a.id}</p>
}`);
      expect(code).toContain('async function row(a): Promise<$$Markup> {');
    }
  });

  it('keeps a template declared when a name at the use hides a name it reads', () => {
    const code = body(`${script}#for (label of ['x']) {
  <List {items} item=row />
}

#template row(a) {
  <p>{a.id} {label}</p>
}`);
    expect(code).toContain('async function row(a): Promise<$$Markup> {');
    expect(code).toContain('item: (row),');
  });

  it('writes a template at a use inside another template written at its use', () => {
    const code = body(`${script}<List {items} item=outer />

#template outer(a) {
  <List items=([a]) item=inner />
}
#template inner(b) {
  <p>{b.id}</p>
}`);
    expect(code).not.toContain('function outer');
    expect(code).not.toContain('function inner');
    expect(code).toContain('item: (async (b): Promise<$$Markup> => {');
  });

  it('keeps a template declared that passes itself', () => {
    const code = body(`${script}<List {items} item=tree />

#template tree(a) {
  <List items=(a.children) item=tree />
}`);
    expect(code).toContain('async function tree(a): Promise<$$Markup> {');
  });

  it('writes a template of a block at its use in the block', () => {
    const code = body(`${script}#if (items.length) {
  <List {items} item=row />

  #template row(a) {
    <p>{a.id}</p>
  }
}`);
    expect(code).not.toContain('function row');
    expect(code).toContain('item: (async (a): Promise<$$Markup> => {');
  });
});
