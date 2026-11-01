import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { getFeatures, joinFeatures, noFeatures, writeFeatures } from '../src/features.ts';
import type { Features } from '../src/features.ts';
import { renderToStream } from '../src/runtime/server.ts';

// The features of the core that a component uses, which turn the code of the others off.

const use = (source: string) => getFeatures(compile(source, { filename: 'App.brm' }));

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
#loading {
  <p>{value}</p>
} #else {
  <p>Loading</p>
}
#defer ('visible') {
  <p ref=$bind(el)>Later</p>
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

const fixture = (name: string) =>
  getFeatures(
    compile(readFileSync(new URL(`render/${name}.brm`, import.meta.url), 'utf8'), {
      filename: `${name}.brm`,
    }),
  );

it('counts the fields of a $bind that reaches an element through a spread', () => {
  // The server writes `input=$bind#…` for the spread at run time, so it is not in the output.
  const joined = joinFeatures([fixture('bindSpread'), fixture('BindField')]);
  expect(joined.fields).toBe(true);
  expect(
    use(`<script>
  import { $bind, $signal } from 'brumate/signals';
  let name = $signal('');
</script>
<input value=$bind(name)>
`).fields,
  ).toBe(true);
  expect(
    use(`<script>
  import { $signal } from 'brumate/signals';
  let name = $signal('');
</script>
<input value=name onInput=((event) => (name = event.currentTarget.value))>
`).fields,
  ).toBe(false);
});

it('counts the route contexts, from $route and from brumate/context', () => {
  expect(
    use(`<script>
  import { $route } from 'brumate/signals';
  const route = $route('/issues/[id]');
</script>
<p>{route.params.id}</p>
`).routes,
  ).toBe(true);
  expect(
    use(`<script>
  import { $getContext } from 'brumate/signals';
  import { routeContext } from 'brumate/context';
  const route = $getContext(routeContext);
</script>
<p>{route.url.pathname}</p>
`).routes,
  ).toBe(true);
  expect(
    use(`<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
</script>
<button onClick=(() => count++)>{count}</button>
`).routes,
  ).toBe(false);
});

it('counts #try only when a component has one', () => {
  const tried = use(`<script>
  import { $signal } from 'brumate/signals';
  let open = $signal(false);
</script>
#try {
  <p>{String(open)}</p>
} #catch (error) {
  <p>Failed</p>
}
`);
  expect(tried.tries).toBe(true);
  // A block that is not a #try, with a #loading beside it, does not count.
  expect(
    use(`<script>
  import { $memo, $signal } from 'brumate/signals';
  async function slow() { 'use server'; return 1; }
  const value = $memo(slow());
  let open = $signal(false);
</script>
#loading {
  <p>{value}</p>
} #else {
  <p>Loading</p>
}
#if (open) {
  <p>Open</p>
}
`).tries,
  ).toBe(false);
});

it('counts windowed lists and no other list', () => {
  const windowed = fixture('windowed');
  expect(windowed.windows).toBe(true);
  expect(
    use(`<script>
  import { $signal } from 'brumate/signals';
  let rows = $signal([{ id: 1 }]);
</script>
<ul>
  #for (row of rows by row.id) {
    <li>{row.id}</li>
  }
</ul>
`).windows,
  ).toBe(false);
});

it('counts dynamic tags, and no static tag', () => {
  expect(fixture('AsButton').dynamic).toBe(true);
  expect(
    use(`<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
</script>
<section><button onClick=(() => count++)>{count}</button></section>
`).dynamic,
  ).toBe(false);
});

it('counts a $bind that a component passes on, and not the $bind of a ref', () => {
  // `ref=$bind(el)` sets a variable and reads no field.
  expect(fixture('blocks').fields).toBe(false);
  expect(
    use(`<script>
  import { $bind, $signal } from 'brumate/signals';
  import Field from './Field.brm';
  let name = $signal('');
</script>
<Field value=$bind(name) />
`).fields,
  ).toBe(true);
});

