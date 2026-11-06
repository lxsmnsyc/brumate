import { describe, expect, it } from 'vitest';
import { parseSync } from 'oxc-parser';
import { compile } from '../src/index.ts';

describe('imports of a shared client part', () => {
  it('imports the helper that a function used by two handlers calls', () => {
    const { parts } = compile(
      [
        '<script module>',
        "  import { helper } from './helper.ts';",
        '</script>',
        '<script>',
        "  import { $signal } from 'brumate/signals';",
        "  let s = $signal('a');",
        '  function toggle(next: string) {',
        '    s = helper(s, next);',
        '  }',
        '</script>',
        '<button onClick=(() => toggle("x"))>{s}</button>',
        '<button onDblClick=(() => toggle("y"))>{s}</button>',
      ].join('\n'),
      { filename: 'T.brm' },
    );
    const shared = parts.shared!;
    expect(shared).toContain('helper(');
    expect(shared).toMatch(/import \{ helper \} from ["']\.\/helper\.ts["']/);
  });

  it('imports the module script into the render module from the shared part', () => {
    const { render, parts } = compile(
      [
        '<script module>',
        '  export const box = { n: 0 };',
        '  const hidden = { m: 1 };',
        '</script>',
        '<p>{box.n}:{hidden.m}</p>',
      ].join('\n'),
      { filename: 'T.brm' },
    );
    expect(render).toMatch(
      /import \{ box, hidden \} from ["']\.\/T\.brm\?brumate-client&part=shared["']/,
    );
    expect(render).not.toContain('{ n: 0 }');
    expect(parts.shared).toContain('{ n: 0 }');
    expect(parts.shared).toMatch(/export \{ hidden \}/);
  });

  it('exports each name of the module script once, also from export lists', () => {
    const cases: [string, string[], string[]][] = [
      ['export { a };', ['a'], ['a']],
      ['export { a as b };', ['a', 'b'], ['b']],
      ['export { a }; export const d = 2;', ['a', 'd'], ['a', 'd']],
      ['export { a as b }; export const d = 2;', ['a', 'b', 'd'], ['b', 'd']],
    ];
    for (const [exports, shared, rendered] of cases) {
      const { render, parts } = compile(
        [
          '<script module>',
          '  const a = { n: 1 };',
          '  let c = 0;',
          `  ${exports}`,
          '  export function bump() { c++; }',
          '</script>',
          '<p>{a.n}:{c}</p>',
        ].join('\n'),
        { filename: 'T.brm' },
      );
      const sharedNames = exportedNames(parts.shared!);
      for (const name of ['bump', 'c', ...shared]) {
        expect(sharedNames.filter((item) => item === name)).toHaveLength(1);
      }
      const renderNames = exportedNames(render).filter((item) => item !== 'default');
      expect(renderNames.sort()).toEqual([...rendered, 'bump'].sort());
    }
  });
});

/** The exported names of a module. Parsing fails if a name is exported twice. */
function exportedNames(code: string): string[] {
  const { program, errors } = parseSync('x.ts', code, { sourceType: 'module' });
  expect(errors).toEqual([]);
  const names: string[] = [];
  for (const entry of program.body) {
    if (entry.type !== 'ExportNamedDeclaration') {
      continue;
    }
    for (const specifier of entry.specifiers) {
      names.push(code.slice(specifier.exported.start, specifier.exported.end));
    }
    const declaration = entry.declaration;
    if (declaration && 'id' in declaration && declaration.id && 'name' in declaration.id) {
      names.push(declaration.id.name);
    } else if (declaration?.type === 'VariableDeclaration') {
      for (const item of declaration.declarations) {
        if (item.id.type === 'Identifier') {
          names.push(item.id.name);
        }
      }
    }
  }
  return names;
}
