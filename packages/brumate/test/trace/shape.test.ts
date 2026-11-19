import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { toJSON } from 'seroval';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../src/index.ts';
import { ServerError } from '../../src/runtime/request.ts';
import { handleRequest, handleRoute, render } from '../../src/runtime/server.ts';
import type { TraceSpan } from '../../src/runtime/server.ts';
import { stubSpans } from './stub.ts';

const input = new URL('./', import.meta.url);
const output = new URL('../.output/trace/', import.meta.url);

beforeAll(() => {
  mkdirSync(output, { recursive: true });
  for (const name of ['page', 'loading', 'defer']) {
    const { server } = compile(readFileSync(new URL(`${name}.brm`, input), 'utf8'), {
      filename: `${name}.brm`,
    });
    writeFileSync(new URL(`${name}.brm.ts`, output), server);
  }
});

// oxlint-disable-next-line typescript/no-explicit-any -- The compiled modules are loaded at runtime.
const load = (name: string): Promise<any> => import(new URL(`${name}.brm.ts`, output).href);

const logged = vi.spyOn(console, 'error');

afterEach(() => {
  logged.mockReset();
  logged.mockImplementation(() => {});
});

const HEX32 = /^[0-9a-f]{32}$/;
const HEX16 = /^[0-9a-f]{16}$/;

/** The span of a name, which must be one. */
function only(spans: TraceSpan[]): TraceSpan {
  expect(spans).toHaveLength(1);
  return spans[0]!;
}

/** Plain components are functions with an ID, as the compiler writes them. */
function component(render: () => string | Promise<string>, id: string) {
  return Object.assign(async () => render(), { brumateId: id });
}

