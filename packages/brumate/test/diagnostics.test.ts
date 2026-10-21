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
