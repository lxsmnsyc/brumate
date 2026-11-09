import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHTTPServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { toJSON } from 'seroval';
import { build, createServer } from 'vite';
import type { InlineConfig, Rolldown, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  DEV_HEADER,
  cutText,
  cutValue,
  decodeServerRecord,
  encodeServerRecord,
  readCall,
} from '../src/runtime/devtools-calls.ts';
import brumate from '../src/vite.ts';

vi.setConfig({ testTimeout: 30_000 });

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));
const root = fileURLToPath(new URL('./.output/devtools-calls/', import.meta.url));

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
      'brumate/bundles': runtime('bundles'),
      'brumate/context': runtime('context'),
      'brumate/events': runtime('events'),
      'brumate/serial': runtime('values'),
      'brumate/stream': runtime('gather'),
      'brumate/store': runtime('store'),
    },
  },
};

let server: ViteDevServer;
let http: Server;
let port: number;
let ids: string[];

beforeAll(async () => {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  writeFileSync(
    `${root}api.ts`,
    `'use server';
export async function helper(n: number) {
  console.log('helping', n);
  return n * 2;
}
export async function add(a: number, b: number) {
  console.log('adding', { a, b });
  console.warn('careful');
  const doubled = await helper(a);
  return { sum: a + b, doubled, long: 'x'.repeat(5000) };
}
export async function boom() {
  console.log('about to fail');
  throw new Error('The database password is hunter2');
}
`,
  );
  writeFileSync(`${root}Page.brm`, '<p>Hi</p>\n');
  server = await createServer({ ...config, appType: 'custom', server: { middlewareMode: true } });
  http = createHTTPServer(server.middlewares);
  await new Promise<void>((resolve) => http.listen(0, resolve));
  port = (http.address() as AddressInfo).port;
  const { functions } = await server.ssrLoadModule('virtual:brumate/server');
  ids = Object.keys(functions);
});

afterAll(async () => {
  http.close();
  await server.close();
});

function id(name: string): string {
  const found = ids.find((item) => item.endsWith(`#${name}`));
  expect(found).toBeDefined();
  return found!;
}

function post(
  name: string,
  args: unknown[],
  headers: Record<string, string> = {},
): Promise<Response> {
  const body = JSON.stringify(toJSON(args));
  return fetch(`http://localhost:${port}/_brumate/${encodeURIComponent(id(name))}`, {
    method: 'POST',
    headers,
    body,
  });
}

describe('call record in development', () => {
  it('records arguments, result, logs and a nested call', async () => {
    const started = performance.now();
    const args = [2, 3];
    const response = await post('add', args, { cookie: 'session=s3cret', 'x-token': 'abc123' });
    const arrived = performance.now();
    expect(response.status).toBe(200);
    const record = await readCall({
      name: 'add',
      init: { body: JSON.stringify(toJSON(args)) },
      response: response.clone(),
      started,
      arrived,
      module: 4,
    });
    expect(record.args).toEqual([2, 3]);
    expect(record.result).toMatchObject({ sum: 5, doubled: 4 });
    // The long value is cut.
    const long = (record.result as { long: string }).long;
    expect(long.length).toBeLessThan(1100);
    expect(long).toContain('more)');
    expect(record.error).toBeUndefined();
    expect(record.server!.logs).toEqual([
      { level: 'log', text: 'adding { a: 2, b: 3 }' },
      { level: 'warn', text: 'careful' },
      { level: 'log', text: 'helping 2' },
    ]);
    // The first call is the browser's own, so only the nested call is listed.
    expect(record.server!.calls).toEqual([id('helper')]);
    expect(record.timing.module).toBe(4);
    expect(record.timing.server).toBeGreaterThanOrEqual(0);
    // No cookie and no header reaches the record or the header.
    const text = JSON.stringify(record) + (response.headers.get(DEV_HEADER) ?? '');
    expect(text).not.toContain('s3cret');
    expect(text).not.toContain('abc123');
  });

  it('records the real error with its stack, while the browser gets the generic message', async () => {
    const response = await post('boom', []);
    expect(response.status).toBe(500);
    const body = await response.clone().json();
    expect(body.error).toBe('The server function failed');
    const record = await readCall({
      name: 'boom',
      init: { body: JSON.stringify(toJSON([])) },
      response,
      started: performance.now(),
      arrived: performance.now(),
      module: 0,
    });
    expect(record.error!.message).toBe('The database password is hunter2');
    expect(record.error!.stack).toContain('boom');
    expect(record.server!.logs.map((log) => log.text)).toContain('about to fail');
    expect(record.result).toBeUndefined();
  });

  it('keeps logs of calls that run together apart', async () => {
    const [first, second] = await Promise.all([post('add', [10, 1]), post('add', [20, 1])]);
    const one = decodeServerRecord(first.headers.get(DEV_HEADER))!;
    const two = decodeServerRecord(second.headers.get(DEV_HEADER))!;
    expect(one.logs[0]!.text).toBe('adding { a: 10, b: 1 }');
    expect(two.logs[0]!.text).toBe('adding { a: 20, b: 1 }');
  });
});

