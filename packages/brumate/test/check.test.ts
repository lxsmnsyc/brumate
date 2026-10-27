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
    expect(code).toMatch(
      /^export default \$\$Component;\nasync function \$\$Component\(\$\$props: \(\{ label: string \}\)/,
    );
    expect(code).toContain('const { label } = $props<{ label: string }>();');
    // A direct call checks the props as a fresh object, so a prop that Badge does not take is an error.
    expect(code).toContain('Badge({ label: (label), });');
  });

  it('types the props from every call of $props', () => {
    const code = body(
      "<script>\n  import { $props } from 'brumate/signals';\n  const { label } = $props<{ label: string }>();\n  let { open } = $props<{ open?: Bindable<boolean> }>();\n</script>",
    );
    expect(code).toMatch(
      /\(\$\$props: \(\{ label: string \}\) & \(\{ open\?: Bindable<boolean> \}\),/,
    );
  });

  it('names a prop of a shorthand by the name after its brace', () => {
    const code = body(
      "<script>\n  import { $props } from 'brumate/signals';\n  import Badge from './Badge.brm';\n  const { label, onPick } = $props<{ label: string; onPick: () => void }>();\n</script>\n\n<Badge {label} {onPick} />",
    );
    expect(code).toContain('Badge({ label: (label), onPick: (onPick), });');
  });

  it('names the component function so that the file can import its component name', () => {
    const { code } = toTypeScript(
      "<script>\n  import { SignIn } from './auth.ts';\n</script>\n\n<p>{SignIn()}</p>",
      'sign-in.brm',
    );
    expect(code).not.toMatch(/function SignIn\b/);
    expect(code).not.toMatch(/\bSignIn\.brumateId/);
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

  it('checks the expression and the body of #offscreen', () => {
    const code = body(`<script>
  import { $signal } from 'brumate/signals';
  let tab = $signal(1);
</script>

#offscreen (tab === 1) {
  <p>{tab}</p>
}`);
    expect(code).toContain('$$use((tab === 1));\n{\n$$use((tab));\n}');
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

describe('await', () => {
  it('keeps await of a memo, so its type is the value, and makes templates async', () => {
    const code = body(`<script>
  import { $memo, $signal } from 'brumate/signals';
  let id = $signal(1);
  const user = await $memo(Promise.resolve({ name: 'Ada', id }));
  const tags = $memo(Promise.resolve(['a']));
</script>

#template row(n: number) {
  <td>{(await tags)[n]}</td>
}
<p>{user.name} {(await tags).length} {row(0)}</p>`);
    expect(code).toContain("const user = await $memo(Promise.resolve({ name: 'Ada', id }));");
    expect(code).toContain('$$use((user.name));');
    expect(code).toContain('$$use(((await tags).length));');
    expect(code).toContain('async function row(n: number): Promise<$$Markup> {');
  });
});

describe('signals that bind to a ref', () => {
  const script = `<script>
  import { $signal } from 'brumate/signals';
  import Toolbar from './Toolbar.brm';
  let el = $signal<HTMLElement>();
  let fn = $signal<() => void>();
</script>
`;

  it('lets a signal that only a ref of a component binds hold an element', () => {
    const code = body(`${script}<Toolbar ref=$bind(el) />`);
    expect(code).not.toContain('$$sendable(el');
    expect(code).toContain('$$sendableRef(el');
  });

  it('still checks a function in a signal that only a ref of a component binds', () => {
    const code = body(`${script}<Toolbar ref=$bind(fn) />`);
    expect(code).not.toContain('$$sendable(fn');
    expect(code).toContain('$$sendableRef(fn');
  });

  it('checks a signal that a ref of a component and another prop bind', () => {
    const code = body(`${script}<Toolbar ref=$bind(el) other=$bind(el) />`);
    expect(code).toContain('$$sendable(el');
  });

  it('checks a signal that another prop binds', () => {
    const code = body(`${script}<Toolbar value=$bind(fn) />`);
    expect(code).toContain('$$sendable(fn');
  });
});
