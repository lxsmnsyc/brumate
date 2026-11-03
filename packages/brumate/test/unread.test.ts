import { describe, expect, it } from 'vitest';
import { analyze } from '../src/analyze.ts';
import { buildGraph } from '../src/graph.ts';
import { parse } from '../src/parser.ts';

/** The names of the memos that the graph of a component marks as unread. */
function unread(script: string, markup: string): string[] {
  const source = `<script>\n  import { $bind, $client, $effect, $getContext, $isPending, $memo, $resolve, $setContext, $signal, $untrack } from 'brumate/signals';\n  import { f } from './f.ts';\n  let s = $signal(1);\n${script}\n</script>\n${markup}`;
  const graph = buildGraph(analyze(parse(source, { filename: 'Unread.brm' })));
  const names: string[] = [];
  for (const declaration of graph.unread) {
    names.push(declaration.name);
  }
  return names.sort();
}

describe('findUnread', () => {
  it.each([
    ['$isPending', 'const b = $isPending(a);', '<p>{b}</p>'],
    ['a #loading header', '', '#loading (a) {\n  <p>x</p>\n}'],
    ['$resolve', 'const b = $resolve(a);', '<p>{b}</p>'],
    ['$untrack', 'const b = $memo($untrack(a));', '<p>{b}</p>'],
    ['a $client callback', '$client(() => f(a));', '<p>x</p>'],
    ['$setContext', '$setContext(Ctx, a);', '<p>x</p>'],
    ['a function', 'const g = () => a;', '<button onClick=(g)>x</button>'],
    ['an effect', '$effect(() => f(a));', '<p>{s}</p>'],
    ['a handler', '', '<button onClick=(() => f(a))>x</button>'],
    ['a spread', '', '<p {...a}>x</p>'],
    ['a prop shorthand', '', '<Kid {a} />'],
    ['an attribute', '', '<p title=(a)>x</p>'],
    ['markup', '', '<p>{a}</p>'],
    ['another memo that markup reads', 'const b = $memo(a + 1);', '<p>{b}</p>'],
    [
      'another memo that a handler reads',
      'const b = $memo(a + 1);',
      '<button onClick=(() => f(b))>x</button>',
    ],
    ['await', 'await a;', '<p>x</p>'],
  ])('keeps a memo that only %s reads', (_, script, markup) => {
    const names = unread(
      `  import Kid from './Kid.brm';\n  import { Ctx } from './ctx.ts';\n  const a = $memo(f(s));\n${script}`,
      markup,
    );
    expect(names).not.toContain('a');
  });

  it('keeps a memo that $bind passes', () => {
    const names = unread(
      `  import Kid from './Kid.brm';\n  let a = $signal(f(s));\n  const b = $memo(a);`,
      '<Kid value=($bind(b)) />',
    );
    expect(names).not.toContain('b');
  });

  it('keeps a memo that a template reads', () => {
    const names = unread(
      `  const a = $memo(f(s));`,
      '#template item() {\n  <p>{a}</p>\n}\n#item()',
    );
    expect(names).not.toContain('a');
  });

  it('drops a chain of memos that nothing reads', () => {
    expect(
      unread(
        '  const a = $memo(f(s));\n  const b = $memo(a + 1);\n  const d = $memo(b + 1);',
        '<p>{s}</p>',
      ),
    ).toEqual(['a', 'b', 'd']);
  });

  it('drops a memo that only an inner function of an unread memo reads', () => {
    expect(unread('  const a = $memo(f(s));\n  const b = $memo(() => a);', '<p>{s}</p>')).toEqual([
      'a',
      'b',
    ]);
  });
});
