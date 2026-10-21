import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';

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
    ['an arrow with types', 'const f = (n: string): number => n.length;', 'const f$ = ($$s, n: string): number =>'],
    ['an arrow without parentheses', 'const f = n => n.length;', 'const f$ = ($$s, n) =>'],
    ['an async arrow', 'const f = async (n: string) => n.length;', 'const f$ = async ($$s, n: string) =>'],
    ['a function', 'function f(n: string) { return n.length; }', 'function f$($$s, n: string)'],
    ['a function without parameters', 'function f() { return 1; }', 'function f$($$s)'],
  ])('takes the scope before the parameters of %s', (_, declaration, expected) => {
    const code = parts(declaration);
    expect(code).toContain(expected);
    expect(parseSync('part.ts', code).errors).toEqual([]);
  });
});
