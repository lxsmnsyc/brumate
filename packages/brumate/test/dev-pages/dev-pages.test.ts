import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { toJSON } from 'seroval';
import { createServer } from 'vite';
import type { InlineConfig, Plugin, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import brumate from '../../src/vite.ts';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../../src/runtime/${name}.ts`, import.meta.url));

const app = fileURLToPath(new URL('../.output/dev-pages/', import.meta.url));

const page = (body: string): string =>
  ['<html>', '  <head></head>', '  <body>', `    ${body}`, '  </body>', '</html>', ''].join('\n');

const index = [
  '<script>',
  '  async function add(a: number, b: number) {',
  "    'use server';",
  '    return a + b;',
  '  }',
  '  async function save(form: FormData) {',
  "    'use server';",
  "    return String(form.get('name'));",
  '  }',
  '</script>',
  '',
  page(
    '<button onClick=(async () => { await add(2, 3); })>Add</button><form class="sign" action=save method="post"><input name="name"><button>Sign</button></form>',
  ),
].join('\n');

function writeApp(): void {
  rmSync(app, { recursive: true, force: true });
  mkdirSync(`${app}src/routes/api`, { recursive: true });
  mkdirSync(`${app}public`, { recursive: true });
  writeFileSync(`${app}public/hello.txt`, 'hello from public');
  writeFileSync(`${app}src/routes/index.brm`, index);
  writeFileSync(
    `${app}src/routes/api/echo.ts`,
    [
      'export async function POST(request: Request): Promise<Response> {',
      '  return new Response(`echo ${await request.text()} ${new URL(request.url).host}`);',
      '}',
      '',
    ].join('\n'),
  );
  const endpoints: Record<string, string> = {
    chunks: [
      'export function GET(): Response {',
      '  const encoder = new TextEncoder();',
      '  const stream = new ReadableStream({',
      '    async start(controller) {',
      "      controller.enqueue(encoder.encode('one'));",
      '      await new Promise((resolve) => setTimeout(resolve, 150));',
      "      controller.enqueue(encoder.encode('two'));",
      '      controller.close();',
      '    },',
      '  });',
      '  return new Response(stream);',
      '}',
    ].join('\n'),
    cookies: [
      'export function GET(): Response {',
      '  const headers = new Headers();',
      "  headers.append('set-cookie', 'a=1');",
      "  headers.append('set-cookie', 'b=2');",
      "  return new Response('ok', { headers });",
      '}',
    ].join('\n'),
    url: 'export function GET(request: Request): Response {\n  return new Response(request.url);\n}',
    hang: [
      'export function GET(request: Request): Response {',
      '  const state = globalThis as { devPagesAborted?: boolean };',
      '  state.devPagesAborted = false;',
      "  request.signal.addEventListener('abort', () => {",
      '    state.devPagesAborted = true;',
      '  });',
      '  const encoder = new TextEncoder();',
      '  const stream = new ReadableStream({',
      '    start(controller) {',
      "      controller.enqueue(encoder.encode('first'));",
      '    },',
      '  });',
      '  return new Response(stream);',
      '}',
    ].join('\n'),
    boom: [
      'export function GET(): Response {',
      '  const encoder = new TextEncoder();',
      '  const stream = new ReadableStream({',
      '    async start(controller) {',
      "      controller.enqueue(encoder.encode('partial'));",
      '      await new Promise((resolve) => setTimeout(resolve, 50));',
      "      controller.error(new Error('stream broke'));",
      '    },',
      '  });',
      '  return new Response(stream);',
      '}',
    ].join('\n'),
  };
  for (const [name, code] of Object.entries(endpoints)) {
    writeFileSync(`${app}src/routes/api/${name}.ts`, `${code}\n`);
  }
}

const errors: string[] = [];

function recordErrors(): NonNullable<InlineConfig['customLogger']> {
  return {
    info() {},
    warn() {},
    warnOnce() {},
    error(message) {
      errors.push(message);
    },
    clearScreen() {},
    hasErrorLogged: () => false,
    hasWarned: false,
  };
}

async function waitFor(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50 && !check(); attempt++) {
    // oxlint-disable-next-line no-await-in-loop -- Polls until the server has seen it.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function makeConfig(extra: InlineConfig = {}, plugins: Plugin[] = []): InlineConfig {
  return {
    root: app,
    configFile: false,
    logLevel: 'silent',
    plugins: [brumate({ merge: 0 }), ...plugins],
    customLogger: recordErrors(),
    server: { port: 0, host: '127.0.0.1', ...extra.server },
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
    ...extra,
  };
}

async function listen(config: InlineConfig): Promise<{ dev: ViteDevServer; url: string }> {
  const dev = await createServer(config);
  await dev.listen();
  const { port } = dev.httpServer!.address() as AddressInfo;
  return { dev, url: `http://127.0.0.1:${port}` };
}

