import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHTTPServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { toJSON } from 'seroval';
import { build, createServer } from 'vite';
import type { InlineConfig, Rolldown, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from '../src/runtime/server.ts';
import { fromChunkStream } from '../src/runtime/stream.ts';
import brumate from '../src/vite.ts';

const root = fileURLToPath(new URL('./render/', import.meta.url));
const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));

const config: InlineConfig = {
  root,
  configFile: false,
  logLevel: 'silent',
  plugins: [brumate({ merge: 0 })],
  resolve: {
    alias: {
      'brumate/server': runtime('server'),
      'brumate/client': runtime('client'),
      'brumate/loader': runtime('loader'),
      'brumate/context': runtime('context'),
    },
  },
};

let server: ViteDevServer;

beforeAll(async () => {
  server = await createServer({ ...config, appType: 'custom', server: { middlewareMode: true } });
});

afterAll(async () => {
  await server.close();
});

describe('vite plugin', () => {
  it('compiles .brm files for the server', async () => {
    const module = await server.ssrLoadModule('/counter.brm');
    const { html } = await render(module.default, {});
    expect(html).toContain('data-on="click=Counter_m86gta#h4"');
  });

  it('compiles .brm files for the client, without types', async () => {
    const entry = await server.transformRequest('/todos.brm?brumate-client');
    expect(entry?.code).toContain('part=h12');
    const part = await server.transformRequest('/todos.brm?brumate-client&part=h12');
    expect(part?.code).toContain('export const h12');
    expect(part?.code).not.toContain('interface Todo');
  });

  it('compiles render modules for components rendered on the client', async () => {
    const list = await server.transformRequest('/list.brm?brumate-client&part=update');
    expect(list?.code).toMatch(/import Child from "\/Child\.brm\?.*brumate-render/);
    const child = await server.transformRequest('/Child.brm?brumate-render');
    expect(child?.code).toContain('export default function Child');
  });

  it('loads the devtools on the dev server, and tells them about components', async () => {
    const start = await server.transformRequest('virtual:brumate/start');
    expect(start?.code).toContain('installDevtools');
    const http = createHTTPServer(server.middlewares);
    await new Promise<void>((resolve) => http.listen(0, resolve));
    const { port } = http.address() as AddressInfo;
    const response = await fetch(`http://localhost:${port}/__brumate/inspect/Counter_m86gta`);
    const missing = await fetch(`http://localhost:${port}/__brumate/inspect/Nothing_0`);
    http.close();
    const info = (await response.json()) as {
      name: string;
      scopes: Record<number, { label: string; slots: string[] }>;
      text: string;
    };
    expect(info.name).toBe('Counter');
    expect(Object.values(info.scopes)).toEqual([
      { label: 'component', slots: ['count', 'double'] },
    ]);
    expect(info.text).toContain('Client code');
    expect(missing.status).toBe(404);
  });

  it('serves the shared code of a module of reactive logic', async () => {
    const shared = await server.transformRequest('/counting.brm.ts?brumate-shared');
    expect(shared?.code).toContain('$$b.cells($$s, $$k, ["count"])');
    // Types are removed.
    expect(shared?.code).not.toContain(': any');
  });

  it('loads client modules by component ID', async () => {
    const { load } = await server.ssrLoadModule('virtual:brumate/manifest');
    const module = await load('Counter_m86gta');
    expect(module.id).toBe('Counter_m86gta');
    const part = await module.load('h4');
    expect(typeof part.h4).toBe('function');
  });

  it('answers server function calls in development', async () => {
    const http = createHTTPServer(server.middlewares);
    await new Promise<void>((resolve) => http.listen(0, resolve));
    const { port } = http.address() as AddressInfo;
    const response = await fetch(
      `http://localhost:${port}/_brumate/${encodeURIComponent('Todos_t3g9lr#persist')}`,
      {
        method: 'POST',
        body: JSON.stringify(toJSON([[]])),
      },
    );
    http.close();
    expect(response.status).toBe(200);
    expect(await fromChunkStream(response.body!)).toBeUndefined();
  });

  it('passes the request to server functions in development', async () => {
    const http = createHTTPServer(server.middlewares);
    await new Promise<void>((resolve) => http.listen(0, resolve));
    const { port } = http.address() as AddressInfo;
    const response = await fetch(
      `http://localhost:${port}/_brumate/${encodeURIComponent('Session_1fdcuk2#whoami')}`,
      { method: 'POST', headers: { 'x-user': 'Ada' }, body: JSON.stringify(toJSON([])) },
    );
    http.close();
    expect(await fromChunkStream(response.body!)).toBe('Ada');
  });

  it('exports server functions for production', async () => {
    const { functions, handle } = await server.ssrLoadModule('virtual:brumate/server');
    expect(Object.keys(functions)).toContain('Todos_t3g9lr#persist');
    expect(Object.keys(functions)).toContain('Session_1fdcuk2#whoami');
    const response = await handle(
      new Request('http://localhost/_brumate/Todos_t3g9lr%23persist', {
        method: 'POST',
        body: JSON.stringify(toJSON([[]])),
      }),
    );
    expect(response.status).toBe(200);
  });

  it('builds a client entry with chunks for each component and part', async () => {
    const result = (await build({
      ...config,
      build: { write: false, minify: true, rolldownOptions: { input: 'virtual:brumate/start' } },
    })) as Rolldown.RolldownOutput;
    const chunks = result.output.filter(
      (item): item is Rolldown.OutputChunk => item.type === 'chunk',
    );
    const names = chunks.map((chunk) => chunk.facadeModuleId ?? '');
    expect(names.some((name) => name.endsWith('counter.brm?brumate-client'))).toBe(true);
    expect(names.some((name) => name.endsWith('todos.brm?brumate-client'))).toBe(true);
    expect(names.some((name) => name.endsWith('todos.brm?brumate-client&part=h12'))).toBe(true);
    const entry = chunks.find((chunk) => chunk.isEntry)!;
    expect(entry.code).not.toContain('fromJSON');
  });
});

describe('style imports', () => {
  it('compiles a component again when a stylesheet that it imports changes', async () => {
    const directory = fileURLToPath(new URL('./.output/style-imports/', import.meta.url));
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
    writeFileSync(`${directory}_theme.scss`, '$brand: teal;\n');
    writeFileSync(
      `${directory}Brand.brm`,
      '<style lang="scss">\n  @use "theme";\n  p { color: theme.$brand; }\n</style>\n\n<p>Hi</p>\n',
    );
    const dev = await createServer({
      ...config,
      root: directory,
      appType: 'custom',
      server: { middlewareMode: true },
    });
    try {
      const css = async (): Promise<string> => {
        const module = await dev.ssrLoadModule('/Brand.brm');
        return (await render(module.default, {})).html;
      };
      expect(await css()).toContain('color: teal');
      writeFileSync(`${directory}_theme.scss`, '$brand: navy;\n');
      await vi.waitFor(async () => expect(await css()).toContain('color: navy'), {
        timeout: 5000,
      });
    } finally {
      await dev.close();
    }
  });
});

describe('merged parts', () => {
  it('puts the parts of a small component into one module', async () => {
    const dev = await createServer({
      ...config,
      plugins: [brumate()],
      appType: 'custom',
      server: { middlewareMode: true },
    });
    try {
      const entry = await dev.transformRequest('/counter.brm?brumate-client');
      expect(entry?.code).toMatch(/"h\d+": \(\) => import\("[^"]*part=all"\)/);
      expect(entry?.code).toMatch(/"update": \(\) => import\("[^"]*part=all"\)/);
      const all = await dev.transformRequest('/counter.brm?brumate-client&part=all');
      expect(all?.code).toMatch(/export const h\d+/);
      expect(all?.code).toMatch(/export function u\d+/);
      // A large component keeps one module per part.
      const todos = await dev.transformRequest('/todos.brm?brumate-client');
      expect(todos?.code).toContain('part=h12');
    } finally {
      await dev.close();
    }
  });
});

describe('prerendering', () => {
  it('writes every page that links lead to, and a 404 page', async () => {
    const app = fileURLToPath(new URL('./.output/prerender-app/', import.meta.url));
    rmSync(app, { recursive: true, force: true });
    mkdirSync(`${app}src/routes/docs`, { recursive: true });
    writeFileSync(`${app}src/client.ts`, "import 'virtual:brumate/start';\n");
    writeFileSync(`${app}src/server.ts`, "export { handle } from 'virtual:brumate/routes';\n");
    writeFileSync(
      `${app}src/routes/_layout.brm`,
      '<script>\n  import { $props } from \'brumate/signals\';\n  const { children } = $props();\n</script>\n\n<html><body><nav><a href="/">Home</a> <a href="/docs">Docs</a></nav>{children}</body></html>\n',
    );
    writeFileSync(`${app}src/routes/index.brm`, '<h1>Home</h1>\n');
    writeFileSync(
      `${app}src/routes/docs/index.brm`,
      '<h1>Docs</h1>\n<a href="/docs/intro">Intro</a>\n',
    );
    writeFileSync(`${app}src/routes/docs/intro.brm`, '<h1>Intro</h1>\n');
    writeFileSync(`${app}src/routes/hidden.brm`, '<h1>Not linked</h1>\n');
    writeFileSync(
      `${app}src/routes/_error.brm`,
      "<script>\n  import { $props } from 'brumate/signals';\n  const { error } = $props();\n</script>\n\n<h1>{error.status}</h1>\n",
    );
    const shared: InlineConfig = { ...config, root: app, plugins: [brumate({ prerender: true })] };
    await build({
      ...shared,
      build: { outDir: 'dist/client', manifest: true, rolldownOptions: { input: 'src/client.ts' } },
    });
    await build({ ...shared, build: { outDir: 'dist/server', ssr: 'src/server.ts' } });
    const read = (file: string): string => readFileSync(`${app}dist/client/${file}`, 'utf8');
    expect(read('index.html')).toContain('<h1>Home</h1>');
    expect(read('docs/index.html')).toContain('<h1>Docs</h1>');
    // A link from a page that was rendered leads to another one.
    expect(read('docs/intro/index.html')).toContain('<h1>Intro</h1>');
    expect(read('404.html')).toContain('<h1>404</h1>');
    expect(read('index.html')).toMatch(
      /<script type="module" async src="\/assets\/client-[\w-]+\.js"><\/script>/,
    );
    // The devtools are only for the dev server.
    const assets = readdirSync(`${app}dist/client/assets`).map((file) =>
      readFileSync(`${app}dist/client/assets/${file}`, 'utf8'),
    );
    expect(assets.join('')).not.toContain('installDevtools');
    // A page that no link leads to is not rendered.
    expect(() => read('hidden/index.html')).toThrow('ENOENT');
  });
});
