import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';

/** Compiles a component and returns its warnings. */
function warnings(script: string, markup = ''): string[] {
  const source = `<script>\nimport { $memo, $produce, $props, $signal } from 'brumate/signals';\n${script}\n</script>\n\n${markup}`;
  return compile(source, { filename: 'Test.brm' }).warnings.map((warning) =>
    source.slice(warning.range.start, warning.range.end),
  );
}

describe('changes in place', () => {
  it('warns when a method changes a signal value in place', () => {
    expect(
      warnings(`let todos = $signal([]);
function add() {
  todos.push(1);
}`),
    ).toEqual(['todos.push(1)']);
  });

  it('warns when a property of a reactive value is written', () => {
    expect(
      warnings(
        `const { todo } = $props();
let list = $signal([{ done: false }]);
function done() {
  todo.done = true;
  list[0].done = true;
  list.length++;
}`,
      ),
    ).toEqual(['todo.done = true', 'list[0].done = true', 'list.length++']);
  });

  it('does not warn for new values, drafts and local values', () => {
    expect(
      warnings(`let todos = $signal([]);
function add() {
  todos = [...todos, 1];
  todos = $produce(todos, (draft) => {
    draft.push(1);
  });
  const copy = todos.slice();
  copy.push(1);
  todos.map((todo) => todo).sort();
}`),
    ).toEqual([]);
  });
});

describe('compile-time functions', () => {
  it('needs them imported from brumate/signals', () => {
    expect(() => compile('<script>\n  let count = $signal(0);\n</script>\n<p>{count}</p>')).toThrow(
      "Import $signal from 'brumate/signals'",
    );
  });

  it('names the new names of $provide and $context', () => {
    expect(() =>
      compile(
        "<script>\n  import { $provide } from 'brumate/signals';\n  $provide(Theme, 'dark');\n</script>",
        { filename: 'Test.brm' },
      ),
    ).toThrow("$provide was renamed to $setContext. Import $setContext from 'brumate/signals'");
    expect(() =>
      compile(
        "<script>\n  import { $context } from 'brumate/signals';\n  const theme = $context(Theme);\n</script>\n<p>{theme}</p>",
        { filename: 'Test.brm' },
      ),
    ).toThrow("$context was renamed to $getContext. Import $getContext from 'brumate/signals'");
    expect(() =>
      compile('<script>\n  const theme = $context(Theme);\n</script>\n<p>{theme}</p>', {
        filename: 'Test.brm',
      }),
    ).toThrow('$context was renamed to $getContext');
  });

  it('reads a renamed import as the function it names', () => {
    const result = compile(
      "<script>\n  import { $signal as signal } from 'brumate/signals';\n  let count = signal(0);\n</script>\n<button onClick=(() => count++)>{count}</button>",
      { filename: 'Test.brm' },
    );
    expect(result.server).toContain('let count = (0);');
    expect(result.server).not.toContain('brumate/signals');
    expect(Object.values(result.parts).join('')).toContain('$$b.update(');
  });
});

describe('reserved attributes', () => {
  it('rejects element attributes that start with b-', () => {
    expect(() => compile('<p b-on="click">Hi</p>', { filename: 'Test.brm' })).toThrow(
      '"b-on" is reserved',
    );
    expect(() =>
      compile('<script>\nconst id = 1;\n</script>\n<p b-b={id}>Hi</p>', { filename: 'Test.brm' }),
    ).toThrow('"b-b" is reserved');
  });

  it('accepts data attributes and component props', () => {
    expect(() => compile('<p data-on="click">Hi</p>', { filename: 'Test.brm' })).not.toThrow();
  });
});

