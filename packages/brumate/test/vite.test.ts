import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHTTPServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { toJSON } from 'seroval';
import { build, createServer } from 'vite';
import type { InlineConfig, Rolldown, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from '../src/runtime/server.ts';
import { fromChunkStream } from '../src/runtime/stream.ts';
import brumate from '../src/vite.ts';
import { serverStubs } from '../src/server-files.ts';

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
      'brumate/static-loader': runtime('static-loader'),
      'brumate/context': runtime('context'),
      'brumate/events': runtime('events'),
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
    expect(html).toContain('b-on="click=Counter_m86gta#h4"');
  });

  it('compiles .brm files for the client, without types', async () => {
    const entry = await server.transformRequest('/todos.brm?brumate-client');
    expect(entry?.code).toContain('part=h12');
    const part = await server.transformRequest('/todos.brm?brumate-client&part=h12');
    expect(part?.code).toContain('export { toggle$ as h12 }');
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

  it('keeps validation helpers and schemas of server functions out of the client build', async () => {
    const result = (await build({
      ...config,
      build: { write: false, minify: true, rolldownOptions: { input: 'virtual:brumate/start' } },
    })) as Rolldown.RolldownOutput;
    const chunks = result.output.filter(
      (item): item is Rolldown.OutputChunk => item.type === 'chunk',
    );
    const names = chunks.map((chunk) => chunk.facadeModuleId ?? '');
    expect(names.some((name) => name.endsWith('validated.brm?brumate-client'))).toBe(true);
    const code = chunks.map((chunk) => chunk.code).join('\n');
    // The markup that the client renders ships.
    expect(code).toContain('<p class="welcome">Welcome');
    // A message of the helpers, the schema of the component and its message do not.
    expect(code).not.toContain('conflicts with another field');
    expect(code).not.toContain('~standard');
    expect(code).not.toContain('Enter an email address');
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
      // The file watcher can take a while to notice the change while other tests run.
      await vi.waitFor(async () => expect(await css()).toContain('color: navy'), {
        timeout: 15_000,
      });
    } finally {
      await dev.close();
    }
  });
});

