import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHTTPServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { toJSON } from 'seroval';
import { build, createServer } from 'vite';
import type { InlineConfig, Rolldown, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from '../src/runtime/server.ts';
import brumate from '../src/vite.ts';

const root = fileURLToPath(new URL('./render/', import.meta.url));
const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));

const config: InlineConfig = {
  root,
  configFile: false,
  logLevel: 'silent',
  plugins: [brumate()],
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
    expect(await response.json()).toMatchObject({ t: { t: 2 } });
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
    expect(await response.json()).toMatchObject({ t: { s: 'Ada' } });
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
