import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { toJSON } from 'seroval';
import { compile } from '../src/index.ts';
import { getEvent, handleRequest, isCrossSite, render } from '../src/runtime/server.ts';
import type { RequestCall } from '../src/runtime/server.ts';
import { fromChunkStream } from '../src/runtime/stream.ts';

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
    const { html } = await render(session.default, {}, { request });
    expect(html).toContain('<p class="user">Ada</p>');
  });

  it('reads the request in a call', async () => {
    const response = await call('whoami', [], { 'x-user': 'Grace' });
    expect(await fromChunkStream(response!.body!)).toBe('Grace');
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

describe('entry middleware for calls', () => {
  const id = 'Session_1fdcuk2#whoami';
  const request = (headers: Record<string, string> = {}): Request =>
    new Request(`http://localhost/_brumate/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(toJSON(['extra'])),
    });

  it('runs before the function, with the call and its arguments, and hands it locals', async () => {
    let seen: RequestCall | undefined;
    const response = await handleRequest(session.rpc, request({ 'x-user': 'Ada' }), '/_brumate', {
      middleware: async (event, next) => {
        expect(getEvent()).toBe(event);
        expect(event.kind).toBe('call');
        seen = event.call;
        (event.locals as { user?: string }).user = 'Ada';
        const answer = await next();
        answer.headers.set('x-entry', 'yes');
        return answer;
      },
    });
    expect(seen).toEqual({ id, args: ['extra'] });
    expect(response?.headers.get('x-entry')).toBe('yes');
    expect(await fromChunkStream(response!.body!)).toBe('Ada');
  });

  it('answers the call itself, so the function never runs', async () => {
    const response = await handleRequest(session.rpc, request(), '/_brumate', {
      middleware: (event) =>
        new Response('Forbidden', { status: 403, headers: { 'x-call': event.call!.id } }),
    });
    expect(response?.status).toBe(403);
    expect(response?.headers.get('x-call')).toBe(id);
  });

  it('runs after the cross-site check, and before the middleware of the file', async () => {
    const seen: string[] = [];
    const refused = await handleRequest(
      session.rpc,
      request({ origin: 'https://evil.example' }),
      '/_brumate',
      {
        middleware: (_event, next) => {
          seen.push('entry');
          return next();
        },
      },
    );
    expect(refused?.status).toBe(403);
    expect(seen).toEqual([]);
    await handleRequest(session.rpc, request(), '/_brumate', {
      middleware: (_event, next) => {
        seen.push('entry');
        return next();
      },
      fileMiddleware: {
        [id]: (_event, next) => {
          seen.push('file');
          return next();
        },
      },
    });
    expect(seen).toEqual(['entry', 'file']);
  });

  it('runs for a form that posts to a server function without scripts', async () => {
    const form = new FormData();
    form.set('name', 'Ada');
    const seen: string[] = [];
    const response = await handleRequest(
      { greet: (data: FormData) => `Hello ${data.get('name')}` },
      new Request('http://localhost/_brumate/greet', {
        method: 'POST',
        headers: { referer: 'http://localhost/form' },
        body: form,
      }),
      '/_brumate',
      {
        middleware: (event, next) => {
          seen.push(
            `${event.kind} ${event.call!.id} ${(event.call!.args[0] as FormData).get('name')}`,
          );
          return next();
        },
      },
    );
    expect(seen).toEqual(['call greet Ada']);
    expect(response?.status).toBe(303);
    expect(response?.headers.get('location')).toBe('http://localhost/form');
  });

  it('passes the promises of waitUntil in a call to the host', async () => {
    const kept: Promise<unknown>[] = [];
    await handleRequest(
      { log: () => getEvent().waitUntil(Promise.resolve('sent')) },
      new Request('http://localhost/_brumate/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toJSON([])),
      }),
      '/_brumate',
      { waitUntil: (promise) => kept.push(promise) },
    );
    expect(await Promise.all(kept)).toEqual(['sent']);
  });
});

/** A server function call with these headers. */
function post(headers: Record<string, string>): Request {
  return new Request('http://localhost:3000/_brumate/x', { method: 'POST', headers });
}

describe('calls from other sites', () => {
  it('answers 403 to a call from a page of another site', async () => {
    const response = await call('whoami', [], { origin: 'https://evil.example' });
    expect(response?.status).toBe(403);
  });

  it('answers a call from the same origin', async () => {
    const response = await call('whoami', [], { origin: 'http://localhost', 'x-user': 'Ada' });
    expect(response?.status).toBe(200);
  });

  it('allows the host that the server sees under another name, such as behind a proxy', () => {
    expect(isCrossSite(post({ origin: 'https://app.example', host: 'app.example' }))).toBe(false);
    expect(
      isCrossSite(post({ origin: 'https://app.example', 'x-forwarded-host': 'app.example' })),
    ).toBe(false);
    expect(isCrossSite(post({ origin: 'http://localhost:3000' }))).toBe(false);
  });

  it('allows the origins that the options list', () => {
    const request = post({ origin: 'https://admin.example' });
    expect(isCrossSite(request)).toBe(true);
    expect(isCrossSite(request, { origins: ['https://admin.example'] })).toBe(false);
  });

  it('decides with Sec-Fetch-Site when there is no Origin', () => {
    expect(isCrossSite(post({ 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(isCrossSite(post({ 'sec-fetch-site': 'same-origin' }))).toBe(false);
    // A request with neither does not come from a page in a browser.
    expect(isCrossSite(post({}))).toBe(false);
  });

  it('rejects an opaque origin, such as from a sandboxed frame', () => {
    expect(isCrossSite(post({ origin: 'null' }))).toBe(true);
  });
});

describe('regular expressions', () => {
  it('refuses a call that sends a regular expression', async () => {
    // seroval writes it when the feature is on, as a client could.
    const response = await call('whoami', [/a+$/]);
    expect(response?.status).toBe(500);
    expect(await response?.json()).toEqual({ error: 'The server function failed' });
  });
});

describe('values in the page and in calls', () => {
  it('sends URL and URLSearchParams', async () => {
    const { fromJSON } = await import('seroval');
    const { disabledFeatures, plugins } = await import('../src/runtime/serial.ts');
    const value = {
      url: new URL('https://example.com/a?b=1#c'),
      query: new URLSearchParams('x=1&x=2'),
    };
    const back = fromJSON<typeof value>(toJSON(value, { plugins, disabledFeatures }), {
      plugins,
      disabledFeatures,
    });
    expect(back.url).toBeInstanceOf(URL);
    expect(back.url.href).toBe('https://example.com/a?b=1#c');
    expect(back.query.getAll('x')).toEqual(['1', '2']);
  });
});
