// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stubSpans } from '../trace/stub.ts';

beforeEach(() => {
  vi.stubGlobal('__BRUMATE_TRACE__', true);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function answer(status = 200, params = ''): Response {
  const state = `<script b-state b-scopes b-next="1" b-route="root"${params}>$bR(($R,$b)=>({}))</script>`;
  return new Response(`<!doctype html><html><body><p>page</p>${state}</body></html>`, {
    status,
    headers: { 'content-type': 'text/html' },
  });
}

/** The visit as the loader makes it, with the span of the navigation. */
async function prepare(url: string, init?: RequestInit) {
  const spans = stubSpans();
  const { setTraceHandler, traceNavigation } = await import('../../src/runtime/trace-browser.ts');
  setTraceHandler(spans.onTrace);
  const { navigate } = await import('../../src/runtime/navigate.ts');
  const trace = traceNavigation(url, init);
  return {
    spans,
    go: () => navigate({ url, init, trace, push: true, leave: async () => {}, enter: () => {} }),
  };
}

async function visit(url: string, init?: RequestInit): Promise<ReturnType<typeof stubSpans>> {
  const { spans, go } = await prepare(url, init);
  await go();
  return spans;
}

it('gives brumate.navigation with the route and the status, and sends traceparent', async () => {
  const headers: Headers[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      headers.push(new Headers(init.headers));
      return answer(200, ` b-params="${JSON.stringify({ id: '42' }).replace(/"/g, '&quot;')}"`);
    }),
  );
  const spans = await visit('/issues/42?secret=1#top');
  const [span] = spans.named('brumate.navigation');
  expect(spans.spans).toHaveLength(1);
  expect(span!.label).toBe('GET /issues/[id]');
  expect(span!.attributes).toEqual({
    'http.method': 'GET',
    'http.route': '/issues/[id]',
    'http.status_code': 200,
  });
  expect(span!.parentId).toBeUndefined();
  expect(span!.status).toBe('ok');
  expect(JSON.stringify(span)).not.toContain('secret');
  expect(headers[0]!.get('traceparent')).toBe(`00-${span!.traceId}-${span!.spanId}-01`);
});

it('gives error for a 5xx answer, with no path in the label or the route', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('<!doctype html><html><body>down</body></html>', {
          status: 503,
          headers: { 'content-type': 'text/html' },
        }),
    ),
  );
  const failed = await visit('/issues/42?secret=1');
  const [span] = failed.named('brumate.navigation');
  expect(span!.status).toBe('error');
  expect(span!.label).toBe('GET');
  expect(span!.attributes).toEqual({ 'http.method': 'GET', 'http.status_code': 503 });
  expect(JSON.stringify(span)).not.toContain('42');
});

it('gives error for a request that fails, with no path', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline');
    }),
  );
  const assign = vi.fn<(url: string) => void>();
  vi.stubGlobal('location', {
    ...window.location,
    assign,
    href: 'http://localhost/',
    origin: 'http://localhost',
  });
  const { spans, go } = await prepare('/issues/42');
  await expect(go()).rejects.toThrow('offline');
  const [span] = spans.named('brumate.navigation');
  expect(span!.error).toEqual({ message: 'offline' });
  expect(span!.label).toBe('GET');
  expect(span!.attributes).toEqual({ 'http.method': 'GET' });
});

it('ends a navigation that a later one replaced with no path', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ),
  );
  const first = await prepare('/issues/42');
  const running = first.go();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => answer()),
  );
  const second = await prepare('/issues/43');
  await second.go();
  await running;
  // The handler is the one of the second call. The replaced navigation ends first.
  const [replaced] = second.spans.named('brumate.navigation');
  expect(replaced!.label).toBe('GET');
  expect(replaced!.attributes).toEqual({ 'http.method': 'GET' });
  expect(JSON.stringify(replaced)).not.toContain('42');
});

it('sends no traceparent with a prefetch', async () => {
  const headers: Headers[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      headers.push(new Headers(init.headers));
      return answer();
    }),
  );
  const { setTraceHandler } = await import('../../src/runtime/trace-browser.ts');
  setTraceHandler(stubSpans().onTrace);
  const { prefetch } = await import('../../src/runtime/navigate.ts');
  prefetch('/issues/42');
  expect(headers).toHaveLength(1);
  expect(headers[0]!.has('traceparent')).toBe(false);
});

it('leaves a navigation with no state of a route without a route', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('<!doctype html><html><body>down</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    ),
  );
  const spans = await visit('/issues/42');
  const [span] = spans.named('brumate.navigation');
  expect(span!.attributes['http.route']).toBeUndefined();
  expect(span!.label).toBe('GET');
});
