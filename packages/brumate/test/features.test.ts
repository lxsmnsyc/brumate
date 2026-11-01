import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { Rolldown } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import brumate from '../src/vite.ts';
import type { BrumateOptions } from '../src/vite.ts';

// The core keeps only the helpers that the compiled components of a build call. These tests
// build apps with and without some features, and read what the chunk of the core holds.

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));
const core = runtime('client');

const COUNTER = `<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
</script>

<button onClick=(() => count++)>{count}</button>
`;

const FEATURES = `<script>
  import { $signal } from 'brumate/signals';
  let items = $signal(['a']);
  let open = $signal(false);
</script>

<button onClick=(() => (items = [...items, 'b']))>Add</button>
<button onClick=(() => (open = !open))>Toggle</button>
<ul>
  #for (item of items) {
    <li>{item}</li>
  }
</ul>
#if (open) {
  #portal ('body') {
    <p>Portal</p>
  }
}
`;

const TITLED = `<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
</script>

#head {
  <title>{\`Count \${count}\`}</title>
}
<button onClick=(() => count++)>{count}</button>
`;

interface Built {
  /** The chunk that holds the core. */
  core: Rolldown.OutputChunk;
  chunks: Rolldown.OutputChunk[];
}

async function buildApp(
  name: string,
  source: string,
  options: BrumateOptions = {},
  // More files, by their paths from the root.
  more: Record<string, string> = {},
): Promise<Built> {
  const root = fileURLToPath(new URL(`./.output/features/${name}/`, import.meta.url));
  rmSync(root, { recursive: true, force: true });
  mkdirSync(`${root}src`, { recursive: true });
  writeFileSync(`${root}src/App.brm`, source);
  for (const [file, text] of Object.entries(more)) {
    mkdirSync(path.dirname(`${root}${file}`), { recursive: true });
    writeFileSync(`${root}${file}`, text);
  }
  writeFileSync(`${root}src/client.ts`, "import 'virtual:brumate/start';\n");
  const result = (await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [brumate(options)],
    resolve: {
      alias: {
        'brumate/client': core,
        'brumate/loader': runtime('loader'),
        'brumate/static-loader': runtime('static-loader'),
        'brumate/context': runtime('context'),
        'brumate/signals': runtime('signals'),
      },
    },
    // The chunk of the core keeps the names of its exports, so the tests can read them.
    build: {
      write: false,
      minify: true,
      rolldownOptions: { input: 'src/client.ts', output: { minifyInternalExports: false } },
    },
  })) as Rolldown.RolldownOutput;
  const chunks = result.output.filter(
    (item): item is Rolldown.OutputChunk => item.type === 'chunk',
  );
  return { core: chunks.find((chunk) => chunk.moduleIds.includes(core))!, chunks };
}

const TRIES = `<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
</script>

#try {
  <button onClick=(() => count++)>{count}</button>
} #catch (error) {
  <p>Failed</p>
}
`;
const FIELDS = `<script>
  import { $bind, $signal } from 'brumate/signals';
  let name = $signal('');
</script>

<input value=$bind(name)>
<p>{name}</p>
`;
const WINDOWS = readFileSync(
  fileURLToPath(new URL('render/windowed.brm', import.meta.url)),
  'utf8',
);
const DYNAMIC = `<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
  const { as } = { as: 'button' };
</script>

<{as} onClick=(() => count++)>{count}</>
`;
const ROUTES = `<script>
  import { $route } from 'brumate/signals';
  const route = $route();
</script>

<p>{route.url.pathname}</p>
`;

