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

interface HandleOptions {
  scripts?: string;
  nonce?: string;
}

type Handle = (request: Request, options?: HandleOptions) => Promise<Response | undefined>;

/** The opening tags of the scripts that load a file. */
function srcTags(html: string): string[] {
  return html.match(/<script\b[^>]*\ssrc="[^"]*"[^>]*>/g) ?? [];
}

/** Checks that every script tag that loads a file has the nonce, or that none has one. */
function expectNonce(html: string, nonce: string | undefined, count: number): void {
  const tags = srcTags(html);
  expect(tags).toHaveLength(count);
  // The attribute each tag must have, or the text that none may contain.
  const escaped = nonce?.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  const needle = nonce === undefined ? 'nonce=' : ` nonce="${escaped}"`;
  for (const tag of tags) {
    expect(tag.includes(needle)).toBe(nonce !== undefined);
  }
}

function writeApp(): void {
  rmSync(app, { recursive: true, force: true });
  mkdirSync(`${app}src/routes`, { recursive: true });
  writeFileSync(
    `${app}src/client.ts`,
    "import { start } from 'brumate/loader';\nimport { load } from 'virtual:brumate/manifest';\n(globalThis as Record<string, unknown>).clientEntryMarker = true;\nstart({ load });\n",
  );
  writeFileSync(`${app}src/zeta.ts`, "console.log('zeta');\n");
  writeFileSync(`${app}src/alpha.ts`, "console.log('alpha');\n");
  writeFileSync(`${app}page.html`, '<!doctype html><html><body></body></html>\n');
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

async function text(handle: Handle, options?: HandleOptions): Promise<string> {
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

  it('load the client entry of the app, and the start module when it has none', async () => {
    const withEntry = await createServer({
      ...config,
      appType: 'custom',
      server: { middlewareMode: true },
      build: { rolldownOptions: { input: 'src/client.ts' } },
    });
    try {
      const { handle } = (await withEntry.ssrLoadModule('virtual:brumate/routes')) as {
        handle: Handle;
      };
      const html = await text(handle);
      // The tag names the entry, so its own code runs in the browser.
      expect(html).toContain('<script type="module" src="/src/client.ts"></script>');
      expect(html).not.toContain(START_URL);
      expect(html).toContain('/@vite/client');
      const served = await withEntry.environments.client.transformRequest('/src/client.ts');
      expect(served?.code).toContain('clientEntryMarker');
    } finally {
      await withEntry.close();
    }
    // Without an entry, the start module runs, and it has no code of the app.
    dev ??= await createServer({ ...config, appType: 'custom', server: { middlewareMode: true } });
    const { handle } = (await dev.ssrLoadModule('virtual:brumate/routes')) as { handle: Handle };
    expect(await text(handle)).toContain(`src="${START_URL}"`);
  });

  it('load the entry of each form of input, the first that is not an HTML page', async () => {
    const forms: [string, InlineConfig, string][] = [
      [
        'a virtual module',
        { build: { rolldownOptions: { input: 'virtual:brumate/start' } } },
        START_URL,
      ],
      [
        'a list, zeta first',
        { build: { rolldownOptions: { input: ['src/zeta.ts', 'src/alpha.ts'] } } },
        '/src/zeta.ts',
      ],
      [
        'a list, alpha first',
        { build: { rolldownOptions: { input: ['src/alpha.ts', 'src/zeta.ts'] } } },
        '/src/alpha.ts',
      ],
      [
        'an HTML page first',
        { build: { rolldownOptions: { input: ['page.html', 'src/zeta.ts'] } } },
        '/src/zeta.ts',
      ],
      ['only an HTML page', { build: { rolldownOptions: { input: 'page.html' } } }, START_URL],
      [
        'an object',
        { build: { rolldownOptions: { input: { main: 'src/zeta.ts' } } } },
        '/src/zeta.ts',
      ],
      [
        'the input of the environment',
        { environments: { client: { input: 'src/alpha.ts' } } },
        '/src/alpha.ts',
      ],
      [
        'the input of the environment before that of the build',
        {
          environments: { client: { input: 'src/alpha.ts' } },
          build: { rolldownOptions: { input: 'src/zeta.ts' } },
        },
        '/src/alpha.ts',
      ],
    ];
    for (const [, extra, url] of forms) {
      // oxlint-disable-next-line no-await-in-loop -- Each server closes before the next starts.
      const server = await createServer({
        ...config,
        ...extra,
        appType: 'custom',
        server: { middlewareMode: true },
      });
      try {
        // oxlint-disable-next-line no-await-in-loop -- As above.
        const { handle } = (await server.ssrLoadModule('virtual:brumate/routes')) as {
          handle: Handle;
        };
        // oxlint-disable-next-line no-await-in-loop -- As above.
        const html = await text(handle);
        expect(html).toContain(`<script type="module" src="${url}"></script>`);
      } finally {
        // oxlint-disable-next-line no-await-in-loop -- As above.
        await server.close();
      }
    }
  });

  it('carry the nonce of the render, and only then', async () => {
    dev ??= await createServer({ ...config, appType: 'custom', server: { middlewareMode: true } });
    const { handle } = (await dev.ssrLoadModule('virtual:brumate/routes')) as { handle: Handle };
    expectNonce(await text(handle, { nonce: 'abc123' }), 'abc123', 2);
    expectNonce(await text(handle), undefined, 2);
    // A nonce is attribute text, so a quote in it does not end the attribute.
    const odd = await text(handle, { nonce: 'a"b' });
    expect(odd).toContain(' nonce="a&quot;b"');
    // A `$` in a nonce is text: it is not a pattern of a replacement.
    for (const dollar of ['n$&x', "a$'b", 'c$`d', 'e$$f']) {
      expectNonce(await text(handle, { nonce: dollar }), dollar, 2);
    }
    // The scripts of the caller are written as they are.
    const own = await text(handle, { nonce: 'abc123', scripts: '<script src="/own.js"></script>' });
    expect(own).toContain('<script src="/own.js"></script>');
    expect(own).not.toContain('/@vite/client');
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
    // The entry tag carries the nonce of the render, and has none without one.
    expectNonce(await text(handle, { nonce: 'abc123' }), 'abc123', 1);
    expectNonce(html, undefined, 1);
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

  it('name the entry that dev loads, in any order of the inputs', async () => {
    const cases: [string[], string][] = [
      [['src/zeta.ts', 'src/alpha.ts'], 'zeta'],
      [['src/alpha.ts', 'src/zeta.ts'], 'alpha'],
      [['page.html', 'src/zeta.ts'], 'zeta'],
    ];
    let round = 0;
    for (const [input, marker] of cases) {
      round += 1;
      rmSync(`${app}out`, { recursive: true, force: true });
      // oxlint-disable-next-line no-await-in-loop -- Each case builds into the same folders.
      await build({
        ...customConfig(),
        build: { outDir: 'out/public', rolldownOptions: { input } },
      });
      // oxlint-disable-next-line no-await-in-loop -- As above.
      await build({
        ...customConfig(),
        build: {
          outDir: 'out/server',
          ssr: 'src/server.ts',
          rolldownOptions: { input },
        },
      });
      // oxlint-disable-next-line no-await-in-loop -- As above.
      const { handle } = (await import(
        `${pathToFileURL(`${app}out/server/server.js`).href}?round=${round}`
      )) as { handle: Handle };
      // oxlint-disable-next-line no-await-in-loop -- As above.
      const html = await text(handle);
      const file = /src="\/(assets\/[^"]+)"/.exec(html)?.[1] ?? '';
      expect(readFileSync(`${app}out/public/${file}`, 'utf8')).toContain(marker);
    }
    // The input of the environment is the entry as well.
    rmSync(`${app}out`, { recursive: true, force: true });
    await build({
      ...customConfig(),
      environments: { client: { input: ['src/zeta.ts', 'src/alpha.ts'] } },
      build: { outDir: 'out/public' },
    });
    await build({
      ...customConfig(),
      environments: { client: { input: ['src/zeta.ts', 'src/alpha.ts'] } },
      build: {
        outDir: 'out/server',
        ssr: true,
        rolldownOptions: { input: { server: 'src/server.ts' } },
      },
    });
    const { handle } = (await import(
      `${pathToFileURL(`${app}out/server/server.js`).href}?round=env`
    )) as { handle: Handle };
    const file = /src="\/(assets\/[^"]+)"/.exec(await text(handle))?.[1] ?? '';
    expect(readFileSync(`${app}out/public/${file}`, 'utf8')).toContain('zeta');
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