describe('timing helpers', () => {
  const compileScript = (script: string) =>
    compile(
      `<script>\nimport { $debounced, $signal, $throttled } from 'brumate/signals';\nlet query = $signal('');\n${script}\n</script>\n<p>{query}</p>`,
      { filename: 'Test.brm' },
    );

  it('needs a const, a value and a wait in milliseconds', () => {
    expect(() => compileScript('let a = $debounced(query, 300);')).toThrow(
      'Declare $debounced with const',
    );
    expect(() => compileScript('const a = $throttled(query);')).toThrow(
      '$throttled takes a value and a wait in milliseconds',
    );
    expect(() => compileScript('const wait = 300;\nconst a = $debounced(query, wait);')).toThrow(
      'The wait of $debounced must be a number of milliseconds, such as 300',
    );
    expect(() => compileScript('const a = $throttled(query, 1e10);')).toThrow(
      'The wait of $throttled must be a number of milliseconds',
    );
  });

  it('renders the value itself on the server', () => {
    const { server } = compileScript('const a = $debounced(query, 300);');
    expect(server).toContain('const a = (query);');
    expect(server).not.toContain('300');
  });
});

/** Compiles markup with the wrappers of `brumate/events` imported. */
const compileMarkup = (markup: string, imports = 'capture, once, prevent, stop') =>
  compile(
    `<script>\nimport { $signal } from 'brumate/signals';\nimport { ${imports} } from 'brumate/events';\nlet n = $signal(0);\nfunction save() { n++; }\n</script>\n${markup}\n<p>{n}</p>`,
    { filename: 'Test.brm' },
  );
/** The `b-on` values of the server render. */
const bOn = (markup: string): string[] =>
  [...compileMarkup(markup).server.matchAll(/b-on=\\"([^"\\\\]*)/g)].map((match) => match[1]!);

describe('props that the caller passes or binds', () => {
  const compileScript = (script: string) =>
    compile(
      `<script>\nimport { $isBound, $isPassed, $props, $signal } from 'brumate/signals';\nconst { label } = $props();\nlet { open } = $props();\nlet count = $signal(0);\n${script}\n</script>\n<p>{label}</p>`,
      { filename: 'Test.brm' },
    );

  it('needs a prop for $isPassed, as a const of the component script', () => {
    expect(() => compileScript('const passed = $isPassed(open);')).not.toThrow();
    expect(() => compileScript('let passed = $isPassed(open);')).toThrow(
      'Check a prop with "const name = $isPassed(prop)"',
    );
    expect(() => compileScript('const passed = $isPassed(count);')).toThrow(
      '$isPassed takes a prop that the component destructures',
    );
    expect(() => compileScript('const f = () => $isPassed(open);')).toThrow(
      'Check a prop with "const name = $isPassed(prop)"',
    );
  });

  it('needs a prop that the component writes for $isBound', () => {
    expect(() => compileScript('const f = () => $isBound(open);')).not.toThrow();
    expect(() => compileScript('const f = () => $isBound(label);')).toThrow(
      '$isBound takes a prop that the component destructures with let',
    );
  });
});

