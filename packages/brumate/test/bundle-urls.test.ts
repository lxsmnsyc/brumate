import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, createServer } from 'vite';
import type { InlineConfig, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import brumate from '../src/vite.ts';

// The builds of the client and the server take more than the default 5s on a CI runner.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));

const app = fileURLToPath(new URL('./.output/bundle-urls/', import.meta.url));

/** A component with a button that counts, so it has client code. */
function counter(name: string, imports = '', markup = ''): string {
  return `<script>\n${imports}  import { $signal } from 'brumate/signals';\n  let count = $signal(0);\n</script>\n\n<button class="${name}" onClick=(() => count++)>${name} {count}</button>\n${markup}`;
}

/**
 * Two pages under a layout. Both render `Shared`, so it is in the bundle of each, and the
 * index has a `#defer` body and a `#client` body with components of their own.
 */
function writeApp(): void {
  rmSync(app, { recursive: true, force: true });
  mkdirSync(`${app}src/routes`, { recursive: true });
  // An entry of its own, as the website has, which imports `load` only.
  writeFileSync(
    `${app}src/client.ts`,
    "import { start } from 'brumate/loader';\nimport { load } from 'virtual:brumate/manifest';\nstart({ load });\n",
  );
  writeFileSync(`${app}src/server.ts`, "export { handle } from 'virtual:brumate/routes';\n");
  writeFileSync(
    `${app}src/routes/_layout.brm`,
    [
      '<script>',
      "  import { $props, $signal } from 'brumate/signals';",
      '  const { children } = $props();',
      '  let wide = $signal(false);',
      '</script>',
      '',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <button class="wide" onClick=(() => (wide = !wide))>{wide}</button>',
      '    <a href="/other">Other</a>',
      '    <main>{children}</main>',
      '  </body>',
      '</html>',
      '',
    ].join('\n'),
  );
  writeFileSync(
    `${app}src/routes/index.brm`,
    counter(
      'Index',
      "  import Shared from '../Shared.brm';\n  import Later from '../Later.brm';\n  import Browser from '../Browser.brm';\n",
      "<Shared />\n#defer ('idle') {\n  <Later />\n} #else {\n  <p class=\"fallback\">Loading</p>\n}\n#client ('idle') {\n  <Browser />\n}\n",
    ),
  );
  writeFileSync(
    `${app}src/routes/other.brm`,
    counter(
      'Other',
      "  import Shared from '../Shared.brm';\n  import { shade } from '../theme.ts';\n",
      '<Shared />\n<p class="theme" onClick=(() => (count += shade.length))>{count}</p>\n',
    ),
  );
  // A stylesheet that a module of a component imports is a stylesheet of its bundle.
  writeFileSync(`${app}src/theme.ts`, "import './theme.css';\nexport const shade = 'teal';\n");
  writeFileSync(`${app}src/theme.css`, '.theme { color: teal; }\n');
  writeFileSync(`${app}src/Shared.brm`, counter('Shared'));
  writeFileSync(`${app}src/Later.brm`, counter('Later'));
  writeFileSync(`${app}src/Browser.brm`, counter('Browser'));
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

interface Hints {
  chunks: Record<string, string>;
  members: Record<string, string[]>;
}

type Handle = (request: Request) => Promise<Response | undefined>;

let handle: Handle;
let hints: Hints;

/** The ID of a component of the app, from the members of the bundles. */
function findId(name: string): string {
  for (const ids of Object.values(hints.members)) {
    for (const id of ids) {
      if (id.startsWith(`${name}_`)) {
        return id;
      }
    }
  }
  throw new Error(`No component ${name}`);
}

/** The URL of the chunk of the bundle of a root component. */
function chunk(name: string): string {
  return hints.chunks[findId(name)]!;
}

/** The URLs that the state records of some HTML name in `b-load`. */
function loads(html: string): string[] {
  const urls: string[] = [];
  for (const [, value] of html.matchAll(/<script[^>]* b-load="([^"]*)"/g)) {
    urls.push(...value!.split(' '));
  }
  return urls;
}

async function page(path: string, headers: Record<string, string> = {}): Promise<string> {
  const response = await handle(new Request(`http://localhost${path}`, { headers }));
  expect(response?.status).toBe(200);
  return await response!.text();
}

beforeAll(async () => {
  writeApp();
  await build({
    ...config,
    build: { outDir: 'dist/client', rolldownOptions: { input: 'src/client.ts' } },
  });
  await build({
    ...config,
    build: { outDir: 'dist/server', ssr: 'src/server.ts' },
  });
  hints = JSON.parse(readFileSync(`${app}dist/client/.brumate/hints.json`, 'utf8')) as Hints;
  ({ handle } = (await import(pathToFileURL(`${app}dist/server/server.js`).href)) as {
    handle: Handle;
  });
});

describe('the bundle URLs from the server', () => {
  it('leave the tables of bundles out of the client entry', () => {
    let entry = '';
    for (const name of readdirSync(`${app}dist/client/assets`)) {
      const code = readFileSync(`${app}dist/client/assets/${name}`, 'utf8');
      if (code.includes('b-load')) {
        entry = code;
      }
    }
    expect(entry).not.toBe('');
    for (const url of Object.values(hints.chunks)) {
      expect(entry).not.toContain(url.split('/').pop());
    }
    for (const ids of Object.values(hints.members)) {
      for (const id of ids) {
        expect(entry).not.toContain(id);
      }
    }
    // The chunk that imports every bundle is not one that a page loads.
    const all = readFileSync(`${app}dist/client/.brumate/hints.json`, 'utf8');
    expect(all).not.toMatch(/\/bundles-[\w-]+\.js/);
    // Each bundle is a chunk of its own, which exports its modules.
    for (const url of Object.values(hints.chunks)) {
      expect(readFileSync(`${app}dist/client${url}`, 'utf8')).toMatch(/export\s*\{[^}]*modules/);
    }
  });

  it('name only the bundles of the page', async () => {
    const html = await page('/');
    expect(loads(html).toSorted()).toEqual([chunk('Layout'), chunk('Index')].toSorted());
    // The scripts of the bundles of the page load with the HTML.
    expect(html).toContain(`<link rel="modulepreload" href="${chunk('Index')}">`);
  });

  it('name the bundle of each page that holds a component of both', async () => {
    for (const name of ['Index', 'Other']) {
      expect(hints.members[findId(name)]).toContain(findId('Shared'));
    }
    const other = loads(await page('/other')).filter((url) => url.endsWith('.js'));
    expect(other.toSorted()).toEqual([chunk('Layout'), chunk('Other')].toSorted());
  });

  it('link to the stylesheets of the bundles of the page', async () => {
    const link = /<link rel="stylesheet" href="([^"]+\.css)">/;
    const html = await page('/other');
    const [, href] = link.exec(html)!;
    expect(readFileSync(`${app}dist/client${href}`, 'utf8')).toContain('teal');
    // The records name it too, for the loader, which adds it when the page has no link to it.
    expect(loads(html)).toContain(href);
    expect(await page('/')).not.toMatch(link);
    // Navigation keeps the stylesheets of the next page in its head.
    expect(await page('/other', { 'x-brumate-base': '20' })).toContain(href);
  });

  it('name the bundles of the next page for client navigation', async () => {
    const html = await page('/other', { 'x-brumate-base': '20' });
    expect(loads(html)).toContain(chunk('Other'));
    expect(loads(html)).not.toContain(chunk('Index'));
    // Navigation has the loader, the core and the hints already.
    expect(html).not.toContain('modulepreload');
  });

  it('hold the code of `#defer` and `#client` bodies in the bundle of the page', () => {
    const members = hints.members[findId('Index')]!;
    expect(members).toContain(findId('Later'));
    expect(members).toContain(findId('Browser'));
    const code = readFileSync(`${app}dist/client${chunk('Index')}`, 'utf8');
    expect(code).toContain(findId('Later'));
    expect(code).toContain(findId('Browser'));
  });

  it('name no bundle that the page has for a `#defer` body', async () => {
    const html = await page('/');
    const [, at, boundary, base] = /b-b="([^"]+)" b-defer="[^":]+:([^":]+):([^"]+)"/.exec(html)!;
    const body = await page('/', {
      'x-brumate-defer': `${boundary} ${at}`,
      'x-brumate-base': base!,
    });
    expect(body).toContain('Later');
    expect(body).toContain('b-scopes');
    expect(loads(body)).toEqual([]);
  });
});

