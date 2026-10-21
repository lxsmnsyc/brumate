import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { compile, inspect } from '../src/index.ts';

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
    // Whitespace around the text, or an element whose content is text, keeps the markers.
    expect(server).toContain('<p class=\\"spaced\\"> <!--t');
    expect(server).toContain('<textarea><!--t');
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