describe('wrappers of event handlers', () => {
  it('writes the wrappers into b-on, so the loader applies them before the code loads', () => {
    expect(bOn('<button onClick=(once(stop(save)))>Save</button>')[0]).toMatch(
      /^click:once:stop=Test_\w+#h\d+$/,
    );
    expect(bOn("<ul onKeyDown=(prevent(save, 'ArrowDown', 'Space'))></ul>")[0]).toMatch(
      /^keydown:prevent\(ArrowDown,Space\)=/,
    );
    expect(bOn('<div onClick=(capture(save))></div>')[0]).toMatch(/^click:capture=/);
    expect(compileMarkup("<window onKeyDown=(prevent(save, 'Escape')) />").server).toContain(
      'b-on=\\"keydown:prevent(Escape)=',
    );
  });

  it('leaves a function of the same name that does not come from brumate/events', () => {
    const { server } = compile(
      `<script>\nfunction prevent(fn) { return fn; }\nfunction save() {}\n</script>\n<button onClick=(prevent(save))>Save</button>`,
      { filename: 'Test.brm' },
    );
    expect(server).toMatch(/b-on=\\"click=/);
  });

  it('reports keys that are not literal names, and keys on other events', () => {
    expect(
      bOn("<ul onKeyDown=(prevent(save, 'ArrowDown', 'Mod+ArrowDown', 'Alt+a'))></ul>")[0],
    ).toMatch(/^keydown:prevent\(ArrowDown,Mod\+ArrowDown,Alt\+a\)=/);
    expect(() => compileMarkup("<ul onKeyDown=(prevent(save, 'Shift+ArrowDown'))></ul>")).toThrow(
      'Name each key of prevent',
    );
    expect(() => compileMarkup("<ul onKeyDown=(prevent(save, 'ArowDown'))></ul>")).toThrow(
      "Name each key of prevent as a string of its event.key, such as 'ArrowDown', 'Space' or 'a'",
    );
    expect(() => compileMarkup('<ul onKeyDown=(prevent(save, key))></ul>')).toThrow(
      'Name each key of prevent',
    );
    expect(() => compileMarkup("<button onClick=(prevent(save, 'Enter'))>x</button>")).toThrow(
      'Only prevent of a keyboard event takes keys, such as onKeyDown',
    );
    expect(() => compileMarkup("<button onClick=(stop(save, 'Enter'))>x</button>")).toThrow(
      'stop takes a handler',
    );
  });

  it('warns about a modifier in the attribute name', () => {
    const { warnings: found } = compileMarkup('<form onSubmit:prevent=save></form>');
    expect(found.map((warning) => warning.message)).toContain(
      'onSubmit:prevent is replaced by onSubmit=(prevent(handler)) from brumate/events',
    );
  });
});

describe('$handler', () => {
  const compileHandler = (script: string, markup = '<button {...press}>Go</button>') =>
    compile(
      `<script>\nimport { $handler, $signal } from 'brumate/signals';\nimport { prevent } from 'brumate/events';\n${script}\n</script>\n\n${markup}`,
      { filename: 'Test.brm' },
    );

  it('marks a function, a function of the script, or one in wrappers', () => {
    expect(() =>
      compileHandler(`let count = $signal(0);
function bump(by: number) {
  count += by;
}
const press = { onClick: $handler(prevent(() => count++)) };
const add = { onClick: $handler(bump, 2) };`),
    ).not.toThrow();
  });

  it('needs a function as its first argument', () => {
    expect(() => compileHandler(`const press = { onClick: $handler(42) };`)).toThrow(
      '$handler needs a function as its first argument',
    );
  });

  it('refuses a value of the function around the call, which goes in as an argument', () => {
    expect(() =>
      compileHandler(
        `let count = $signal(0);
const add = (by: number) => ({ onClick: $handler(() => (count += by)) });`,
        '<button {...add(2)}>Go</button>',
      ),
    ).toThrow('The handler reads "by", a value of the function around $handler');
  });
});

describe('bindings', () => {
  const compileBind = (script: string, markup = '') =>
    compile(
      `<script>\nimport { $bind, $props, $signal } from 'brumate/signals';\nimport Child from './Child.brm';\n${script}\n</script>\n\n${markup}`,
      { filename: 'Test.brm' },
    );

  it('lets a component write the props that it destructures with let', () => {
    expect(() =>
      compileBind(
        `const { label } = $props();
let { open = false } = $props();
function toggle() {
  open = !open;
}`,
        '<button onClick=toggle>{label}</button>',
      ),
    ).not.toThrow();
    expect(() =>
      compileBind(`const { open } = $props();
function toggle() {
  open = !open;
}`),
    ).toThrow('Cannot assign to prop "open"');
    expect(() => compileBind('var { open } = $props();')).toThrow(
      'Assign $props() to a const or a let',
    );
  });

  it('binds a signal or a prop that the component writes, as the value of a prop', () => {
    expect(() =>
      compileBind(
        'let open = $signal(false);\nlet { value } = $props();',
        '<Child open=$bind(open) value=$bind(value) />',
      ),
    ).not.toThrow();
    expect(() => compileBind('const { open } = $props();', '<Child open=$bind(open) />')).toThrow(
      '$bind takes a signal, or a prop that the component destructures with let, and "open" is not one',
    );
    expect(() =>
      compileBind('let open = $signal(false);', '<Child open=($bind(open) && true) />'),
    ).toThrow('Pass $bind(name) as the value of a prop of a component');
  });
});

describe('setters of bindings', () => {
  const compileBind = (script: string, markup: string) =>
    compile(
      `<script>\nimport { $bind, $signal } from 'brumate/signals';\nimport Child from './Child.brm';\n${script}\n</script>\n\n${markup}`,
      { filename: 'Test.brm' },
    );

  it('takes a function as the setter', () => {
    expect(() =>
      compileBind(
        'let open = $signal(false);',
        '<Child open=$bind(open, (next) => (open = next)) />',
      ),
    ).not.toThrow();
    expect(() =>
      compileBind('let open = $signal(false);', '<Child open=$bind(open, 1) />'),
    ).toThrow('The second argument of $bind is a function that takes the new value');
    expect(() =>
      compileBind('let open = $signal(false);', '<Child open=$bind(open, () => {}, 1) />'),
    ).toThrow('$bind takes the name of a signal, and a function that writes it');
  });
});

describe('bindable props', () => {
  const messages = (script: string) =>
    compile(
      `<script lang="ts">\nimport { $props } from 'brumate/signals';\nimport type { Bindable } from 'brumate/signals';\n${script}\n</script>\n`,
      { filename: 'Test.brm' },
    ).warnings.map((warning) => warning.message);

  it('warns about a Bindable prop that the component reads only with const', () => {
    const warning =
      'The prop "open" is Bindable, but the component reads it with const and never writes it. Destructure it with let';
    expect(messages('const { open } = $props<{ open?: Bindable<boolean> }>();')).toEqual([warning]);
    expect(
      messages(`interface Props { open?: Bindable<boolean>; title: string }
const { open, title } = $props<Props>();`),
    ).toEqual([warning]);
    expect(
      messages(`type Props = { open?: Bindable<boolean> };
const { open } = $props<Props>();`),
    ).toEqual([warning]);
    expect(messages('let { open = false } = $props<{ open?: Bindable<boolean> }>();')).toEqual([]);
  });
});

describe('ref', () => {
  const component = (script: string, markup: string): string =>
    `<script>\nimport { $bind, $props, $signal, type Bindable } from 'brumate/signals';\n${script}\n</script>\n\n${markup}`;

  it('takes a signal and a prop that the component writes', () => {
    expect(() =>
      compile(component('let el = $signal<HTMLElement>();', '<p ref=$bind(el)>x</p>'), {
        filename: 'Test.brm',
      }),
    ).not.toThrow();
    expect(() =>
      compile(
        component(
          'let { ref } = $props<{ ref?: Bindable<HTMLElement> }>();',
          '<p ref=$bind(ref)>x</p>\n<{ref} ref=$bind(ref) />',
        ),
        { filename: 'Test.brm' },
      ),
    ).not.toThrow();
  });

  it('is an ordinary prop of a component', () => {
    expect(() =>
      compile(
        component(
          "import Button from './Button.brm';\nlet el = $signal<HTMLElement>();",
          '<Button ref=$bind(el) />',
        ),
        { filename: 'Test.brm' },
      ),
    ).not.toThrow();
  });

  it('asks for $bind', () => {
    for (const markup of ['<p ref=el>x</p>', '<p ref=(el)>x</p>', '<p ref=$bind(a.b)>x</p>']) {
      expect(() =>
        compile(component('let el = $signal<HTMLElement>();', markup), { filename: 'Test.brm' }),
      ).toThrow('ref takes $bind, as in ref=$bind(name)');
    }
  });

  it('rejects a prop that is read with const, or is not Bindable', () => {
    expect(() =>
      compile(
        component(
          'const { ref } = $props<{ ref?: Bindable<HTMLElement> }>();',
          '<p ref=$bind(ref)>x</p>',
        ),
        { filename: 'Test.brm' },
      ),
    ).toThrow('ref takes a $signal, or a prop that the component destructures with let');
    expect(() =>
      compile(
        component('let { ref } = $props<{ ref?: HTMLElement }>();', '<p ref=$bind(ref)>x</p>'),
        { filename: 'Test.brm' },
      ),
    ).toThrow('The prop "ref" is not Bindable. Type it as Bindable<HTMLElement>');
  });

  it('rejects a name that is not a signal', () => {
    expect(() =>
      compile(component('const el = 1;', '<p ref=$bind(el)>x</p>'), { filename: 'Test.brm' }),
    ).toThrow('ref takes a $signal, or a prop that the component destructures with let');
  });
});

describe('#loading header', () => {
  const page = (header: string) =>
    `<script>\nimport { $signal } from 'brumate/signals';\nlet data = $signal(1);\n</script>\n\n#loading${header} {\n  <p>{data}</p>\n} #else {\n  <p>Loading</p>\n}`;

  it('fails to compile with a header', () => {
    expect(() => compile(page(' (data)'), { filename: 'Test.brm' })).toThrow(
      '#loading does not take a header yet',
    );
  });

  it('compiles without a header', () => {
    expect(() => compile(page(''), { filename: 'Test.brm' })).not.toThrow();
  });
});

describe('reads of a memo that can lack a value', () => {
  /** A component with an async memo, `user`, and a memo that reads it, `name`. */
  function page(body: string, markup = '<button onClick=run>Run</button>'): string {
    return `<script>
import { $client, $effect, $isPending, $memo, $resolve, $signal } from 'brumate/signals';
import Child from './Child.brm';
async function getUser(id: number) {
  'use server';
  return { name: 'Ada' + id };
}
let id = $signal(1);
const user = $memo(getUser(id));
const name = $memo(user.name);
const ready = await $memo(getUser(id));
function log(value: unknown) {}
${body}
</script>

${markup}`;
  }
  const build = (body: string, markup?: string) =>
    compile(page(body, markup), { filename: 'Test.brm' });
  const message = 'a memo that can lack a value. Wait for it with await $resolve(';

  it('fails when a handler reads an async memo', () => {
    expect(() => build('function run() { log(user); }')).toThrow(
      `The handler reads "user", ${message}user), or check $isPending(user) first`,
    );
  });

  it('fails when a handler reads a memo that reads an async memo', () => {
    expect(() => build('function run() { log(name); }')).toThrow('The handler reads "name"');
  });

  it('fails in a function that a handler calls, and at an inline handler', () => {
    expect(() => build('function show() { log(user); }\nfunction run() { show(); }')).toThrow(
      'The handler reads "user"',
    );
    expect(() => build('', '<button onClick=(() => log(user))>Run</button>')).toThrow(
      'The handler reads "user"',
    );
  });

  it('fails at the definition of a handler passed to a component', () => {
    expect(() => build('function run() { log(user); }', '<Child onPick=run />')).toThrow(
      'The handler reads "user"',
    );
    expect(() => build('', '<Child onPick=(() => log(user)) />')).toThrow(
      'The handler reads "user"',
    );
  });

  it('fails in a $client callback', () => {
    expect(() => build('$client(() => log(user), "idle");', '')).toThrow(
      'The handler reads "user"',
    );
  });

  it('accepts a read of a memo declared with await $memo', () => {
    expect(() => build('function run() { log(ready); }')).not.toThrow();
  });

  it('accepts a read that $isPending guards', () => {
    const guarded = [
      'function run() { const waiting = $isPending(user); if (waiting) return; log(user); }',
      'function run() { if ($isPending(user)) { return; } else { log(user); } }',
      'function run() { for (const n of [1]) { if ($isPending(user)) continue; log(user); } }',
      'function run() { if ($isPending(user)) return; log(user); }',
      'function run() { if ($isPending(user)) { throw new Error("wait"); } log(user); }',
      'function run() { if (!$isPending(user)) { log(user); } }',
      'function run() { if ($isPending(user)) { log(0); } else { log(user); } }',
      'function run() { $isPending(user) ? log(0) : log(user); }',
      'function run() { !$isPending(user) && log(user); }',
      'function run() { $isPending(user) || log(user); }',
      // A memo that reads the memo checks for it too.
      'function run() { if ($isPending(name)) return; log(user); }',
      'function run() { if ($isPending(name)) return; log(name); }',
      // The check is in the function that reads.
      'function show() { if ($isPending(user)) return; log(user); }\nfunction run() { show(); }',
    ];
    for (const body of guarded) {
      expect(() => build(body)).not.toThrow();
    }
  });

  it('fails when the check comes after the read, or covers only one branch', () => {
    expect(() => build('function run() { log(user); if ($isPending(user)) return; }')).toThrow(
      'The handler reads "user"',
    );
    expect(() => build('function run() { if (!$isPending(user)) { log(0); } log(user); }')).toThrow(
      'The handler reads "user"',
    );
  });

  it('accepts a read of an async memo in an effect, a memo and the markup', () => {
    expect(() =>
      build(
        'function run() {}\n$effect(() => log(user));\nconst again = $memo(user.name);',
        '<p>{user.name}</p><button onClick=run>Run</button>',
      ),
    ).not.toThrow();
  });

  it('accepts a read after await $resolve, and fails a read before it', () => {
    expect(() => build('async function run() { await $resolve(user); log(user); }')).not.toThrow();
    expect(() =>
      build('async function run() { const loaded = await $resolve(name); log(loaded, user); }'),
    ).not.toThrow();
    expect(() => build('async function run() { log(user); await $resolve(user); }')).toThrow(
      'The handler reads "user"',
    );
  });

  it('counts only an await $resolve that always runs before the read', () => {
    const maybe = [
      'async function run(flag: boolean) { if (flag) await $resolve(user); log(user); }',
      'async function run(flag: boolean) { flag && (await $resolve(user)); log(user); }',
      'async function run() { try { await $resolve(user, { timeout: 5 }); } catch {} log(user); }',
      'async function run() { setTimeout(async () => { await $resolve(user); }); log(user); }',
    ];
    for (const body of maybe) {
      expect(() => build(body)).toThrow('The handler reads "user"');
    }
    expect(() =>
      build(
        'async function run() { const loaded = (await $resolve(user)).name; log(loaded, user); }',
      ),
    ).not.toThrow();
    expect(() => build('async function run() { await $resolve(user); log(user); }')).not.toThrow();
  });

  it('does not count a check that a parameter hides', () => {
    expect(() =>
      build(
        'function run() { const waiting = $isPending(user); [1].forEach((waiting) => { if (waiting) return; log(user); }); }',
      ),
    ).toThrow('The handler reads "user"');
  });

  it('counts a memo that markup reads outside #loading as having a value', () => {
    expect(() =>
      build('function run() { log(user); }', '<p>{user.name}</p><button onClick=run>Run</button>'),
    ).not.toThrow();
    expect(() =>
      build('function run() { log(user); }', '<p>{name}</p><button onClick=run>Run</button>'),
    ).not.toThrow();
    // A `#loading` body does not make the server wait.
    expect(() =>
      build(
        'function run() { log(user); }',
        '#loading {\n<p>{user.name}</p>\n} #else {\n<p>Wait</p>\n}\n<button onClick=run>Run</button>',
      ),
    ).toThrow('The handler reads "user"');
  });

  it('counts a memo of an imported server function as async', () => {
    const source = `<script>
import { $memo } from 'brumate/signals';
import { getIssue } from './issues.ts';
function log(value: unknown) {}
const issue = $memo(getIssue(1));
function run() { log(issue); }
</script>

<button onClick=run>Run</button>`;
    const options = { filename: 'Test.brm', serverImport: () => 'issues#getIssue' };
    expect(() => compile(source, options)).toThrow('The handler reads "issue"');
    expect(() => compile(source, { filename: 'Test.brm' })).not.toThrow();
  });

  it('accepts $resolve in code that an event starts, and rejects it where a memo computes or markup renders', () => {
    expect(() =>
      build('async function run() { await $resolve(user, { timeout: 1 }); }'),
    ).not.toThrow();
    expect(() => build('$effect(() => { void $resolve(user); });')).not.toThrow();
    expect(() => build('const again = $memo($resolve(user));')).toThrow(
      '$resolve cannot run where a memo computes or markup renders',
    );
    expect(() => build('', '<p>{$resolve(user)}</p>')).toThrow(
      '$resolve cannot run where a memo computes or markup renders',
    );
    expect(() => build('async function run() { await $resolve(1); }')).toThrow(
      '$resolve needs a $memo',
    );
    expect(() => build('async function run() { await $resolve(id); }')).toThrow(
      '$resolve needs a $memo',
    );
  });
});