describe('a build with a relative base', () => {
  it('names each bundle and stylesheet relative to the loader', async () => {
    await build({
      ...config,
      base: './',
      build: { outDir: 'dist/relative', rolldownOptions: { input: 'src/client.ts' } },
    });
    const out = `${app}dist/relative/`;
    const relative = JSON.parse(readFileSync(`${out}.brumate/hints.json`, 'utf8')) as Hints & {
      styles: Record<string, string[]>;
    };
    let loader = '';
    for (const name of readdirSync(`${out}assets`)) {
      if (readFileSync(`${out}assets/${name}`, 'utf8').includes('b-load')) {
        loader = `assets/${name}`;
      }
    }
    expect(loader).not.toBe('');
    const urls = [...Object.values(relative.chunks), ...Object.values(relative.styles).flat()];
    expect(urls.some((url) => url.endsWith('.css'))).toBe(true);
    for (const url of urls) {
      expect(url).toMatch(/^\.\.?\//);
      // A page at any depth resolves them against the chunk of the loader.
      const resolved = new URL(url, `https://example.com/app/${loader}`).pathname;
      expect(resolved.startsWith('/app/')).toBe(true);
      expect(
        readFileSync(`${out}${resolved.slice('/app/'.length)}`, 'utf8').length,
      ).toBeGreaterThan(0);
    }
  });
});

describe('the dev server', () => {
  let dev: ViteDevServer | undefined;
  afterAll(async () => {
    await dev?.close();
  });

  it('loads each component by its module and names no bundles', async () => {
    dev = await createServer({ ...config, appType: 'custom', server: { middlewareMode: true } });
    const manifest = await dev.transformRequest('virtual:brumate/manifest');
    expect(manifest?.code).toMatch(/Shared\.brm\?.*brumate-client/);
    expect(manifest?.code).not.toContain('loadBundle');
    const routes = (await dev.ssrLoadModule('virtual:brumate/routes')) as { handle: Handle };
    const html = await (await routes.handle(new Request('http://localhost/')))!.text();
    expect(html).toContain('Index');
    expect(loads(html)).toEqual([]);
  });
});
