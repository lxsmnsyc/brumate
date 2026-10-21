import { describe, expect, it } from 'vitest';
import { CompileError, compile } from '../src/index.ts';
import type { CompileResult } from '../src/index.ts';

const header =
  "<script>\n  import { $signal } from 'brumate/signals';\n  import { counter } from './counter.brm.ts';\n";

/** Compiles a component next to modules, given by their names in /app. */
function build(
  script: string,
  modules: Record<string, string>,
  markup = '<p>{count}</p>',
): CompileResult {
  return compile(`${header}${script}\n</script>\n\n${markup}\n`, {
    filename: 'App.brm',
    path: '/app/App.brm',
    resolveModule: (specifier, importer) => {
      const path = new URL(specifier, `file://${importer}`).pathname;
      const source = modules[path.slice('/app/'.length)];
      return source === undefined ? undefined : { path, source };
    },
  });
}

/** The message of the compile error, with the place it points at in the component. */
function failure(script: string, modules: Record<string, string>): string {
  try {
    build(script, modules);
  } catch (error) {
    if (error instanceof CompileError) {
      return error.message;
    }
    throw error;
  }
  throw new Error('It compiled');
}

const counter = `import { $memo, $signal } from 'brumate/signals';

export function counter(start: number) {
  let count = $signal(start);
  const double = $memo(count * 2);
  return { count, double, increment: () => count++ };
}
`;

describe('reactive logic in modules', () => {
  it('copies the body in place of the call, with names that do not clash', () => {
    const result = build(
      '  let double = $signal(0);\n  const { count, increment } = counter(1);',
      { 'counter.brm.ts': counter },
      '<button onClick=increment>{count} {double}</button>',
    );
    // A literal argument is written into the code, so it is not a value in the state of the page.
    expect(result.file.source).toContain('let count = $signal(1);');
    // `double` is not destructured, so its local gets a name of its own.
    expect(result.file.source).toContain('const counter_double = $memo(count * 2);');
    expect(result.file.source).toContain('const increment = () => count++;');
    expect(result.modules).toEqual(['/app/counter.brm.ts']);
  });

  it('reads a name argument through the parameter, so a signal passed in stays reactive', () => {
    const result = build('  let base = $signal(3);\n  const { count } = counter(base);', {
      'counter.brm.ts': counter,
    });
    expect(result.file.source).toContain('let count = $signal(base);');
  });

  it('keeps a local for a parameter that the function assigns to', () => {
    const result = build('  let base = $signal(3);\n  const { count } = counter(base);', {
      'counter.brm.ts': `import { $signal } from 'brumate/signals';\nexport function counter(start: number) {\n  start = start * 2;\n  let count = $signal(start);\n  return { count };\n}\n`,
    });
    // Writing the parameter must not write the component's signal.
    expect(result.file.source).toContain('let counter_start = (base);');
    expect(result.file.source).toContain('counter_start = counter_start * 2;');
  });

  it('imports what the function reads from its module, from the component', () => {
    const result = build('  const { count } = counter(1);', {
      'counter.brm.ts': `import { $signal } from 'brumate/signals';\nimport { clamp } from './lib/math.ts';\nexport const MAX = 9;\nexport function counter(start: number) {\n  let count = $signal(clamp(start, MAX));\n  return { count };\n}\n`,
    });
    expect(result.file.source).toContain("import { clamp } from './lib/math.ts';");
    expect(result.file.source).toContain("import { MAX } from './counter.brm.ts';");
  });

  it('follows module functions that call module functions', () => {
    const result = build('  const { count } = counter(1);', {
      'counter.brm.ts': `import { base } from './base.brm.ts';\nexport function counter(start: number) {\n  const { value } = base(start);\n  return { count: value };\n}\n`,
      'base.brm.ts': `import { $signal } from 'brumate/signals';\nexport function base(start: number) {\n  let value = $signal(start);\n  return { value };\n}\n`,
    });
    expect(result.file.source).toContain('$signal(');
    expect(result.modules.toSorted()).toEqual(['/app/base.brm.ts', '/app/counter.brm.ts']);
  });

  it('reports an error in the module at the call, with its place in the module', () => {
    const message = failure('  const { count } = counter(1);', {
      'counter.brm.ts': `import { $memo, $signal } from 'brumate/signals';\nexport function counter(start: number) {\n  let count = $signal(start);\n  const double = $memo(count++);\n  return { count, double };\n}\n`,
    });
    expect(message).toContain('(in counter.brm.ts:4:');
    expect(message).toMatch(/\(App\.brm:4:3\)$/);
  });

  it.each([
    [
      'a call inside a function',
      '  function make() {\n    return counter(1);\n  }',
      /at the top level of a script/,
    ],
    [
      'a call without destructuring',
      '  const result = counter(1);',
      /Destructure what counter returns/,
    ],
    ['a key that it does not return', '  const { total } = counter(1);', /does not return total/],
  ])('rejects %s', (_, script, error) => {
    expect(failure(script, { 'counter.brm.ts': counter })).toMatch(error);
  });

  it('asks to export a name of the module that the function reads', () => {
    const message = failure('  const { count } = counter(1);', {
      'counter.brm.ts': `import { $signal } from 'brumate/signals';\nconst START = 1;\nexport function counter() {\n  let count = $signal(START);\n  return { count };\n}\n`,
    });
    expect(message).toContain('reads START, which ./counter.brm.ts does not export');
  });

  it('maps the copied code back to the module', () => {
    const result = build(
      '  const { count, increment } = counter(1);',
      { 'counter.brm.ts': counter },
      '<button onClick=increment>{count}</button>',
    );
    const handler = Object.keys(result.maps.parts).find((part) => part !== 'update')!;
    expect(result.maps.parts[handler]!.sources).toEqual(['App.brm', '/app/counter.brm.ts']);
    expect(result.maps.parts[handler]!.sourcesContent[1]).toBe(counter);
  });
});
