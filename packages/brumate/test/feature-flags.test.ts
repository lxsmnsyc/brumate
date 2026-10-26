import { expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import { featuresOf, joinFeatures, noFeatures, writeFeatures } from '../src/features.ts';

// The features of the core that a component uses, which turn the code of the others off.

const use = (source: string) => featuresOf(compile(source, { filename: 'App.brm' }));

it('finds the children that the browser renders, the templates that it calls, titles and HTML', () => {
  const plain = use(`<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
</script>
<button onClick=(() => count++)>{count}</button>
`);
  expect(plain).toEqual(noFeatures());
  const titled = use(`<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
</script>
#head { <title>{\`\${count}\`}</title> }
<button onClick=(() => count++)>{count}</button>
`);
  expect(titled.titles).toBe(true);
  const templated = use(`<script>
  import { $signal } from 'brumate/signals';
  import List from './List.brm';
  let count = $signal(0);
</script>
#template row(x: number) {
  <b>{x}</b>
}
<List render=row />
<button onClick=(() => count++)>{count}</button>
`);
  expect(templated.templates).toBe(true);
  // A `#head` block and a template clone in the browser. A `#try` renders HTML.
  expect(titled.clientHTML).toBe(false);
  expect(templated.clientHTML).toBe(false);
  const tried = use(`<script>
  import { $signal } from 'brumate/signals';
  let open = $signal(false);
</script>
<button onClick=(() => (open = !open))>Open</button>
#if (open) {
  #try {
    <p>{String(open)}</p>
  } #catch (error) {
    <p>Failed</p>
  }
}
`);
  expect(tried.clientHTML).toBe(true);
  expect(joinFeatures([plain, titled, templated])).toEqual({
    ...noFeatures(),
    templates: true,
    titles: true,
  });
  const bound = use(`<script>
  import { $bind, $signal } from 'brumate/signals';
  import Field from './Field.brm';
  let name = $signal('');
</script>
<Field value=$bind(name) />
`);
  expect(bound.bindings).toBe(true);
});

it('writes the features into the code that reads them, and keeps their declarations', () => {
  const code = [
    'declare const __BRUMATE_HAS_TITLES__: boolean | undefined;',
    "export const HAS_TITLES = typeof __BRUMATE_HAS_TITLES__ === 'undefined' || __BRUMATE_HAS_TITLES__;",
  ].join('\n');
  const written = writeFeatures(code, {
    ...noFeatures(),
    children: true,
    templates: true,
    bindings: true,
  });
  expect(written).toContain('declare const __BRUMATE_HAS_TITLES__');
  expect(written).toContain("typeof false === 'undefined' || false");
});

it('finds markup that comes later, blocks, listeners and forms of an $action', () => {
  const late = use(`<script>
  import { $action, $client, $memo, $signal } from 'brumate/signals';
  async function slow() { 'use server'; return 1; }
  async function sign(form: FormData) { 'use server'; return 1; }
  const value = $memo(slow());
  const signed = $action(sign);
  let el = $signal<HTMLElement>();
  $client(() => { el; }, 'visible');
</script>
#loading (value) {
  <p>{value}</p>
} #else {
  <p>Loading</p>
}
#defer ('visible') {
  <p ref=el>Later</p>
}
<form action=sign><button>Go</button></form>
`);
  expect(late).toMatchObject({ lateMarkup: true, blocks: true, actions: true, listeners: false });
});

it('finds the titles, listeners and forms of a #client body, which has no markup on the server', () => {
  const inClient = use(`<script>
  import { $action, $signal } from 'brumate/signals';
  async function sign(form: FormData) { 'use server'; return 1; }
  const signed = $action(sign);
  let count = $signal(0);
</script>
#client ('idle') {
  #head {
    <title>{\`Count \${count}\`}</title>
  }
  <window onKeyDown=(() => count++) />
  <form action=sign><button>Go</button></form>
}
`);
  expect(inClient).toMatchObject({ titles: true, listeners: true, actions: true, blocks: true });
});