describe('call record in production', () => {
  it('sends no dev field from the production handler', async () => {
    const { handle } = await server.ssrLoadModule('virtual:brumate/server');
    const response = await handle(
      new Request(`http://localhost/_brumate/${encodeURIComponent(id('add'))}`, {
        method: 'POST',
        body: JSON.stringify(toJSON([1, 2])),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get(DEV_HEADER)).toBeNull();
    const record = await readCall({
      name: 'add',
      init: { body: JSON.stringify(toJSON([1, 2])) },
      response,
      started: 0,
      arrived: 1,
      module: 0,
    });
    expect(record.server).toBeUndefined();
    expect(record.result).toMatchObject({ sum: 3 });
  });

  it('keeps the recorder out of the client build', async () => {
    const result = (await build({
      ...config,
      build: { write: false, minify: true, rolldownOptions: { input: 'virtual:brumate/start' } },
    })) as Rolldown.RolldownOutput;
    const code = result.output.map((item) => (item.type === 'chunk' ? item.code : '')).join('\n');
    expect(code).not.toContain(DEV_HEADER);
    expect(code).not.toContain('brumate.callHook');
    expect(code).not.toContain('devtools-calls');
  });
});

describe('header size', () => {
  it('drops ids and cuts a long message until the header fits', () => {
    const ids = Array.from({ length: 50 }, () => `${'f'.repeat(300)}#name`);
    const error = { message: 'ü'.repeat(5000), stack: 's'.repeat(2000) };
    const text = encodeServerRecord({ reads: ids, calls: ids, logs: [], error });
    expect(text.length).toBeLessThanOrEqual(6000);
    const record = decodeServerRecord(text)!;
    expect(record.calls).toEqual([]);
    expect(record.error!.message.length).toBeGreaterThan(0);
    // The record that the caller passed is not changed.
    expect(error.stack).toHaveLength(2000);
  });
});

describe('cut values', () => {
  it('cuts text, lists, depth and cycles', () => {
    expect(cutText('abc', 2)).toBe('ab… (1 more)');
    const list = cutValue(Array.from({ length: 80 }, (_, index) => index)) as unknown[];
    expect(list).toHaveLength(51);
    expect(list.at(-1)).toBe('… 30 more');
    const loop: Record<string, unknown> = { name: 'loop' };
    loop.self = loop;
    expect(cutValue(loop)).toEqual({ name: 'loop', self: '[Circular]' });
    let deep: unknown = 'end';
    for (let index = 0; index < 8; index++) {
      deep = { deep };
    }
    expect(JSON.stringify(cutValue(deep))).toContain('[Object]');
    expect(cutValue(() => 1)).toBe('[Function anonymous]');
    expect(cutValue(10n)).toBe('10n');
  });

  it('fits the header by dropping logs and then the stack', () => {
    const logs = Array.from({ length: 50 }, () => ({ level: 'log', text: 'y'.repeat(1000) }));
    const text = encodeServerRecord({
      reads: [],
      calls: [],
      logs,
      error: { message: 'm', stack: 's'.repeat(2000) },
    });
    expect(text.length).toBeLessThanOrEqual(6000);
    expect(decodeServerRecord(text)!.truncated).toBe(true);
  });
});
