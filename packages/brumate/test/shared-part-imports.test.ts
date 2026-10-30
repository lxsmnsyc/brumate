import { describe, expect, it } from 'vitest';
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
});
