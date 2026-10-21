import { describe, expect, it } from 'vitest';
import { toTypeScript } from '../src/index.ts';

/** The generated code without the helper declarations at the top. */
function body(source: string): string {
  const { code } = toTypeScript(source, 'Card.brm');
  return code.slice(code.indexOf('export default'));
}

describe('toTypeScript', () => {
  it('copies the scripts, and types the props from $props', () => {
    const code = body(
      "<script>\n  import { $props } from 'brumate/signals';\n  import Badge from './Badge.brm';\n  const { label } = $props<{ label: string }>();\n</script>\n\n<Badge label=label />",
    );
    expect(code).toMatch(/^export default async function Card\(\$\$props: \{ label: string \}/);
    expect(code).toContain('const { label } = $props<{ label: string }>();');
    expect(code).toContain('$$component(Badge, { label: (label), });');
  });

  it('puts markup in blocks that match the control flow', () => {
    const code = body(`<script>
  import { $signal } from 'brumate/signals';
  let items = $signal([1, 2]);
</script>

#for (item, i of items by item) {
  <p onClick=(() => console.log(i))>{item}</p>
} #else {
  <p>None</p>
}
#try {
  <span />
} #catch (error, reset) {
  <button onClick=reset>{String(error)}</button>
}`);
    expect(code).toContain(
      'for (const item of ( items )) {\nconst i = 0 as number;\n$$use(( item));',
    );
    expect(code).toContain('$$on("p", "click", (() => console.log(i)));');
    expect(code).toContain('} catch (error) {\nconst reset = (): void => {};');
  });

  it('maps copied code to the file', () => {
    const source =
      "<script>\n  import { $signal } from 'brumate/signals';\n  let count = $signal(0);\n</script>\n\n<p>{count + 1}</p>";
    const { code, mappings } = toTypeScript(source, 'Card.brm');
    const insert = source.indexOf('count + 1');
    const mapping = mappings.find((item) => item.source === insert)!;
    expect(code.slice(mapping.generated, mapping.generated + mapping.length)).toBe('count + 1');
  });

  it('keeps the scripts when the markup has a syntax error', () => {
    const result = toTypeScript(
      '<script>\n  const a: number = 1;\n</script>\n\n<p>{a</p>',
      'Card.brm',
    );
    expect(result.error?.message).toMatch(/Card\.brm/);
    expect(result.code).toContain('const a: number = 1;');
  });
});