beforeAll(() => {
  writeApp();
});

describe('vite dev without a server file', () => {
  let dev: ViteDevServer;
  let url = '';
  beforeAll(async () => {
    ({ dev, url } = await listen(makeConfig()));
  });
  afterAll(async () => {
    await dev.close();
  });

  it('serves a page, streamed, with the scripts', async () => {
    const response = await fetch(`${url}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('<form');
    expect(html).toContain('/@vite/client');
  });

  it('answers a POST endpoint with the body and the host', async () => {
    const response = await fetch(`${url}/api/echo`, { method: 'POST', body: 'data' });
    expect(await response.text()).toBe(`echo data ${new URL(url).host}`);
  });

  it('answers a form post without scripts with a redirect back', async () => {
    const html = await (await fetch(`${url}/`)).text();
    const action = /action="([^"]+)"/.exec(html)![1]!.replaceAll('&amp;', '&');
    const body = new FormData();
    body.set('name', 'Ada');
    const response = await fetch(new URL(action, url), {
      method: 'POST',
      body,
      headers: { referer: `${url}/?from=form` },
      redirect: 'manual',
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${url}/?from=form`);
  });

  it('answers a server function call', async () => {
    const html = await (await fetch(`${url}/`)).text();
    const action = /action="([^"]+)"/.exec(html)![1]!.replaceAll('&amp;', '&');
    const call = action.replace(/save$/, 'add');
    expect(call).not.toBe(action);
    const response = await fetch(new URL(call, url), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toJSON([2, 3])),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('5');
  });

  it('streams a body in more than one chunk', async () => {
    const response = await fetch(`${url}/api/chunks`);
    const reader = response.body!.getReader();
    const chunks: string[] = [];
    const decoder = new TextDecoder();
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop -- Reads in order.
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(decoder.decode(value));
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe('onetwo');
  });

  it('answers HEAD with the status and no body', async () => {
    const response = await fetch(`${url}/`, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toBe('');
  });

  it('keeps each set-cookie header', async () => {
    const response = await fetch(`${url}/api/cookies`);
    expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2']);
  });

  it('builds the request URL from the Host header and the query', async () => {
    const response = await fetch(`${url}/api/url?x=1`);
    expect(await response.text()).toBe(`${url}/api/url?x=1`);
  });

  it('aborts the request signal when the client leaves, without a logged error', async () => {
    const before = errors.length;
    const controller = new AbortController();
    const response = await fetch(`${url}/api/hang`, { signal: controller.signal });
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('first');
    controller.abort();
    await reader.read().catch(() => undefined);
    const state = globalThis as { devPagesAborted?: boolean };
    await waitFor(() => state.devPagesAborted === true);
    expect(state.devPagesAborted).toBe(true);
    // The error of a closed connection would come after the abort.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(errors.slice(before)).toEqual([]);
  });

  it('logs a stream error and ends the response', async () => {
    const before = errors.length;
    const response = await fetch(`${url}/api/boom`);
    await response.text().catch(() => undefined);
    await waitFor(() => errors.length > before);
    expect(errors.slice(before).join('\n')).toContain('stream broke');
  });

  it('leaves public files and the client of Vite to Vite', async () => {
    expect(await (await fetch(`${url}/hello.txt`)).text()).toBe('hello from public');
    const client = await fetch(`${url}/@vite/client`);
    expect(client.headers.get('content-type')).toContain('javascript');
  });

  it('answers 404 with the page of the routes for an unknown path', async () => {
    const response = await fetch(`${url}/missing`);
    expect(response.status).toBe(404);
  });

  it('shows the error page for a compile error and recovers after the fix', async () => {
    writeFileSync(`${app}src/routes/index.brm`, '<html><body>{</body></html>\n');
    let status = 0;
    let text = '';
    for (let attempt = 0; attempt < 40; attempt++) {
      // oxlint-disable-next-line no-await-in-loop -- Waits for the watcher.
      const response = await fetch(`${url}/`);
      status = response.status;
      // oxlint-disable-next-line no-await-in-loop -- Waits for the watcher.
      text = await response.text();
      if (status === 500) {
        break;
      }
      // oxlint-disable-next-line no-await-in-loop -- Waits for the watcher.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(status).toBe(500);
    expect(text).toContain('<!doctype html>');
    expect(text).toContain('brumate');

    writeFileSync(`${app}src/routes/index.brm`, index);
    for (let attempt = 0; attempt < 40; attempt++) {
      // oxlint-disable-next-line no-await-in-loop -- Waits for the watcher.
      const response = await fetch(`${url}/`);
      status = response.status;
      if (status === 200) {
        break;
      }
      // oxlint-disable-next-line no-await-in-loop -- Waits for the watcher.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(status).toBe(200);
  });
});

describe('servers that own their requests', () => {
  it('installs no middleware with middlewareMode', async () => {
    const dev = await createServer(makeConfig({ server: { middlewareMode: true } }));
    try {
      expect(dev.config.appType).toBe('custom');
      // A middleware that would answer sends back a response for any path.
      const answered = await new Promise<boolean>((resolve) => {
        const request = { url: '/', method: 'GET', headers: {}, socket: {} };
        const response = {
          on() {},
          setHeader() {},
          writeHead() {
            resolve(true);
          },
          end() {
            resolve(true);
          },
        };
        dev.middlewares(request as never, response as never, () => resolve(false));
      });
      expect(answered).toBe(false);
    } finally {
      await dev.close();
    }
  });

  it('installs no middleware when a nitro environment exists', async () => {
    const nitro: Plugin = {
      name: 'fake-nitro',
      config() {
        return { environments: { nitro: { consumer: 'server' } } };
      },
    };
    const { dev, url } = await listen(makeConfig({}, [nitro]));
    try {
      expect(dev.environments.nitro).toBeDefined();
      const response = await fetch(`${url}/`);
      // Vite finds no file and nothing answers.
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain('<form');
    } finally {
      await dev.close();
    }
  });
});

describe('base', () => {
  it('serves pages under a base, with the URL that the routes know', async () => {
    const { dev, url } = await listen(makeConfig({ base: '/app/' }));
    try {
      const response = await fetch(`${url}/app/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<form');
      expect(await (await fetch(`${url}/app/api/url`)).text()).toBe(`${url}/api/url`);
    } finally {
      await dev.close();
    }
  });
});

describe('appType', () => {
  it('warns once and installs no middleware with appType spa', async () => {
    const warnings: string[] = [];
    const config = makeConfig({ appType: 'spa' });
    config.customLogger = {
      info() {},
      warn(message) {
        warnings.push(message);
      },
      warnOnce(message) {
        warnings.push(message);
      },
      error() {},
      clearScreen() {},
      hasErrorLogged: () => false,
      hasWarned: false,
    };
    const { dev, url } = await listen(config);
    try {
      const response = await fetch(`${url}/`);
      expect(await response.text()).not.toContain('<form');
      const found = warnings.filter((message) => message.includes("appType: 'custom'"));
      expect(found).toHaveLength(1);
    } finally {
      await dev.close();
    }
  });

  it('sets custom when the config leaves it unset', async () => {
    const dev = await createServer(makeConfig({ server: { middlewareMode: true } }));
    try {
      expect(dev.config.appType).toBe('custom');
    } finally {
      await dev.close();
    }
  });
});
