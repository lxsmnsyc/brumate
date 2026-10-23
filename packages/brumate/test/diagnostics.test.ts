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
