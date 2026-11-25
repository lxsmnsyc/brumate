import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBuilder } from 'vite';
import type { InlineConfig } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import type { PrerenderManifest } from '../src/prerender.ts';
import brumate from '../src/vite.ts';

// The builds of the client and the server take more than the default 5s on a CI runner.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));

const app = fileURLToPath(new URL('./.output/prerender-environments/', import.meta.url));

function writeApp(): void {
  rmSync(app, { recursive: true, force: true });
  mkdirSync(`${app}src/routes`, { recursive: true });
  writeFileSync(`${app}src/client.ts`, "import 'virtual:brumate/start';\n");
  // The entry of a framework such as Nitro: it serves the routes, and exports no `handle`.
  writeFileSync(
    `${app}src/entry.ts`,
    [
      "import { handle } from 'virtual:brumate/routes';",
      'export default { fetch: (request: Request) => handle(request) };',
      '',
    ].join('\n'),
  );
  writeFileSync(
    `${app}src/routes/_layout.brm`,
    '<script>\n  import { $props } from \'brumate/signals\';\n  const { children } = $props();\n</script>\n\n<html><body><nav><a href="/">Home</a> <a href="/docs">Docs</a> <a href="/team">Team</a></nav>{children}</body></html>\n',
  );
  writeFileSync(`${app}src/routes/index.brm`, '<h1>Home</h1>\n');
  writeFileSync(`${app}src/routes/docs.brm`, '<h1>Docs</h1>\n');
  // A page with a #defer block, which the server must see the requests of.
  writeFileSync(
    `${app}src/routes/team.brm`,
    "<h1>Team</h1>\n#defer ('load') {\n  <p>Late</p>\n} #else {\n  <p>Early</p>\n}\n",
  );
  writeFileSync(
    `${app}src/nitro-storage.ts`,
    'export function useStorage() {\n  return { getItem: async () => null };\n}\n',
  );
  writeFileSync(`${app}src/routes/hidden.brm`, '<h1>Not linked</h1>\n');
  writeFileSync(
    `${app}src/routes/_error.brm`,
    "<script>\n  import { $props } from 'brumate/signals';\n  const { error } = $props();\n</script>\n\n<h1>{error.status}</h1>\n",
  );
}