it('counts $navigation from brumate/context', () => {
  expect(
    use(`<script>
  import { $getContext } from 'brumate/signals';
  import { navigationContext } from 'brumate/context';
  const navigation = $getContext(navigationContext);
</script>
<p>{String(navigation.pending)}</p>
`).routes,
  ).toBe(true);
});

// What the server writes for the browser is tied to the flags: a build without a flag leaves out
// the code that reads it. Every render fixture is rendered on the server, and each marker in its
// HTML must come with the flag of the build, which joins the fixture and the components it imports.

const fixtures = new URL('render/', import.meta.url);
const rendered = new URL('.output/feature-flags/', import.meta.url);

/** The names of the components that a source imports, with the extension. */
function importsOf(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/from '\.\/([\w-]+\.brm)'/g)) {
    names.push(match[1]!);
  }
  return names;
}

/** The text of a stream, up to what it gave when a promise never settles. */
async function drain(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let text = '';
  const deadline = Date.now() + 400;
  while (Date.now() < deadline) {
    // oxlint-disable-next-line no-await-in-loop -- Each chunk comes after the one before.
    const chunk = await Promise.race([
      reader.read(),
      new Promise<undefined>((done) => setTimeout(done, 100)),
    ]);
    if (!chunk || chunk.done) {
      break;
    }
    text += chunk.value;
  }
  void reader.cancel().catch(() => {});
  return text;
}

describe('what the server writes against the flags of the build', () => {
  const found = { fields: 0, tries: 0, lateMarkup: 0 };
  const names = readdirSync(fixtures).filter((name) => name.endsWith('.brm'));
  const sources = new Map(
    names.map((name) => [name, readFileSync(new URL(name, fixtures), 'utf8')]),
  );
  const own = new Map<string, Features>();

  beforeAll(async () => {
    rmSync(rendered, { recursive: true, force: true });
    mkdirSync(rendered, { recursive: true });
    const liveProps = analyzeProject(sources);
    for (const name of readdirSync(fixtures)) {
      if (!name.endsWith('.brm')) {
        copyFileSync(new URL(name, fixtures), new URL(name, rendered));
        continue;
      }
      const result = compile(sources.get(name)!, {
        filename: name,
        liveProps: liveProps.get(name),
        path: fileURLToPath(new URL(name, fixtures)),
        sendableClasses: ['Money'],
      });
      own.set(name, getFeatures(result));
      writeFileSync(new URL(`${name}.ts`, rendered), result.server.replace(/\.brm'/g, ".brm.ts'"));
    }
  }, 60_000);

  /** The features of a component and of everything it imports. */
  function build(name: string, seen = new Set<string>()): Features[] {
    if (seen.has(name) || !own.has(name)) {
      return [];
    }
    seen.add(name);
    const all = [own.get(name)!];
    for (const child of importsOf(sources.get(name)!)) {
      all.push(...build(child, seen));
    }
    return all;
  }

  it.each(names)('%s', async (name) => {
    let html = '';
    try {
      const module = await import(new URL(`${name}.ts`, rendered).href);
      html = await drain(renderToStream(module.default, {}));
    } catch {
      // A fixture that needs props to render has nothing to check.
      return;
    }
    const joined = joinFeatures(build(name));
    const writes = {
      fields: /=\$bind#|=\$set:/.test(html),
      tries: /\bb-catch=/.test(html),
      lateMarkup: /\bb-fail=/.test(html),
    };
    for (const flag of ['fields', 'tries', 'lateMarkup'] as const) {
      found[flag] += writes[flag] ? 1 : 0;
      // A page that writes the marker needs the flag, and a page without it may have it.
      expect(!writes[flag] || joined[flag], `${name} writes the marker of ${flag}`).toBe(true);
    }
  });

  it('rendered each kind of marker at least once, so the check can fail', () => {
    expect(found.fields).toBeGreaterThan(0);
    expect(found.tries).toBeGreaterThan(0);
    expect(found.lateMarkup).toBeGreaterThan(0);
  });
});
