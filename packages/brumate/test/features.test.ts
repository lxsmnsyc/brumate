import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

interface Built {
  /** The chunk that holds the core. */
  core: Rolldown.OutputChunk;
  chunks: Rolldown.OutputChunk[];
}

async function buildApp(
  name: string,
  source: string,
  options: BrumateOptions = {},
): Promise<Built> {
  const root = fileURLToPath(new URL(`./.output/features/${name}/`, import.meta.url));
  rmSync(root, { recursive: true, force: true });
  mkdirSync(`${root}src`, { recursive: true });
  writeFileSync(`${root}src/App.brm`, source);
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