describe('files of server functions', () => {
  it('gives the browser stubs, and answers their calls on the server', async () => {
    const directory = fileURLToPath(new URL('./.output/server-files/', import.meta.url));
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      `${directory}users.ts`,
      "'use server';\n\nimport { secret } from './secret.ts';\n\nexport async function greet(name: string) {\n  return `Hello ${name}, ${secret}`;\n}\n\nexport const count = async () => 3;\n",
    );
    writeFileSync(`${directory}secret.ts`, "export const secret = 'from the server';\n");
    writeFileSync(
      `${directory}Greeter.brm`,
      "<script>\n  import { $signal } from 'brumate/signals';\n  import { greet } from './users.ts';\n  let message = $signal('');\n</script>\n<button onClick=(async () => (message = await greet('Ada')))>{message}</button>\n",
    );
    const dev = await createServer({
      ...config,
      root: directory,
      appType: 'custom',
      server: { middlewareMode: true },
    });
    try {
      // The browser gets stubs. The code of the file, and what it imports, stays on the server.
      const stubs = await dev.transformRequest('/users.ts');
      expect(stubs?.code).toContain('rpc(');
      expect(stubs?.code).not.toContain('secret');
      const { functions } = await dev.ssrLoadModule('virtual:brumate/server');
      const ids = Object.keys(functions).filter((id) => id.startsWith('users_'));
      expect(ids.map((id) => id.split('#')[1]).toSorted()).toEqual(['count', 'greet']);

      const http = createHTTPServer(dev.middlewares);
      await new Promise<void>((resolve) => http.listen(0, resolve));
      const { port } = http.address() as AddressInfo;
      const greet = ids.find((id) => id.endsWith('#greet'))!;
      const response = await fetch(
        `http://localhost:${port}/_brumate/${encodeURIComponent(greet)}`,
        {
          method: 'POST',
          body: JSON.stringify(toJSON(['Ada'])),
        },
      );
      http.close();
      expect(await fromChunkStream(response.body!)).toBe('Hello Ada, from the server');
    } finally {
      await dev.close();
    }
  });

  it('refreshes a function of a file from a call of a component in development', async () => {
    const directory = fileURLToPath(new URL('./.output/server-refresh/', import.meta.url));
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      `${directory}notes.ts`,
      "'use server';\n\nexport async function listNotes() {\n  return ['one'];\n}\n",
    );
    writeFileSync(
      `${directory}Notes.brm`,
      "<script>\n  import { $memo } from 'brumate/signals';\n  import { getEvent } from 'brumate/server';\n  import { listNotes } from './notes.ts';\n  async function add() {\n    'use server';\n    getEvent().refresh(listNotes);\n  }\n  const notes = $memo(listNotes());\n</script>\n<button onClick=(() => add())>{notes.length}</button>\n",
    );
    const dev = await createServer({
      ...config,
      root: directory,
      appType: 'custom',
      server: { middlewareMode: true },
    });
    try {
      const { functions } = await dev.ssrLoadModule('virtual:brumate/server');
      const ids = Object.keys(functions);
      const add = ids.find((id) => id.endsWith('#add'))!;
      const list = ids.find((id) => id.endsWith('#listNotes'))!;
      const http = createHTTPServer(dev.middlewares);
      await new Promise<void>((resolve) => http.listen(0, resolve));
      const { port } = http.address() as AddressInfo;
      const response = await fetch(`http://localhost:${port}/_brumate/${encodeURIComponent(add)}`, {
        method: 'POST',
        body: JSON.stringify(toJSON([])),
      });
      http.close();
      expect(response.status).toBe(200);
      // The page loads the memos that call the function of the file again, as in production.
      expect(response.headers.get('x-brumate-refresh')).toBe(list);
    } finally {
      await dev.close();
    }
  });

  it('runs the entry middleware and the middleware of a file before a call', async () => {
    const directory = fileURLToPath(new URL('./.output/server-middleware/', import.meta.url));
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(`${directory}src`, { recursive: true });
    writeFileSync(
      `${directory}src/middleware.ts`,
      "import { defineMiddleware } from 'brumate/server';\n\nexport default defineMiddleware(async (event, next) => {\n  (event.locals as { user?: string }).user = event.request.headers.get('x-user') ?? 'nobody';\n  const response = await next();\n  response.headers.set('x-entry', event.kind);\n  return response;\n});\n",
    );
    writeFileSync(
      `${directory}admin.ts`,
      "'use server';\n\nimport { getEvent } from 'brumate/server';\nimport type { EntryMiddleware } from 'brumate/server';\n\nexport const middleware: EntryMiddleware = (event, next) =>\n  (event.locals as { user?: string }).user === 'admin' ? next() : new Response('Forbidden', { status: 403 });\n\nexport async function reset() {\n  return `reset by ${(getEvent().locals as { user?: string }).user}`;\n}\n",
    );
    writeFileSync(
      `${directory}Admin.brm`,
      "<script>\n  import { $signal } from 'brumate/signals';\n  import { reset } from './admin.ts';\n  let message = $signal('');\n</script>\n<button onClick=(async () => (message = await reset()))>{message}</button>\n",
    );
    const dev = await createServer({
      ...config,
      root: directory,
      appType: 'custom',
      server: { middlewareMode: true },
    });
    try {
      // The middleware of the file is not a server function: the browser gets no stub for it.
      const stubs = await dev.transformRequest('/admin.ts');
      expect(stubs?.code).toContain('reset');
      expect(stubs?.code).not.toContain('middleware');
      const { functions, fileMiddleware } = await dev.ssrLoadModule('virtual:brumate/server');
      const reset = Object.keys(functions).find((id) => id.endsWith('#reset'))!;
      expect(Object.keys(functions).some((id) => id.endsWith('#middleware'))).toBe(false);
      expect(typeof fileMiddleware[reset]).toBe('function');
      const routes = await dev.transformRequest('virtual:brumate/routes', { ssr: true });
      expect(routes?.code).toContain('src/middleware.ts');

      const http = createHTTPServer(dev.middlewares);
      await new Promise<void>((resolve) => http.listen(0, resolve));
      const { port } = http.address() as AddressInfo;
      const call = (user: string): Promise<Response> =>
        fetch(`http://localhost:${port}/_brumate/${encodeURIComponent(reset)}`, {
          method: 'POST',
          headers: { 'x-user': user },
          body: JSON.stringify(toJSON([])),
        });
      const refused = await call('ada');
      const allowed = await call('admin');
      http.close();
      // The entry runs first and sets the locals that the file's middleware reads.
      expect(refused.status).toBe(403);
      expect(refused.headers.get('x-entry')).toBe('call');
      expect(allowed.status).toBe(200);
      expect(await fromChunkStream(allowed.body!)).toBe('reset by admin');
    } finally {
      await dev.close();
    }
  });

  it('refuses an export that is not a function', () => {
    expect(() =>
      serverStubs("'use server';\nexport const limit = 5;\n", 'limits.ts', 'limits_1'),
    ).toThrow("A 'use server' file exports only functions");
  });
});

