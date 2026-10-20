import { createServer as createHTTPServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { toJSON } from 'seroval';
import { build, createServer } from 'vite';
import type { InlineConfig, Rolldown, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToString } from '../src/runtime/server.ts';
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
    const { html } = await renderToString(module.default, {});
    expect(html).toContain('data-on="click=Counter_m86gta#h4"');
  });

  it('compiles .brm files for the client, without types', async () => {
    const result = await server.transformRequest('/todos.brm?brumate-client');
    expect(result?.code).toContain('export const h12');
    expect(result?.code).not.toContain('interface Todo');
  });

  it('loads client modules by component ID', async () => {
    const { load } = await server.ssrLoadModule('virtual:brumate/manifest');
    const module = await load('Counter_m86gta');
    expect(module.id).toBe('Counter_m86gta');
    expect(typeof module.h4).toBe('function');
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

  it('exports server functions for production', async () => {
    const { functions, handle } = await server.ssrLoadModule('virtual:brumate/server');
    expect(Object.keys(functions)).toEqual(['Todos_t3g9lr#persist']);
    const response = await handle(
      new Request('http://localhost/_brumate/Todos_t3g9lr%23persist', {
        method: 'POST',
        body: JSON.stringify(toJSON([[]])),
      }),
    );
    expect(response.status).toBe(200);
  });

  it('builds a client entry with one chunk per component', async () => {
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
    const entry = chunks.find((chunk) => chunk.isEntry)!;
    expect(entry.code).not.toContain('fromJSON');
  });
});
