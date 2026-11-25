import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, createBuilder, createServer } from 'vite';
import type { InlineConfig, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { START_URL, devScripts, entryScript } from '../../src/routes.ts';
import brumate from '../../src/vite.ts';

// The builds of the client and the server take more than the default 5s on a CI runner.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../../src/runtime/${name}.ts`, import.meta.url));

const app = fileURLToPath(new URL('../.output/default-scripts/', import.meta.url));

type Handle = (request: Request, options?: { scripts?: string }) => Promise<Response | undefined>;

function writeApp(): void {
  rmSync(app, { recursive: true, force: true });
  mkdirSync(`${app}src/routes`, { recursive: true });
  writeFileSync(
    `${app}src/client.ts`,
    "import { start } from 'brumate/loader';\nimport { load } from 'virtual:brumate/manifest';\nstart({ load });\n",
  );
  writeFileSync(`${app}src/server.ts`, "export { handle } from 'virtual:brumate/routes';\n");
  writeFileSync(
    `${app}src/routes/index.brm`,
    [
      '<script>',
      "  import { $signal } from 'brumate/signals';",
      '  let count = $signal(0);',
      '</script>',
      '',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <button onClick=(() => count++)>Count {count}</button>',
      '  </body>',
      '</html>',
      '',
    ].join('\n'),
  );
}

const config: InlineConfig = {
  root: app,
  configFile: false,
  logLevel: 'silent',
  plugins: [brumate({ merge: 0 })],
  resolve: {
    alias: {
      'brumate/server': runtime('server'),
      'brumate/client': runtime('client'),
      'brumate/loader': runtime('loader'),
      'brumate/static-loader': runtime('static-loader'),
      'brumate/bundles': runtime('bundles'),
      'brumate/signals': runtime('signals'),
      'brumate/hot': runtime('hot'),
      'brumate/routes': runtime('routes'),
      'brumate/context': runtime('context'),
      'brumate/events': runtime('events'),
      'brumate/serial': runtime('values'),
      'brumate/stream': runtime('gather'),
    },
  },
};

async function text(handle: Handle, options?: { scripts?: string }): Promise<string> {
  const response = await handle(new Request('http://localhost/'), options);
  expect(response?.status).toBe(200);
  return await response!.text();
}

function buildClient(outDir: string): Promise<unknown> {
  return build({
    ...config,
    build: { outDir, rolldownOptions: { input: 'src/client.ts' } },
  });
}

function buildServer(outDir: string): Promise<unknown> {
  return build({
    ...config,
    build: { outDir, ssr: true, rolldownOptions: { input: { server: 'src/server.ts' } } },
  });
}

beforeAll(() => {
  writeApp();
});

function customConfig(): InlineConfig {
  return { ...config, plugins: [brumate({ merge: 0, clientOutDir: 'out/public' })] };
}

describe('the scripts of the dev server', () => {
  let dev: ViteDevServer | undefined;
  afterAll(async () => {
    await dev?.close();
  });

  it('are the client of Vite and the start module', async () => {
    dev = await createServer({ ...config, appType: 'custom', server: { middlewareMode: true } });
    const { handle } = (await dev.ssrLoadModule('virtual:brumate/routes')) as { handle: Handle };
    const html = await text(handle);
    expect(html).toContain('<script type="module" src="/@vite/client"></script>');
    expect(html).toContain(`<script type="module" src="${START_URL}"></script>`);
    expect(html).toContain(devScripts());
    // The scripts come after the page state, in the tail of the page.
    expect(html.indexOf('/@vite/client')).toBeGreaterThan(html.indexOf('Count'));
  });

  it('sit under the base', async () => {
    const based = await createServer({
      ...config,
      base: '/app/',
      appType: 'custom',
      server: { middlewareMode: true },
    });
    try {
      const { handle } = (await based.ssrLoadModule('virtual:brumate/routes')) as {
        handle: Handle;
      };
      const html = await text(handle);
      expect(html).toContain('<script type="module" src="/app/@vite/client"></script>');
      expect(html).toContain(`<script type="module" src="/app${START_URL}"></script>`);
    } finally {
      await based.close();
    }
  });

  it('give way to the scripts of the caller', async () => {
    dev ??= await createServer({ ...config, appType: 'custom', server: { middlewareMode: true } });
    const { handle } = (await dev.ssrLoadModule('virtual:brumate/routes')) as { handle: Handle };
    const own = await text(handle, { scripts: '<script src="/own.js"></script>' });
    expect(own).toContain('<script src="/own.js"></script>');
    expect(own).not.toContain('/@vite/client');
    const none = await text(handle, { scripts: '' });
    expect(none).not.toContain('/@vite/client');
    expect(none).not.toContain(START_URL);
  });
});

describe('the scripts of a build', () => {
  it('name the hashed entry of the client build', async () => {
    await buildClient('dist/client');
    await buildServer('dist/server');
    const manifest = JSON.parse(readFileSync(`${app}dist/client/.vite/manifest.json`, 'utf8')) as {
      isEntry?: boolean;
      file: string;
    }[];
    let file = '';
    for (const chunk of Object.values(manifest)) {
      if (chunk.isEntry) {
        file = chunk.file;
      }
    }
    expect(file).toMatch(/^assets\/.+-[\w-]+\.js$/);
    const { handle } = (await import(pathToFileURL(`${app}dist/server/server.js`).href)) as {
      handle: Handle;
    };
    const html = await text(handle);
    expect(html).toContain(entryScript('/', file));
    expect(html).not.toContain('/@vite/client');
    // An explicit empty string names nothing.
    const none = await text(handle, { scripts: '' });
    expect(none).not.toContain(entryScript('/', file));
    expect(none).not.toContain('<script type="module"');
  });

  it('read the client build from the directory that clientOutDir names', async () => {
    rmSync(`${app}out`, { recursive: true, force: true });
    await build({
      ...customConfig(),
      build: { outDir: 'out/public', rolldownOptions: { input: 'src/client.ts' } },
    });
    await build({
      ...customConfig(),
      build: {
        outDir: 'out/server',
        ssr: true,
        rolldownOptions: { input: { server: 'src/server.ts' } },
      },
    });
    const { handle } = (await import(pathToFileURL(`${app}out/server/server.js`).href)) as {
      handle: Handle;
    };
    const html = await text(handle);
    expect(html).toMatch(
      /<script type="module" async src="\/assets\/client-[\w-]+\.js"><\/script>/,
    );
  });

  it('warn when the build ID of the server is not the one of the client build', async () => {
    const warnings: string[] = [];
    process.env.BRUMATE_BUILD = 'other-build';
    try {
      await build({
        ...customConfig(),
        customLogger: {
          info() {},
          warn: (message) => warnings.push(message),
          warnOnce: (message) => warnings.push(message),
          error() {},
          clearScreen() {},
          hasErrorLogged: () => false,
          hasWarned: false,
        },
        build: {
          outDir: 'out/server2',
          ssr: true,
          rolldownOptions: { input: { server: 'src/server.ts' } },
        },
      });
    } finally {
      delete process.env.BRUMATE_BUILD;
    }
    expect(warnings.join('\n')).toMatch(/is not the .* of out\/public.*skew protection/s);
  });

  it('build every server environment from one manifest read', async () => {
    rmSync(`${app}out`, { recursive: true, force: true });
    const builder = await createBuilder({
      ...config,
      plugins: [brumate({ merge: 0, clientOutDir: 'out/client' })],
      // Like Nitro, which builds the client, then each server environment.
      builder: {
        sharedConfigBuild: true,
        async buildApp(app) {
          for (const environment of Object.values(app.environments)) {
            await app.build(environment);
          }
        },
      },
      environments: {
        client: {
          build: { outDir: 'out/client', rolldownOptions: { input: 'src/client.ts' } },
        },
        ssr: {
          consumer: 'server',
          build: {
            outDir: 'out/ssr',
            ssr: true,
            rolldownOptions: { input: { server: 'src/server.ts' } },
          },
        },
        edge: {
          consumer: 'server',
          build: {
            outDir: 'out/edge',
            ssr: true,
            rolldownOptions: { input: { server: 'src/server.ts' } },
          },
        },
      },
    });
    await builder.buildApp();
    for (const name of ['ssr', 'edge']) {
      const { handle } = (await import(pathToFileURL(`${app}out/${name}/server.js`).href)) as {
        handle: Handle;
      };
      expect(await text(handle)).toMatch(
        /<script type="module" async src="\/assets\/client-[\w-]+\.js"><\/script>/,
      );
    }
    // The manifest was only for the server environments, so it is gone once they are built.
    expect(existsSync(`${app}out/client/.vite/manifest.json`)).toBe(false);
  });

  it('names the new entry and drops the manifest in each round of a rebuild', async () => {
    rmSync(`${app}out`, { recursive: true, force: true });
    // The same builder, so the same resolved config, builds the app twice, as a watch does.
    // The edge environment is configured and never built.
    const builder = await createBuilder({
      ...config,
      plugins: [brumate({ merge: 0, clientOutDir: 'out/client' })],
      builder: { sharedConfigBuild: true },
      environments: {
        client: { build: { outDir: 'out/client', rolldownOptions: { input: 'src/client.ts' } } },
        ssr: {
          consumer: 'server',
          build: {
            outDir: 'out/ssr',
            ssr: true,
            rolldownOptions: { input: { server: 'src/server.ts' } },
          },
        },
        edge: {
          consumer: 'server',
          build: {
            outDir: 'out/edge',
            ssr: true,
            rolldownOptions: { input: { server: 'src/server.ts' } },
          },
        },
      },
    });
    const entries: string[] = [];
    const clientFile = `${app}src/client.ts`;
    const original = readFileSync(clientFile, 'utf8');
    try {
      for (const round of [0, 1]) {
        if (round === 1) {
          writeFileSync(clientFile, `${original}\nconsole.log('second round');\n`);
        }
        await builder.build(builder.environments.client!);
        await builder.build(builder.environments.ssr!);
        const html = readFileSync(`${app}out/ssr/server.js`, 'utf8');
        const found = /async src=\\?"(\/assets\/client-[\w-]+\.js)/.exec(html);
        expect(found).not.toBeNull();
        entries.push(found![1]!);
        expect(existsSync(`${app}out/client/.vite/manifest.json`)).toBe(false);
      }
    } finally {
      writeFileSync(clientFile, original);
    }
    expect(entries[1]).not.toBe(entries[0]);
  });

  it('fail the server build when there is no client build', async () => {
    rmSync(`${app}dist`, { recursive: true, force: true });
    await expect(buildServer('dist/server')).rejects.toThrow(
      /No client manifest.*Build the client first/s,
    );
  });
});
