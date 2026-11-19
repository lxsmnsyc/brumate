import { SpanStatusCode, trace } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { compile } from '../../src/index.ts';
import { otel } from '../../src/runtime/otel.ts';
import { handleRoute } from '../../src/runtime/server.ts';
import type { TraceSpan } from '../../src/runtime/server.ts';
import { stubSpans } from '../trace/stub.ts';

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

const output = new URL('../.output/trace-otel/', import.meta.url);
// oxlint-disable-next-line typescript/no-explicit-any -- The compiled module is loaded at runtime.
let page: any;

beforeAll(async () => {
  trace.setGlobalTracerProvider(provider);
  mkdirSync(output, { recursive: true });
  const source = readFileSync(new URL('../trace/page.brm', import.meta.url), 'utf8');
  const { server } = compile(source, { filename: 'page.brm' });
  writeFileSync(new URL('page.brm.ts', output), server);
  page = await import(new URL('page.brm.ts', output).href);
});

afterAll(async () => {
  trace.disable();
  await provider.shutdown();
});

beforeEach(() => {
  exporter.reset();
});

/** Runs a page request, and gives the spans that brumate made next to the exported ones. */
async function run(headers?: Record<string, string>) {
  const stub = stubSpans();
  const handler = otel();
  const response = await handleRoute(
    { page: async () => page } as never,
    new Request('http://localhost/', { headers }),
    {
      functions: page.rpc,
      onTrace: async (span) => {
        stub.onTrace(span);
        await handler(span);
      },
    },
  );
  await response?.text();
  return { brumate: stub.spans, exported: exporter.getFinishedSpans() };
}

/** The sorted names of spans. */
const names = (spans: { name: string }[]) => spans.map((span) => span.name).toSorted();

describe('otel', () => {
  it('exports the tree, names, attributes, times and status of a page request', async () => {
    const { brumate, exported } = await run();
    expect(exported).toHaveLength(brumate.length);
    expect(names(exported)).toEqual(names(brumate));
    expect(names(exported)).toEqual(
      expect.arrayContaining(['brumate.request', 'brumate.render', 'brumate.memo', 'brumate.call']),
    );

    const byName = new Map(exported.map((span) => [span.name, span]));
    for (const source of brumate) {
      const made = byName.get(source.name)!;
      expect(made.attributes).toMatchObject(source.attributes);
      expect(made.attributes['brumate.label']).toBe(source.label);
      expect(made.attributes['brumate.trace_id']).toBe(source.traceId);
      expect(made.attributes['brumate.span_id']).toBe(source.spanId);
      expect(made.attributes['brumate.parent_id']).toBe(source.parentId);
      expect(made.status.code).not.toBe(SpanStatusCode.ERROR);
      // Times as nanoseconds, from epoch milliseconds.
      const start = made.startTime[0] * 1e3 + made.startTime[1] / 1e6;
      const end = made.endTime[0] * 1e3 + made.endTime[1] / 1e6;
      expect(start).toBeCloseTo(source.start, 2);
      expect(end).toBeCloseTo(source.end, 2);
    }

    // The SDK makes the ids of a new trace; the spans share one.
    expect(new Set(exported.map((span) => span.spanContext().traceId)).size).toBe(1);

    // The tree: each exported parent is the exported span of the brumate parent.
    const idOf = new Map<string, string>();
    for (const source of brumate) {
      idOf.set(source.spanId, byName.get(source.name)!.spanContext().spanId);
    }
    for (const source of brumate) {
      const made = byName.get(source.name)!;
      expect(made.parentSpanContext?.spanId).toBe(
        source.parentId === undefined ? undefined : idOf.get(source.parentId),
      );
    }
  });

  it('gives the parent of an incoming traceparent to the request', async () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const parentId = '00f067aa0ba902b7';
    const { exported } = await run({ traceparent: `00-${traceId}-${parentId}-01` });
    const request = exported.find((span) => span.name === 'brumate.request')!;
    expect(request.spanContext().traceId).toBe(traceId);
    expect(request.parentSpanContext?.spanId).toBe(parentId);
    expect(new Set(exported.map((span) => span.spanContext().traceId)).size).toBe(1);
  });

  it('gives SpanStatusCode.ERROR and the message to an error span', async () => {
    const handler = otel();
    const span: TraceSpan = {
      name: 'brumate.call',
      label: 'save',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      start: Date.now(),
      end: Date.now() + 5,
      status: 'error',
      attributes: {},
      error: { message: 'no space' },
    };
    await handler(span);
    const [made] = exporter.getFinishedSpans();
    expect(made!.status).toEqual({ code: SpanStatusCode.ERROR, message: 'no space' });
    expect(made!.events.map((event) => event.name)).toEqual(['exception']);
    expect(made!.events[0]!.attributes?.['exception.message']).toBe('no space');
    // The event is stamped inside the span, not at the time of export.
    const at = made!.events[0]!.time[0] * 1e3 + made!.events[0]!.time[1] / 1e6;
    expect(at).toBeGreaterThanOrEqual(span.start);
    expect(at).toBeLessThanOrEqual(span.end);
  });

  it('exports a child that never meets its parent, after the wait', async () => {
    const handler = otel();
    const now = Date.now();
    const base = {
      label: 'x',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      status: 'ok' as const,
      attributes: {},
    };
    await handler({
      ...base,
      name: 'brumate.memo',
      spanId: 'aaaaaaaaaaaaaaaa',
      parentId: 'bbbbbbbbbbbbbbbb',
      start: now,
      end: now,
    });
    expect(exporter.getFinishedSpans()).toHaveLength(0);
    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    await handler({
      ...base,
      name: 'brumate.render',
      spanId: 'cccccccccccccccc',
      start: now,
      end: now,
    });
    vi.restoreAllMocks();
    expect(
      exporter
        .getFinishedSpans()
        .map((span) => span.name)
        .toSorted(),
    ).toEqual(['brumate.memo', 'brumate.render']);
  });

  it('exports the oldest waiting spans as roots past the cap', async () => {
    const handler = otel();
    const now = Date.now();
    for (let index = 0; index < 10_002; index += 1) {
      await handler({
        name: 'brumate.memo',
        label: 'x',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: index.toString(16).padStart(16, '0'),
        parentId: 'ffffffffffffffff',
        status: 'ok',
        attributes: {},
        start: now,
        end: now,
      });
    }
    expect(exporter.getFinishedSpans()).toHaveLength(2);
  });

  it.skipIf(!existsSync(new URL('../../dist/runtime/server.js', import.meta.url)))(
    'is a server-only entry (needs `pnpm build`): nothing of it is in the server or client build',
    () => {
      for (const file of ['server.js', 'client.js']) {
        const code = readFileSync(new URL(`../../dist/runtime/${file}`, import.meta.url), 'utf8');
        expect(code).not.toContain('@opentelemetry');
      }
    },
  );
});
