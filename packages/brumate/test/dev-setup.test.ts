import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';
import type { InlineConfig, Plugin, Rolldown } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import brumate from '../src/vite.ts';

vi.setConfig({ testTimeout: 30_000 });

const directory = fileURLToPath(new URL('./.output/dev-setup-app/', import.meta.url));
const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));

// The package resolves `brumate/loader` to its build. Here the loader comes from the source,
// and only for the modules that the plugin generates, so the plugin still sees the entry's import.
function sourceLoader(any = false): Plugin {
  return {
    name: 'source-loader',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === 'brumate/loader' && (any || importer?.startsWith('\0'))) {
        return runtime('loader');
      }
      return undefined;
    },
  };
}

function setup(): void {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(`${directory}src`, { recursive: true });
  writeFileSync(
    `${directory}src/counter.brm`,
    "<script>\n  import { $signal } from 'brumate/signals';\n\n  let count = $signal(0);\n</script>\n\n<button onClick=(() => count++)>{count}</button>\n",
  );
  writeFileSync(
    `${directory}src/client.ts`,
    [
      "import { start } from 'brumate/loader';",
      "import { load } from 'virtual:brumate/manifest';",
      'start({ load });',
      '',
    ].join('\n'),
  );
}

function configure(devtools?: boolean): InlineConfig {
  return {
    root: directory,
    configFile: false,
    logLevel: 'silent',
    plugins: [
      sourceLoader(),
      brumate({ merge: 0, ...(devtools === undefined ? {} : { devtools }) }),
    ],
    resolve: {
      alias: {
        'brumate/server': runtime('server'),
        'brumate/client': runtime('client'),
        'brumate/hot': runtime('hot'),
        'brumate/devtools': runtime('devtools'),
        'brumate/context': runtime('context'),
        'brumate/events': runtime('events'),
        'brumate/serial': runtime('values'),
        'brumate/stream': runtime('gather'),
        'brumate/store': runtime('store'),
        'brumate/bundles': runtime('bundles'),
        'brumate/static-loader': runtime('static-loader'),
      },
    },
  };
}

async function serve(devtools?: boolean) {
  return createServer({
    ...configure(devtools),
    appType: 'custom',
    server: { middlewareMode: true },
  });
}

describe('dev setup of a client entry that calls start', () => {
  it('sets up hot updates and the devtools on the dev server', async () => {
    setup();
    const dev = await serve();
    try {
      const entry = await dev.transformRequest('/src/client.ts');
      expect(entry?.code).toContain('virtual:brumate/dev-start');
      expect(entry?.code).not.toContain('brumate/loader');
      const wrapped = await dev.transformRequest('virtual:brumate/dev-start');
      expect(wrapped?.code).toContain('hotLoad(import.meta.hot, options.load)');
      expect(wrapped?.code).toContain('installDevtools');
    } finally {
      await dev.close();
    }
  });

  it('leaves the devtools out with devtools: false, and keeps hot updates', async () => {
    setup();
    const dev = await serve(false);
    try {
      const wrapped = await dev.transformRequest('virtual:brumate/dev-start');
      expect(wrapped?.code).toContain('hotLoad');
      expect(wrapped?.code).not.toContain('installDevtools');
    } finally {
      await dev.close();
    }
  });

  it('ships nothing of hot or the devtools in a build', async () => {
    setup();
    const result = (await build({
      ...configure(),
      build: {
        write: false,
        minify: false,
        rolldownOptions: { input: `${directory}src/client.ts` },
      },
      plugins: [sourceLoader(true), brumate({ merge: 0 })],
    })) as Rolldown.RolldownOutput;
    const code = result.output.map((item) => (item.type === 'chunk' ? item.code : '')).join('\n');
    expect(code).not.toContain('dev-start');
    expect(code).not.toContain('hotLoad');
    expect(code).not.toContain('installDevtools');
    expect(code).not.toContain('brumate:update');
  });
});