describe('environment variables', () => {
  it('checks them on the server, and gives the browser the public ones only', async () => {
    const directory = fileURLToPath(new URL('./.output/env-app/', import.meta.url));
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(`${directory}src/routes`, { recursive: true });
    writeFileSync(
      `${directory}src/env.ts`,
      "import { defineEnv } from 'brumate/env';\nimport * as v from 'valibot';\n\nexport default defineEnv({\n  server: { SECRET: v.pipe(v.string(), v.minLength(4)) },\n  public: { SITE_NAME: v.optional(v.string(), 'Tracker') },\n});\n",
    );
    writeFileSync(
      `${directory}src/routes/index.brm`,
      "<script>\n  import { $signal } from 'brumate/signals';\n  import env from '../env.ts';\n  let clicks = $signal(0);\n  const secretLength = env.SECRET.length;\n</script>\n<p>{env.SITE_NAME} {secretLength}</p>\n<button onClick=(() => clicks++)>{clicks}</button>\n",
    );
    const dev = await createServer({
      ...config,
      root: directory,
      appType: 'custom',
      server: { middlewareMode: true },
      resolve: { alias: { ...config.resolve!.alias, 'brumate/env': runtime('env') } },
    });
    try {
      // The server fails to start its routes without the secret.
      delete process.env.SECRET;
      await expect(dev.ssrLoadModule('virtual:brumate/routes')).rejects.toThrow(
        'Environment variables: SECRET is missing',
      );
      process.env.SECRET = 'hunter2';
      process.env.SITE_NAME = 'Issues';
      // The failed module stays in the graph until it is invalidated, as a restart would.
      dev.moduleGraph.invalidateAll();
      // The browser's copy has the public values, and no server variable.
      const client = await dev.transformRequest('/src/env.ts');
      expect(client?.code).toMatch(/"SITE_NAME":\s*"Issues"/);
      expect(client?.code).not.toContain('SECRET');
      // The server reads them while the page renders.
      const { handle } = await dev.ssrLoadModule('virtual:brumate/routes');
      const response = await handle(new Request('http://localhost/'));
      expect(await response.text()).toContain('<p>Issues 7</p>');
      // Code that runs in the browser cannot read a server variable.
      writeFileSync(
        `${directory}src/Leak.brm`,
        "<script>\n  import { $signal } from 'brumate/signals';\n  import env from './env.ts';\n  let shown = $signal('');\n</script>\n<button onClick=(() => (shown = env.SECRET))>{shown}</button>\n",
      );
      await expect(dev.ssrLoadModule('/src/Leak.brm')).rejects.toThrow(
        'env.SECRET, a server variable, is read by code that runs in the browser',
      );
    } finally {
      delete process.env.SECRET;
      delete process.env.SITE_NAME;
      await dev.close();
    }
  });

  it('finds the env file by its resolved path, and keeps its values out of the page', async () => {
    const directory = fileURLToPath(new URL('./.output/env-leak-app/', import.meta.url));
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(`${directory}src/lib`, { recursive: true });
    writeFileSync(
      `${directory}src/env.ts`,
      "import { defineEnv } from 'brumate/env';\nimport * as v from 'valibot';\n\nexport default defineEnv({\n  server: { TOKEN: v.string(), PORT: v.string() },\n  public: { SITE_NAME: v.optional(v.string(), 'Tracker') },\n});\n",
    );
    // A helper that reads a server variable, and a module that passes the env file on.
    writeFileSync(
      `${directory}src/lib/token.ts`,
      "import env from '~/env';\nexport const getToken = (): string => env.TOKEN;\nexport const getPort = (): string => env.PORT;\n",
    );
    writeFileSync(`${directory}src/lib/index.ts`, "export { default as env } from '../env.ts';\n");
    const component = (name: string, script: string, markup: string): string => {
      writeFileSync(
        `${directory}src/${name}.brm`,
        `<script>\n  import { $signal } from 'brumate/signals';\n${script}</script>\n${markup}\n`,
      );
      return `/src/${name}.brm`;
    };
    const dev = await createServer({
      ...config,
      root: directory,
      appType: 'custom',
      server: { middlewareMode: true },
      resolve: {
        alias: {
          ...config.resolve!.alias,
          'brumate/env': runtime('env'),
          '~': `${directory}src`,
        },
      },
    });
    process.env.TOKEN = 'tok_live_0123456789';
    process.env.PORT = '3000';
    try {
      // An alias of the env file is the env file: a handler cannot read a server variable from it.
      const alias = component(
        'Alias',
        "  import env from '~/env';\n  let shown = $signal('');\n",
        '<button onClick=(() => (shown = env.TOKEN))>{shown}</button>',
      );
      await expect(dev.ssrLoadModule(alias)).rejects.toThrow(
        'env.TOKEN, a server variable, is read by code that runs in the browser',
      );
      // A script that the browser loads cannot import the env file, by any path.
      await expect(dev.transformRequest('/src/lib/token.ts')).rejects.toThrow(
        'src/lib/token.ts imports src/env.ts, and the browser loads it',
      );
      await expect(dev.transformRequest('/src/lib/index.ts')).rejects.toThrow(
        'src/lib/index.ts imports src/env.ts, and the browser loads it',
      );
      // A helper that reads a secret gives the value of a signal that the browser reads.
      const helper = component(
        'Helper',
        "  import { getToken } from './lib/token.ts';\n  let token = $signal(getToken());\n  let shown = $signal('');\n",
        '<button onClick=(() => (shown = token))>{shown}</button>',
      );
      const { default: Helper } = await dev.ssrLoadModule(helper);
      const error = await render(Helper, {}).then(
        () => undefined,
        (reason: unknown) => reason,
      );
      expect(String(error)).toMatch(
        /The value of "token" in Helper_\w+ is the value of a server environment variable, and code that runs in the browser reads it/,
      );
      // The error, as a log would show it, does not hold the secret.
      expect(inspect(error)).not.toContain('tok_live_0123456789');
      // A short value, such as a port, can be in a page for other reasons, so it is sent.
      const port = component(
        'Port',
        "  import { getPort } from './lib/token.ts';\n  let port = $signal(getPort());\n  let shown = $signal('');\n",
        '<button onClick=(() => (shown = port))>{shown}</button>',
      );
      const { default: Port } = await dev.ssrLoadModule(port);
      expect((await render(Port, {})).state).toContain('"3000"');
    } finally {
      delete process.env.TOKEN;
      delete process.env.PORT;
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
      // The entry holds the code, so the first event loads one module.
      const entry = await dev.transformRequest('/counter.brm?brumate-client');
      expect(entry?.code).toMatch(/export const h\d+/);
      expect(entry?.code).toMatch(/export function u\d+/);
      expect(entry?.code).toContain('export const g = ');
      expect(entry?.code).not.toContain('part=');
      // About 2 kB of parts, as large as a dashboard widget, is still one module.
      const list = await dev.transformRequest('/list.brm?brumate-client');
      expect(list?.code).toMatch(/as h6\b/);
      expect(list?.code).not.toContain('part=');
      // A large component keeps one module per part.
      const sourced = await dev.transformRequest('/sourced.brm?brumate-client');
      expect(sourced?.code).toContain('part=h6');
      expect(sourced?.code).toContain('export function load');
    } finally {
      await dev.close();
    }
  });

  it('takes the size from the `merge` option', async () => {
    const dev = await createServer({
      ...config,
      plugins: [brumate({ merge: 8192 })],
      appType: 'custom',
      server: { middlewareMode: true },
    });
    try {
      const sourced = await dev.transformRequest('/sourced.brm?brumate-client');
      expect(sourced?.code).not.toContain('part=');
      expect(sourced?.code).not.toContain('export function load');
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

describe('vitest cache key', () => {
  it('adds a hash of the build of brumate to the cache key of Vitest', () => {
    const keys: string[] = [];
    type Define = (generate: () => string) => void;
    const plugin = brumate() as ReturnType<typeof brumate> & {
      configureVitest(context: {
        defineCacheKeyGenerator?: Define;
        experimental_defineCacheKeyGenerator?: Define;
      }): void;
    };
    plugin.configureVitest({ defineCacheKeyGenerator: (generate) => keys.push(generate()) });
    // Older versions of Vitest name it as experimental.
    plugin.configureVitest({
      experimental_defineCacheKeyGenerator: (generate) => keys.push(generate()),
    });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^[0-9a-f]{16}$/);
    expect(keys[1]).toBe(keys[0]);
  });
});