describe('the spans of the server', () => {
  it('gives a request with a render for a page, with a memo and a call below it', async () => {
    const module = await load('page');
    const stub = stubSpans();
    const response = await handleRoute(
      { page: async () => module } as never,
      new Request('http://localhost/'),
      { onTrace: stub.onTrace, functions: module.rpc },
    );
    expect(await response?.text()).toContain('user 1');
    const request = only(stub.named('brumate.request'));
    const rendered = only(stub.named('brumate.render'));
    const memo = only(stub.named('brumate.memo'));
    expect(request.attributes).toMatchObject({
      'http.method': 'GET',
      'http.status_code': 200,
      'brumate.kind': 'page',
    });
    expect(request.attributes['http.route']).toBeTypeOf('string');
    expect(request.label).toMatch(/^GET /);
    expect(request.status).toBe('ok');
    expect(request.parentId).toBeUndefined();
    expect(rendered.parentId).toBe(request.spanId);
    expect(memo.parentId).toBe(rendered.spanId);
    // The call that the memo made runs in the render.
    const call = only(stub.named('brumate.call'));
    expect(call.parentId).toBe(rendered.spanId);
  });

  it('shapes every span the same way, with one trace and the parents of the spans', async () => {
    const module = await load('page');
    const stub = stubSpans();
    await (
      await handleRoute({ page: async () => module } as never, new Request('http://localhost/'), {
        onTrace: stub.onTrace,
      })
    )?.text();
    const ids = new Set(stub.spans.map((span) => span.spanId));
    expect(ids.size).toBe(stub.spans.length);
    expect(new Set(stub.spans.map((span) => span.traceId)).size).toBe(1);
    for (const span of stub.spans) {
      expect(span.traceId).toMatch(HEX32);
      expect(span.spanId).toMatch(HEX16);
      expect(span.end).toBeGreaterThanOrEqual(span.start);
      expect(span.start).toBeGreaterThan(1.6e12);
    }
    for (const span of stub.spans.filter((child) => child.name !== 'brumate.request')) {
      expect(ids.has(span.parentId!)).toBe(true);
    }
    // A child ends before its parent.
    const order = stub.spans.map((span) => span.name);
    expect(order.at(-1)).toBe('brumate.request');
    expect(order.indexOf('brumate.stream')).toBeLessThan(order.indexOf('brumate.request'));
  });

  it('gives a body for a #loading block and for a #defer block', async () => {
    const loading = await load('loading');
    const stub = stubSpans();
    await (
      await handleRoute({ page: async () => loading } as never, new Request('http://localhost/'), {
        onTrace: stub.onTrace,
      })
    )?.text();
    const body = only(stub.named('brumate.body'));
    expect(body.label).toMatch(/^#loading /);
    expect(body.parentId).toBe(only(stub.named('brumate.render')).spanId);

    const defer = await load('defer');
    const deferred = stubSpans();
    const answer = await handleRoute(
      { page: async () => defer } as never,
      new Request('http://localhost/', { headers: { 'x-brumate-defer': '0 0:0' } }),
      { onTrace: deferred.onTrace },
    );
    await answer?.text();
    expect(only(deferred.named('brumate.body')).label).toMatch(/^#defer /);
    expect(only(deferred.named('brumate.request')).attributes['brumate.kind']).toBe('defer');
  });

  it('gives a request of kind call, with the call below it, for a call from the browser', async () => {
    const stub = stubSpans();
    const response = await handleRequest(
      { save: () => 'saved' },
      new Request('http://localhost/_brumate/save', {
        method: 'POST',
        body: JSON.stringify(toJSON([])),
      }),
      '/_brumate',
      { onTrace: stub.onTrace },
    );
    expect(response?.status).toBe(200);
    await response?.text();
    const request = only(stub.named('brumate.request'));
    const call = only(stub.named('brumate.call'));
    expect(request.attributes).toMatchObject({
      'http.method': 'POST',
      'http.route': '/_brumate/save',
      'http.status_code': 200,
      'brumate.kind': 'call',
    });
    expect(call.label).toBe('save');
    expect(call.parentId).toBe(request.spanId);
    expect(call.traceId).toBe(request.traceId);
  });

  it('gives a request of kind form for a form post, to a function and to a page', async () => {
    const stub = stubSpans();
    const response = await handleRequest(
      { save: () => 'saved' },
      new Request('http://localhost/_brumate/save', {
        method: 'POST',
        headers: { referer: 'http://localhost/back' },
        body: new URLSearchParams({ a: 'b' }),
      }),
      '/_brumate',
      { onTrace: stub.onTrace },
    );
    expect(response?.status).toBe(303);
    expect(only(stub.named('brumate.request')).attributes['brumate.kind']).toBe('form');
    expect(only(stub.named('brumate.call')).label).toBe('save');

    const page = await load('page');
    const posted = stubSpans();
    const answer = await handleRoute(
      { page: async () => page } as never,
      new Request('http://localhost/?__action=save', {
        method: 'POST',
        body: new URLSearchParams({ a: 'b' }),
      }),
      { onTrace: posted.onTrace, functions: { save: () => 'saved', ...page.rpc } },
    );
    await answer?.text();
    expect(only(posted.named('brumate.request')).attributes['brumate.kind']).toBe('form');
    expect(posted.named('brumate.call').map((span) => span.label)).toContain('save');
  });

  it('gives a render of its own for a render without a request', async () => {
    const module = await load('page');
    const stub = stubSpans();
    const parts = await render(module.default, {}, { onTrace: stub.onTrace });
    for await (const chunk of parts.pending) {
      void chunk;
    }
    const rendered = only(stub.named('brumate.render'));
    expect(rendered.parentId).toBeUndefined();
    expect(stub.named('brumate.request')).toHaveLength(0);
    expect(only(stub.named('brumate.memo')).parentId).toBe(rendered.spanId);
  });
});

describe('traceparent', () => {
  const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
  const parentId = '00f067aa0ba902b7';
  const request = (traceparent: string) =>
    new Request('http://localhost/', { headers: { traceparent } });
  const tree = { page: async () => ({ default: component(() => '<p>Hi</p>', 'Page_1') }) };

  it('sets the trace and the parent of the root from a valid header', async () => {
    const stub = stubSpans();
    await (
      await handleRoute(tree as never, request(`00-${traceId}-${parentId}-01`), {
        onTrace: stub.onTrace,
      })
    )?.text();
    const root = only(stub.named('brumate.request'));
    expect(root.traceId).toBe(traceId);
    expect(root.parentId).toBe(parentId);
    expect(only(stub.named('brumate.render')).traceId).toBe(traceId);
    expect(only(stub.named('brumate.render')).parentId).toBe(root.spanId);
  });

  it('ignores a header that is not valid', async () => {
    for (const bad of [
      'garbage',
      `00-${traceId.toUpperCase()}-${parentId}-01`,
      `00-${'0'.repeat(32)}-${parentId}-01`,
      `00-${traceId}-${'0'.repeat(16)}-01`,
      `00-${traceId}-${parentId}`,
      `01-${traceId}-${parentId}-01`,
    ]) {
      const stub = stubSpans();
      // oxlint-disable-next-line no-await-in-loop -- Each header runs on its own.
      await (await handleRoute(tree as never, request(bad), { onTrace: stub.onTrace }))?.text();
      const root = only(stub.named('brumate.request'));
      expect(root.traceId).toMatch(HEX32);
      expect(root.traceId).not.toBe(traceId);
      expect(root.parentId).toBeUndefined();
    }
  });

  it('reads it for a call from the browser', async () => {
    const stub = stubSpans();
    const response = await handleRequest(
      { save: () => 1 },
      new Request('http://localhost/_brumate/save', {
        method: 'POST',
        headers: { traceparent: `00-${traceId}-${parentId}-00` },
        body: JSON.stringify(toJSON([])),
      }),
      '/_brumate',
      { onTrace: stub.onTrace },
    );
    await response?.text();
    const root = only(stub.named('brumate.request'));
    expect([root.traceId, root.parentId]).toEqual([traceId, parentId]);
  });
});

describe('errors', () => {
  it('gives status error and the message for a render that throws, and onError still runs', async () => {
    const stub = stubSpans();
    const seen: unknown[] = [];
    const boom = new Error('render failed');
    const response = await handleRoute(
      {
        page: async () => ({
          default: component(() => {
            throw boom;
          }, 'Page_1'),
        }),
        error: async () => ({ default: component(() => '<p>Sorry</p>', 'Error_1') }),
      } as never,
      new Request('http://localhost/'),
      { onTrace: stub.onTrace, onError: (error) => void seen.push(error) },
    );
    await response?.text();
    expect(response?.status).toBe(500);
    expect(seen).toEqual([boom]);
    const rendered = stub.named('brumate.render').find((span) => span.status === 'error');
    expect(rendered?.error).toEqual({ message: 'render failed' });
    expect(rendered?.error).not.toHaveProperty('stack');
    const request = only(stub.named('brumate.request'));
    expect(request.status).toBe('error');
    expect(request.attributes['http.status_code']).toBe(500);
  });

  it('gives status ok for a ServerError, which is an answer', async () => {
    const stub = stubSpans();
    const response = await handleRequest(
      {
        save() {
          throw new ServerError('Not allowed', { status: 403 });
        },
      },
      new Request('http://localhost/_brumate/save', {
        method: 'POST',
        body: JSON.stringify(toJSON([])),
      }),
      '/_brumate',
      { onTrace: stub.onTrace },
    );
    await response?.text();
    expect(response?.status).toBe(403);
    expect(only(stub.named('brumate.call')).status).toBe('ok');
    expect(only(stub.named('brumate.request')).status).toBe('ok');
  });

  it('gives status error for a call that throws', async () => {
    const stub = stubSpans();
    const response = await handleRequest(
      {
        save() {
          throw new Error('disk full');
        },
      },
      new Request('http://localhost/_brumate/save', {
        method: 'POST',
        body: JSON.stringify(toJSON([])),
      }),
      '/_brumate',
      { onTrace: stub.onTrace, onError: () => {} },
    );
    await response?.text();
    expect(only(stub.named('brumate.call'))).toMatchObject({
      status: 'error',
      error: { message: 'disk full' },
    });
  });

  it('does not change the answer when onTrace throws or rejects, and logs it', async () => {
    logged.mockImplementation(() => {});
    const tree = { page: async () => ({ default: component(() => '<p>Hi</p>', 'Page_1') }) };
    for (const onTrace of [
      () => {
        throw new Error('sink broke');
      },
      () => Promise.reject(new Error('sink rejected')),
    ]) {
      logged.mockClear();
      // oxlint-disable-next-line no-await-in-loop -- Each handler runs on its own.
      const response = await handleRoute(tree as never, new Request('http://localhost/'), {
        onTrace,
        onError: () => {
          throw new Error('onError must not get it');
        },
      });
      // oxlint-disable-next-line no-await-in-loop -- Each handler runs on its own.
      expect(await response?.text()).toContain('<p>Hi</p>');
      expect(response?.status).toBe(200);
      // oxlint-disable-next-line no-await-in-loop -- The rejection is logged on a later tick.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(logged).toHaveBeenCalled();
    }
  });
});

describe('privacy', () => {
  it('holds no cookie, authorization header, query string or call arguments', async () => {
    const stub = stubSpans();
    const module = await load('page');
    const secrets = ['sess-cookie-7', 'bearer-token-8', 'query-secret-9', 'arg-secret-10'];
    const headers = { cookie: `sid=${secrets[0]}`, authorization: `Bearer ${secrets[1]}` };
    const page = await handleRoute(
      { page: async () => module } as never,
      new Request(`http://localhost/?token=${secrets[2]}`, { headers }),
      { onTrace: stub.onTrace },
    );
    await page?.text();
    const call = await handleRequest(
      { save: (value: string) => `got ${value}` },
      new Request('http://localhost/_brumate/save', {
        method: 'POST',
        headers,
        body: JSON.stringify(toJSON([secrets[3]])),
      }),
      '/_brumate',
      { onTrace: stub.onTrace },
    );
    await call?.text();
    expect(stub.spans.length).toBeGreaterThan(2);
    const text = JSON.stringify(stub.spans);
    for (const secret of secrets) {
      expect(text).not.toContain(secret);
    }
  });
});

describe('when off', () => {
  it('makes no span without onTrace and not in development', async () => {
    const trace = await import('../../src/runtime/trace.ts');
    const made = vi.spyOn(trace, 'startSpan');
    const module = await load('page');
    const page = await handleRoute(
      { page: async () => module } as never,
      new Request('http://localhost/'),
    );
    await page?.text();
    const call = await handleRequest(
      { save: () => 1 },
      new Request('http://localhost/_brumate/save', {
        method: 'POST',
        body: JSON.stringify(toJSON([])),
      }),
    );
    await call?.text();
    expect(made).not.toHaveBeenCalled();
    // The spy sees the calls that a handler makes happen.
    const again = await handleRoute(
      { page: async () => module } as never,
      new Request('http://localhost/'),
      { onTrace: () => {} },
    );
    await again?.text();
    expect(made).toHaveBeenCalled();
    made.mockRestore();
  });

  it('keeps the dev trace of the page as it was, and spans from the same steps', async () => {
    const module = await load('loading');
    const stub = stubSpans();
    const html = await (
      await handleRoute({ page: async () => module } as never, new Request('http://localhost/'), {
        dev: true,
        onTrace: stub.onTrace,
      })
    )?.text();
    const script = /<script type="application\/json" b-trace>(.*?)<\/script>$/.exec(html!);
    const trace = JSON.parse(script![1]!) as { entries: { kind: string; label: string }[] };
    const entries = trace.entries.map((entry) => `brumate.${entry.kind} ${entry.label}`);
    const spans = stub.spans
      .filter((span) => span.name !== 'brumate.request')
      .map((span) => `${span.name} ${span.label}`);
    expect(spans.toSorted()).toEqual(entries.toSorted());
  });
});