function configure(
  prerender: Parameters<typeof brumate>[0],
  nitro = false,
  server: { name?: string; conditions?: string[] } = {},
): InlineConfig {
  const name = server.name ?? 'ssr';
  return {
    root: app,
    configFile: false,
    logLevel: 'silent',
    // A plugin named like Nitro's makes the build keep the pages with #defer out of the client files.
    plugins: [brumate({ merge: 0, ...prerender }), ...(nitro ? [{ name: 'nitro:test' }] : [])],
    resolve: {
      alias: {
        'nitro/storage': `${app}src/nitro-storage.ts`,
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
    // Like Nitro, which builds the client, then each server environment, in one `vite build`.
    builder: {
      sharedConfigBuild: true,
      async buildApp(builder) {
        for (const environment of Object.values(builder.environments)) {
          await builder.build(environment);
        }
      },
    },
    environments: {
      client: { build: { outDir: 'out/public', rolldownOptions: { input: 'src/client.ts' } } },
      [name]: {
        consumer: 'server',
        ...(server.conditions ? { resolve: { conditions: server.conditions } } : {}),
        build: {
          outDir: 'out/ssr',
          ssr: true,
          rolldownOptions: { input: { entry: 'src/entry.ts' } },
        },
      },
    },
  };
}

function read(file: string): string {
  return readFileSync(`${app}out/public/${file}`, 'utf8');
}

describe('prerendering in a build of several environments', () => {
  it('writes the pages into the client directory, with the 404 page and the manifest', async () => {
    writeApp();
    const builder = await createBuilder(configure({ prerender: true }));
    await builder.buildApp();
    expect(read('index.html')).toContain('<h1>Home</h1>');
    // A link of a rendered page leads to another page.
    expect(read('docs/index.html')).toContain('<h1>Docs</h1>');
    expect(read('404.html')).toContain('<h1>404</h1>');
    expect(read('index.html')).toMatch(
      /<script type="module" async src="\/assets\/client-[\w-]+\.js"><\/script>/,
    );
    // A page that no link leads to is not rendered.
    expect(existsSync(`${app}out/public/hidden/index.html`)).toBe(false);
    const manifest = JSON.parse(read('.brumate/prerender.json')) as PrerenderManifest;
    expect(Object.keys(manifest.pages).toSorted()).toEqual(['/', '/docs', '/team', '404']);
    // The pages are not written into the output of the server.
    expect(existsSync(`${app}out/ssr/index.html`)).toBe(false);
  });

  it('writes the client files and the build ID where the server reads them', async () => {
    writeApp();
    const builder = await createBuilder(configure({ prerender: true }));
    await builder.buildApp();
    const { build } = JSON.parse(read('.brumate/build.json')) as { build: string };
    const hints = JSON.parse(read('.brumate/hints.json')) as { all: string[] };
    expect(hints.all.length).toBeGreaterThan(0);
    // The server and the client name one build, so skew protection compares the same ID.
    expect(
      readFileSync(
        `${app}out/ssr/assets/${readdirSync(`${app}out/ssr/assets`).find((file) => file.startsWith('brumate-routes-'))}`,
        'utf8',
      ),
    ).toContain(build);
    const clientCode = readdirSync(`${app}out/public/assets`)
      .map((file) => readFileSync(`${app}out/public/assets/${file}`, 'utf8'))
      .join('\n');
    expect(clientCode.includes(build)).toBe(true);
    // The files of the server environment are not described as client files.
    expect(existsSync(`${app}out/ssr/.brumate`)).toBe(false);
    expect(existsSync(`${app}dist/.brumate`)).toBe(false);
  });

  it('keeps the pages with #defer blocks out of the client files when Nitro is present', async () => {
    writeApp();
    const builder = await createBuilder(configure({ prerender: true }, true));
    await builder.buildApp();
    expect(read('docs/index.html')).toContain('<h1>Docs</h1>');
    expect(existsSync(`${app}out/public/team/index.html`)).toBe(false);
    expect(
      readFileSync(
        `${app}node_modules/.brumate/shells/${readdirSync(`${app}node_modules/.brumate/shells`)[0]}/team/index.html`,
        'utf8',
      ),
    ).toContain('b-defer=');
    const manifest = JSON.parse(read('.brumate/prerender.json')) as PrerenderManifest;
    expect(manifest.pages['/team']).toMatchObject({ file: 'team/index.html', shell: true });
    expect(manifest.pages['/docs']?.shell).toBeUndefined();
  });

  it('removes the shells that old builds left, and keeps the ones of a build in progress', async () => {
    writeApp();
    const shells = `${app}node_modules/.brumate/shells`;
    mkdirSync(`${shells}/old-build`, { recursive: true });
    writeFileSync(`${shells}/old-build/stale.html`, 'old');
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    utimesSync(`${shells}/old-build`, past, past);
    mkdirSync(`${shells}/other-build`, { recursive: true });
    writeFileSync(`${shells}/other-build/index.html`, 'running');
    const builder = await createBuilder(configure({ prerender: true }, true));
    await builder.buildApp();
    expect(existsSync(`${shells}/old-build`)).toBe(false);
    // A build that runs at the same time from this package root keeps its directory.
    expect(existsSync(`${shells}/other-build/index.html`)).toBe(true);
    // The pages of this build are in a directory of their own.
    const own = readdirSync(shells).filter((name) => name !== 'other-build');
    expect(own).toHaveLength(1);
    expect(existsSync(`${shells}/${own[0]}/team/index.html`)).toBe(true);
  });

  it('fails when the routes build in the nitro environment, after Nitro lists its files', async () => {
    writeApp();
    const builder = await createBuilder(configure({ prerender: true }, true, { name: 'nitro' }));
    await expect(builder.buildApp()).rejects.toThrow(/src\/entry-server\.ts/);
  });

  it('skips prerendering for an environment that does not run in Node, and says so', async () => {
    writeApp();
    const warnings: string[] = [];
    const builder = await createBuilder({
      ...configure({ prerender: true }, false, { conditions: ['workerd'] }),
      customLogger: {
        info() {},
        warn: (message) => warnings.push(message),
        warnOnce: (message) => warnings.push(message),
        error() {},
        clearScreen() {},
        hasErrorLogged: () => false,
        hasWarned: false,
      },
    });
    await builder.buildApp();
    expect(existsSync(`${app}out/public/index.html`)).toBe(false);
    const skipped = warnings.filter((message) => message.includes('Prerendering is skipped'));
    expect(skipped).toHaveLength(1);
  });

  it('renders a request with a malformed path when handle reads shells', async () => {
    writeApp();
    const builder = await createBuilder(configure({ prerender: true }, true));
    await builder.buildApp();
    const chunk = readdirSync(`${app}out/ssr/assets`).find((file) =>
      file.startsWith('brumate-routes-'),
    );
    const { handle } = (await import(pathToFileURL(`${app}out/ssr/assets/${chunk}`).href)) as {
      handle: (request: Request) => Promise<Response | undefined>;
    };
    const answer = await handle(new Request('http://localhost/%E0%A4%A'));
    expect(answer?.status).toBe(404);
  });

  it('follows the paths and the crawl option', async () => {
    writeApp();
    const builder = await createBuilder(
      configure({ prerender: { paths: ['/docs'], crawl: false } }),
    );
    await builder.buildApp();
    expect(read('docs/index.html')).toContain('<h1>Docs</h1>');
    expect(existsSync(`${app}out/public/index.html`)).toBe(false);
  });

  it('writes no page without the option', async () => {
    writeApp();
    const builder = await createBuilder(configure({}));
    await builder.buildApp();
    expect(existsSync(`${app}out/public/index.html`)).toBe(false);
    expect(existsSync(`${app}out/public/.brumate/prerender.json`)).toBe(false);
  });
});
