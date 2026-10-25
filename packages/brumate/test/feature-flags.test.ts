import { expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import { featuresOf, joinFeatures, writeFeatures } from '../src/features.ts';

// The features of the core that a component uses, which turn the code of the others off.

const use = (source: string) => featuresOf(compile(source, { filename: 'App.brm' }));

it('finds the children that the browser renders, the templates that it calls, and titles', () => {
  const plain = use(`<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
</script>
<button onClick=(() => count++)>{count}</button>
`);
  expect(plain).toEqual({ children: false, templates: false, titles: false, bindings: false });
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
  expect(joinFeatures([plain, titled, templated])).toEqual({
    children: false,
    templates: true,
    titles: true,
    bindings: false,
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
    children: true,
    templates: true,
    titles: false,
    bindings: true,
  });
  expect(written).toContain('declare const __BRUMATE_HAS_TITLES__');
  expect(written).toContain("typeof false === 'undefined' || false");
});
