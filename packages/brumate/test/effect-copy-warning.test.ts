// A warning for an $effect that only assigns signals that nothing else writes.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { check } from '../src/check-command.ts';
import { findError } from '../src/error-catalog.ts';
import { compile } from '../src/index.ts';

const IMPORTS =
  "import { $bind, $client, $effect, $searchParam, $signal, $props } from 'brumate/signals';";

function build(script: string, markup = ''): string {
  return `<script>\n${IMPORTS}\n${script}\n</script>\n\n${markup}`;
}

function warn(script: string, markup = ''): string[] {
  const result = compile(build(script, markup), { filename: 'Test.brm' });
  const messages: string[] = [];
  for (const warning of result.warnings) {
    // The other warnings, such as an effect that reads nothing, are not this check's.
    if (warning.message.includes('is written only by this effect')) {
      messages.push(warning.message);
    }
  }
  return messages;
}

const COPY = [
  "let count = $signal(0);\nlet message = $signal('Clicked 0 times');",
  '$effect(() => {\n  message = `Clicked ${count} times`;\n});',
].join('\n');

const ADD = '<button onClick=(() => count++)>Add</button><p>{message}</p>';

describe('effect copy warning', () => {
  it('warns with the name and the memo form', () => {
    expect(warn(COPY, ADD)).toEqual([
      '"message" is written only by this effect. Use const message = $memo(...)',
    ]);
  });

  it('matches one catalog entry, BRM209', () => {
    expect(findError(warn(COPY, ADD)[0]!)?.code).toBe('BRM209');
    expect(findError('"a" is written only by this effect. Use a $memo')?.code).toBe('BRM209');
  });

  it('gives no memo form with an if', () => {
    const script = `let count = $signal(0);
let message = $signal('');
$effect(() => {
  if (count > 1) {
    message = 'many';
  } else {
    message = 'few';
  }
});`;
    expect(warn(script, ADD)).toEqual(['"message" is written only by this effect. Use a $memo']);
  });

  it('warns once for each signal of an effect', () => {
    const script = `let count = $signal(0);
let a = $signal(0);
let b = $signal(0);
$effect(() => {
  a = count + 1;
  b = count + 2;
});`;
    expect(warn(script, `${ADD}<p>{a}{b}</p>`)).toEqual([
      '"a" is written only by this effect. Use a $memo',
      '"b" is written only by this effect. Use a $memo',
    ]);
  });

  describe('stays quiet', () => {
    const head = "let count = $signal(0);\nlet message = $signal('');\n";
    const cases: [string, string, string?][] = [
      ['a call in the body', `${head}$effect(() => {\n  message = String(count);\n});`],
      [
        'a call that is not an assignment',
        `${head}$effect(() => {\n  message = 'a';\n  console.log(count);\n});`,
      ],
      [
        'an await',
        `${head}$effect(async () => {\n  message = await fetch('/a').then(String);\n});`,
      ],
      [
        'a returned cleanup',
        `${head}$effect(() => {\n  message = 'a' + count;\n  return () => {};\n});`,
      ],
      [
        'a write in a handler',
        `${head}function reset() {\n  message = '';\n}\n$effect(() => {\n  message = 'a' + count;\n});`,
        '<button onClick=reset>x</button>',
      ],
      [
        'a write in an inline handler',
        `${head}$effect(() => {\n  message = 'a' + count;\n});`,
        "<button onClick=(() => (message = ''))>x</button>",
      ],
      [
        'a write in a $client callback',
        `${head}$client(() => {\n  message = 'c';\n});\n$effect(() => {\n  message = 'a' + count;\n});`,
      ],
      [
        'a write in another effect',
        `${head}$effect(() => {\n  message = 'a' + count;\n});\n$effect(() => {\n  message = 'b' + count;\n});`,
      ],
      [
        'a $bind',
        `${head}$effect(() => {\n  message = 'a' + count;\n});`,
        '<input value=$bind(message) />',
      ],
      [
        'a reset of a signal that the user writes',
        `const { query } = $props<{ query: string }>();\nlet page = $signal(1);\n$effect(() => {\n  query;\n  page = 1;\n});`,
        '<button onClick=(() => page++)>{page}</button>',
      ],
      ['a $searchParam site', `let q = $searchParam('q');\n`, '<p>{q}</p>'],
      [
        'an accumulator with =',
        `let n = $signal(0);\nlet total = $signal(0);\n$effect(() => {\n  total = total + n;\n});`,
        '<p>{total}{n}</p>',
      ],
      [
        'an accumulator with +=',
        `let n = $signal(0);\nlet total = $signal(0);\n$effect(() => {\n  total += n;\n});`,
        '<p>{total}{n}</p>',
      ],
      [
        'a test that reads the assigned name',
        `let n = $signal(0);\nlet m = $signal('');\n$effect(() => {\n  if (m === '') {\n    m = 'a' + n;\n  } else {\n    m = 'b';\n  }\n});`,
        '<p>{m}{n}</p>',
      ],
      [
        'an if with no else',
        `let n = $signal(0);\nlet m = $signal('');\n$effect(() => {\n  if (n > 2) {\n    m = 'big';\n  }\n});`,
        '<p>{m}{n}</p>',
      ],
      [
        'an else that does not assign the name',
        `let n = $signal(0);\nlet m = $signal('');\nlet k = $signal('');\n$effect(() => {\n  if (n > 2) {\n    m = 'big';\n  } else {\n    k = 'small';\n  }\n});`,
        '<p>{m}{n}{k}</p>',
      ],
      [
        'a let prop',
        `let { value } = $props<{ value: number }>();\n$effect(() => {\n  value = 1;\n});`,
      ],
    ];
    it.each(cases)('%s', (_name, script, markup) => {
      expect(warn(script, markup ?? `<p>{message}</p>`)).toEqual([]);
    });
  });
});

describe('effect copy warning in brumate check', () => {
  const roots: string[] = [];
  afterAll(() => {
    for (const root of roots) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports the code and the link of the warning', async () => {
    const root = mkdtempSync(join(tmpdir(), 'brumate-copy-'));
    roots.push(root);
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/A.brm'), build(COPY, ADD));
    const { records } = await check(root, { types: false });
    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record?.severity).toBe('warning');
    expect(record?.code).toBe('BRM209');
    expect(record?.link).toMatch(/errors#brm209$/);
  });
});
