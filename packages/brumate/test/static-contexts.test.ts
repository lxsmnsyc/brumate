import { describe, expect, it } from 'vitest';
import { analyzeProjectAll, compile } from '../src/index.ts';

const reader = `<script>
  import { $getContext } from 'brumate/signals';
  import { Words } from './words.ts';
  const words = $getContext(Words);
</script>
<p>{words.hello}</p>`;

function contexts(page: string, extra: Record<string, string> = {}): Set<string> {
  const files = new Map<string, string>([
    ['Page.brm', page],
    ['Reader.brm', reader],
  ]);
  for (const [name, source] of Object.entries(extra)) {
    files.set(name, source);
  }
  return analyzeProjectAll(files).contexts;
}

const head = `import { $setContext, $signal } from 'brumate/signals';
  import Reader from './Reader.brm';
  import { Words } from './words.ts';`;

describe('static contexts', () => {
  it('leaves out a context that is set once to a constant', () => {
    const live = contexts(
      `<script>${head}\n$setContext(Words, { hello: 'Hi' });</script><Reader />`,
    );
    expect(live.has('Words')).toBe(false);
  });

  it('keeps a context that a signal sets', () => {
    const live = contexts(
      `<script>${head}\nlet hello = $signal('Hi');\n$setContext(Words, { hello });</script>
<button onClick=(() => (hello = 'Yo'))>Change</button>
<Reader />`,
    );
    expect(live.has('Words')).toBe(true);
  });

  it('keeps a context with a function in its value', () => {
    const live = contexts(
      `<script>${head}\n$setContext(Words, { hello: 'Hi', say() {} });</script><Reader />`,
    );
    expect(live.has('Words')).toBe(true);
  });

  it('keeps a context that a block of the browser sets', () => {
    const live = contexts(
      `<script>${head}\nimport Provider from './Provider.brm';\nlet show = $signal(true);</script>
<button onClick=(() => (show = !show))>Toggle</button>
#if (show) {
  <Provider />
}`,
      {
        'Provider.brm': `<script>${head}\n$setContext(Words, { hello: 'Hi' });</script><Reader />`,
      },
    );
    expect(live.has('Words')).toBe(true);
  });

  it('keeps a context that a component in a block of the browser reads', () => {
    const live = contexts(
      `<script>${head}\nlet show = $signal(true);\n$setContext(Words, { hello: 'Hi' });</script>
<button onClick=(() => (show = !show))>Toggle</button>
#if (show) {
  <Reader />
}`,
    );
    expect(live.has('Words')).toBe(true);
  });

  it('keeps every context when a provider names its context by an expression', () => {
    const live = contexts(
      `<script>${head}\nconst all = { Words };\n$setContext(all['Words'], { hello: 'Hi' });</script><Reader />`,
    );
    expect(live.has('*')).toBe(true);
  });

  it('compiles a file alone with every context live', () => {
    const { server } = compile(
      `<script>${head}\n$setContext(Words, { hello: 'Hi' });</script><Reader />`,
      { filename: 'Page.brm' },
    );
    expect(server).not.toContain(', false)');
  });
});
