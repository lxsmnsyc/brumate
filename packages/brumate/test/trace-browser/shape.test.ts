// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientModule } from '../../src/runtime/client.ts';
import { stubSpans } from '../trace/stub.ts';

// The spans of the browser, with a loader and client modules made by hand. The real browser run is
// in the e2e suite `trace`.

let stop: (() => void) | undefined;
let requests: { url: string; headers: Headers }[];

beforeEach(() => {
  vi.stubGlobal('__BRUMATE_TRACE__', true);
  vi.resetModules();
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      requests.push({ url, headers: new Headers(init.headers) });
      return Promise.resolve(new Response(JSON.stringify({ error: 'no' }), { status: 400 }));
    }),
  );
  document.body.innerHTML = '<button b-on="click=Todos#add">Add</button>';
});

afterEach(() => {
  stop?.();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

/** The loader, started with a module whose code loads after a delay. */
async function start(
  handlers: Record<string, unknown>,
  onTrace?: (span: never) => unknown,
  onError?: (error: unknown) => void,
): Promise<void> {
  const { start: begin } = await import('../../src/runtime/loader.ts');
  stop = begin({
    navigate: false,
    onTrace: onTrace as never,
    onError,
    load: (id) =>
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ id, props: {}, g: {}, ...handlers } as unknown as ClientModule),
          20,
        ),
      ),
  });
}

const click = (): void => {
  document.querySelector('button')!.dispatchEvent(new Event('click', { bubbles: true }));
};

describe('events', () => {
  it('splits the first click into the load of the code and the run of the handler', async () => {
    const spans = stubSpans();
    await start({ add: () => {} }, spans.onTrace);
    click();
    await vi.waitFor(() => expect(spans.named('brumate.event')).toHaveLength(1));
    expect(spans.spans.map((span) => span.name)).toEqual([
      'brumate.load',
      'brumate.run',
      'brumate.event',
    ]);
    const [load, run, event] = spans.spans;
    expect(event!.label).toBe('click Todos#add');
    expect(event!.parentId).toBeUndefined();
    expect(load!.parentId).toBe(event!.spanId);
    expect(run!.parentId).toBe(event!.spanId);
    expect(new Set(spans.spans.map((span) => span.traceId)).size).toBe(1);
    expect(event!.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(event!.spanId).toMatch(/^[0-9a-f]{16}$/);
    // The work in order: the event starts first, the code loads, then the handler runs.
    expect(load!.start).toBe(event!.start);
    expect(load!.end).toBeLessThanOrEqual(run!.start);
    expect(run!.end).toBeLessThanOrEqual(event!.end);
    expect(load!.end - load!.start).toBeGreaterThanOrEqual(15);
    expect(spans.spans.every((span) => span.status === 'ok')).toBe(true);
  });

  it('makes no load span for a handler whose code is there, and a new trace for each event', async () => {
    const spans = stubSpans();
    await start({ add: () => {} }, spans.onTrace);
    click();
    await vi.waitFor(() => expect(spans.named('brumate.event')).toHaveLength(1));
    click();
    await vi.waitFor(() => expect(spans.named('brumate.event')).toHaveLength(2));
    expect(spans.named('brumate.load')).toHaveLength(1);
    expect(spans.named('brumate.run')).toHaveLength(2);
    const [first, second] = spans.named('brumate.event');
    expect(first!.traceId).not.toBe(second!.traceId);
  });

  it('ends the event when the promise of an async handler settles', async () => {
    const spans = stubSpans();
    await start({ add: () => new Promise((done) => setTimeout(done, 30)) }, spans.onTrace);
    click();
    await vi.waitFor(() => expect(spans.named('brumate.event')).toHaveLength(1));
    const [run] = spans.named('brumate.run');
    expect(run!.end - run!.start).toBeGreaterThanOrEqual(25);
  });

  it('gives error with the message when the handler throws, and the error path runs', async () => {
    const spans = stubSpans();
    const errors: unknown[] = [];
    await start(
      {
        add: () => {
          throw new Error('boom');
        },
      },
      spans.onTrace,
      (error) => errors.push(error),
    );
    click();
    await vi.waitFor(() => expect(spans.named('brumate.event')).toHaveLength(1));
    for (const name of ['brumate.run', 'brumate.event'] as const) {
      const [span] = spans.named(name);
      expect(span!.status).toBe('error');
      expect(span!.error).toEqual({ message: 'boom' });
    }
    expect(errors).toHaveLength(1);
  });

  it('gives error for the load of code that fails', async () => {
    const spans = stubSpans();
    const { start: begin } = await import('../../src/runtime/loader.ts');
    stop = begin({
      navigate: false,
      onTrace: spans.onTrace,
      onError: () => {},
      load: () => Promise.reject(new Error('chunk failed')),
    });
    click();
    await vi.waitFor(() => expect(spans.named('brumate.event')).toHaveLength(1));
    expect(spans.named('brumate.load')[0]!.error).toEqual({ message: 'chunk failed' });
    expect(spans.named('brumate.event')[0]!.status).toBe('error');
  });

  it('logs a throw of onTrace and changes nothing', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ran: number[] = [];
    await start({ add: () => ran.push(1) }, () => {
      throw new Error('bad exporter');
    });
    click();
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(ran).toEqual([1]);
    log.mockRestore();
  });

  it('keeps no secret in a span', async () => {
    const spans = stubSpans();
    await start({ add: () => {} }, spans.onTrace);
    document.querySelector('button')!.setAttribute('value', 'secret');
    click();
    await vi.waitFor(() => expect(spans.named('brumate.event')).toHaveLength(1));
    expect(JSON.stringify(spans.spans)).not.toContain('secret');
  });
});

