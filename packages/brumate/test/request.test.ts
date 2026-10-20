import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { toJSON } from 'seroval';
import { compile } from '../src/index.ts';
import { handleRequest, renderToString } from '../src/runtime/server.ts';

const source = readFileSync(new URL('./render/session.brm', import.meta.url), 'utf8');
const output = new URL('./.output/request/', import.meta.url);
// oxlint-disable-next-line typescript/no-explicit-any -- The compiled module is loaded at runtime.
let session: any;

beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  const { server } = compile(source, { filename: 'session.brm' });
  writeFileSync(new URL('session.brm.ts', output), server);
  session = await import(new URL('session.brm.ts', output).href);
});

const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
afterAll(() => errors.mockRestore());

function call(
  name: string,
  args: unknown[],
  headers: Record<string, string> = {},
): Promise<Response | undefined> {
  return handleRequest(
    session.rpc,
    new Request(`http://localhost/_brumate/${encodeURIComponent(`Session_1fdcuk2#${name}`)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(toJSON(args)),
    }),
  );
}

describe('server functions and the request', () => {
  it('reads the request while a page renders', async () => {
    const request = new Request('http://localhost/', { headers: { 'x-user': 'Ada' } });
    const { html } = await renderToString(session.default, {}, { request });
    expect(html).toContain('<p class="user">Ada</p>');
  });

  it('reads the request in a call', async () => {
    const response = await call('whoami', [], { 'x-user': 'Grace' });
    expect(await response!.json()).toMatchObject({ t: { s: 'Grace' } });
  });

  it('sets response headers', async () => {
    const response = await call('login', ['Ada']);
    expect(response!.status).toBe(200);
    expect(response!.headers.get('set-cookie')).toBe('user=Ada');
  });

  it('sends the message and status of a ServerError', async () => {
    const response = await call('login', ['']);
    expect(response!.status).toBe(422);
    expect(await response!.json()).toEqual({ error: 'A name is required' });
  });

  it('hides the message of other errors', async () => {
    const response = await call('crash', []);
    expect(response!.status).toBe(500);
    expect(await response!.text()).not.toContain('hunter2');
  });

  it('redirects', async () => {
    const response = await call('login', ['admin']);
    expect(response!.status).toBe(204);
    expect(response!.headers.get('x-brumate-redirect')).toBe('/admin');
  });
});