describe('features of the core', () => {
  // A production build, as Vite makes one when `NODE_ENV` is not `test`.
  beforeAll(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('leaves out what a counter without client navigation does not use', async () => {
    const { core: chunk, chunks } = await buildApp('counter', COUNTER, { navigate: false });
    expect(chunk.exports).toEqual(expect.arrayContaining(['get', 'content', 'update']));
    for (const name of [
      // Updates of blocks that the component has none of.
      'list',
      'branch',
      'portalTo',
      'addPortal',
      'addHead',
      'rekey',
      'reset',
      'fill',
      'offscreen',
      // `$optimistic`, `$produce`, context and props of child components.
      'guess',
      'produce',
      'updateContext',
      'prop',
      // Hot updates and client navigation.
      'forget',
      'remount',
      'leavePage',
    ]) {
      expect(chunk.exports).not.toContain(name);
    }
    // The devtools hooks are only for the dev server.
    expect(chunk.code).not.toContain('brumate.devtools');
    // `$optimistic` sets its code up on the first guess.
    expect(chunk.code).not.toContain('same:');
    // The code of hidden `#offscreen` bodies is only in the bundle of a page that has one.
    expect(chunk.code).not.toContain('important');
    // The code that reads the pages that navigation adds is not in the bundle.
    expect(chunks.some((item) => item.moduleIds.includes(runtime('client-routes')))).toBe(false);
    // No component has a <title> or a #template that the browser calls, so their code is out
    // of the core.
    expect(chunk.code).not.toContain('title[b-t]');
    expect(chunk.code).not.toContain('#t\\d');
    // Nothing comes after the page, so the core does not watch it for markup.
    expect(chunk.code).not.toContain('MutationObserver');
  });

  it('keeps the code of a <title> of a component that a component imports from outside the root', async () => {
    const source = `<script>
  import Titled from '../../titled-shared/Titled.brm';
</script>

<Titled />
`;
    const { core: chunk } = await buildApp(
      'imported',
      source,
      { navigate: false },
      {
        '../titled-shared/Titled.brm': TITLED,
      },
    );
    expect(chunk.code).toContain('title[b-t]');
  });

  it('keeps the code of markup that comes later for a route with _loading.brm', async () => {
    const { core: chunk } = await buildApp(
      'loading',
      COUNTER,
      { navigate: false },
      {
        'src/routes/index.brm': COUNTER,
        'src/routes/_loading.brm': '<p>Loading</p>\n',
      },
    );
    expect(chunk.code).toContain('MutationObserver');
  });

  it('keeps the code of a <title> in markup when a component has one', async () => {
    const { core: chunk } = await buildApp('title', TITLED, { navigate: false });
    expect(chunk.code).toContain('title[b-t]');
  });

  it('keeps the updates that the components call, and the code of client navigation', async () => {
    const { core: chunk, chunks } = await buildApp('features', FEATURES);
    expect(chunk.exports).toEqual(expect.arrayContaining(['list', 'branch', 'portalTo']));
    // Client navigation loads it with the core, after a navigation.
    const routes = chunks.find((item) => item.moduleIds.includes(runtime('client-routes')));
    expect(routes).toBeDefined();
    expect(chunk.moduleIds).not.toContain(runtime('client-routes'));
  });
});

const codeOf = async (name: string, source: string, options: BrumateOptions = {}) =>
  (await buildApp(name, source, { navigate: false, ...options })).core.code;

describe('the five flags of paths that apps rarely use', () => {
  beforeAll(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  // A string of the core that only the code of the flag has.
  it.each([
    ['tries', TRIES, 'b-catch'],
    ['fields', FIELDS, '=$bind#'],
    ['routes', ROUTES, 'b-params'],
  ])(
    '%s: the core keeps its code for a build that uses it, and leaves it out for others',
    async (name, source, marker) => {
      expect(await codeOf(`${name}-on`, source)).toContain(marker);
      expect(await codeOf(`${name}-off`, COUNTER)).not.toContain(marker);
      // A build with every feature keeps it too.
      expect(await codeOf(`${name}-all`, COUNTER, { features: 'all' })).toContain(marker);
    },
  );

  // The code of these has no string of its own. A build that uses the path keeps more of the core
  // than the features that 'all' would add to a counter.
  it.each([
    ['windows', WINDOWS],
    ['dynamic', DYNAMIC],
  ])(
    '%s: the core keeps its code for a build that uses it, and leaves it out for others',
    async (name, source) => {
      const all = (await codeOf(`${name}-counter-all`, COUNTER, { features: 'all' })).length;
      const counter = (await codeOf(`${name}-counter`, COUNTER)).length;
      const allUsing = (await codeOf(`${name}-all`, source, { features: 'all' })).length;
      const using = (await codeOf(`${name}-on`, source)).length;
      // What the build drops, against what the same build drops when it uses the path.
      expect(all - counter - (allUsing - using)).toBeGreaterThan(500);
    },
  );

  it('turns routes on with client navigation, which writes the route into the page', async () => {
    const code = (await buildApp('routes-navigate', COUNTER)).core.code;
    expect(code).toContain('b-params');
  });

  it('keeps the fields of a page that uses an @brumate/ui Input with a $bind', async () => {
    const source = `<script>
  import { $bind, $signal } from 'brumate/signals';
  import Input from '../../../../../../ui/src/Input.brm';
  let name = $signal('');
</script>

<Input aria-label="Name" value=$bind(name) />
<p>{name}</p>
`;
    // The Input spreads its rest props onto the <input>, so the page has no `=$bind#` of its own.
    expect(await codeOf('ui-input', source)).toContain('=$bind#');
    expect(await codeOf('ui-input-counter', COUNTER)).not.toContain('=$bind#');
  });
});