describe('server calls', () => {
  it('makes brumate.fetch a child of the run, and sends its ID in traceparent', async () => {
    const spans = stubSpans();
    const { rpc } = await import('../../src/runtime/client.ts');
    await start(
      {
        add: async () => {
          await rpc('save', ['private argument']).catch(() => {});
        },
      },
      spans.onTrace,
    );
    click();
    await vi.waitFor(() => expect(spans.named('brumate.event')).toHaveLength(1));
    const [fetchSpan] = spans.named('brumate.fetch');
    const [run] = spans.named('brumate.run');
    const [event] = spans.named('brumate.event');
    expect(fetchSpan!.parentId).toBe(run!.spanId);
    expect(fetchSpan!.traceId).toBe(event!.traceId);
    expect(fetchSpan!.label).toBe('save');
    expect(fetchSpan!.attributes['http.status_code']).toBe(400);
    expect(requests[0]!.headers.get('traceparent')).toBe(
      `00-${event!.traceId}-${fetchSpan!.spanId}-01`,
    );
    expect(JSON.stringify(spans.spans)).not.toContain('private argument');
  });

  it('gives a call after an await a trace of its own, not the one of an overlapping handler', async () => {
    const spans = stubSpans();
    const { rpc } = await import('../../src/runtime/client.ts');
    let started = false;
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    document.body.innerHTML =
      '<button b-on="click=Todos#first">A</button><button class="b" b-on="click=Todos#second">B</button>';
    await start(
      {
        // A calls before its first await, and again after it.
        first: async () => {
          await rpc('before', []).catch(() => {});
          await gate;
          await rpc('after', []).catch(() => {});
        },
        // B stays pending while A makes its second call.
        second: () => {
          started = true;
          return gate;
        },
      },
      spans.onTrace,
    );
    document.querySelector('button')!.dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    document.querySelector('.b')!.dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(started).toBe(true));
    release();
    await vi.waitFor(() => expect(spans.named('brumate.event')).toHaveLength(2));
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    const events = spans.named('brumate.event');
    const [before, after] = spans.named('brumate.fetch');
    const a = events.find((span) => span.label === 'click Todos#first')!;
    const b = events.find((span) => span.label === 'click Todos#second')!;
    // The call before the first await is a child of the run of A.
    expect(before!.label).toBe('before');
    expect(before!.traceId).toBe(a.traceId);
    // The call after it joins neither A nor B.
    expect(after!.label).toBe('after');
    expect(after!.parentId).toBeUndefined();
    expect(after!.traceId).not.toBe(a.traceId);
    expect(after!.traceId).not.toBe(b.traceId);
    expect(requests[1]!.headers.get('traceparent')).toBe(
      `00-${after!.traceId}-${after!.spanId}-01`,
    );
  });

  it('sends no traceparent to another origin, and still makes the span', async () => {
    const spans = stubSpans();
    const { rpc } = await import('../../src/runtime/client.ts');
    const { start: begin } = await import('../../src/runtime/loader.ts');
    stop = begin({
      navigate: false,
      rpc: 'https://api.example.com/_brumate',
      onTrace: spans.onTrace,
      load: (id) =>
        Promise.resolve({
          id,
          props: {},
          g: {},
          add: () => rpc('save', []).catch(() => {}),
        } as unknown as ClientModule),
    });
    document.querySelector('button')!.dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(spans.named('brumate.fetch')).toHaveLength(1));
    expect(requests[0]!.url.startsWith('https://api.example.com/')).toBe(true);
    expect(requests[0]!.headers.has('traceparent')).toBe(false);
  });

  it('sends no header without onTrace', async () => {
    const { rpc } = await import('../../src/runtime/client.ts');
    await start({ add: () => rpc('save', []).catch(() => {}) });
    click();
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]!.headers.has('traceparent')).toBe(false);
  });

  it('makes no span with the build constant off', async () => {
    vi.stubGlobal('__BRUMATE_TRACE__', false);
    vi.resetModules();
    const spans = stubSpans();
    await start({ add: () => {} }, spans.onTrace);
    click();
    await new Promise((done) => setTimeout(done, 80));
    expect(spans.spans).toEqual([]);
  });
});
