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
  import { refresh } from 'brumate/server';

  async function listSecretThings() {
    'use server';
    return [1];
  }

  async function deleteEverything(form: FormData) {
    'use server';
    refresh(listSecretThings);
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
