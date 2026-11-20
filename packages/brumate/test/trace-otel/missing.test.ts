import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentelemetry/api', () => {
  throw new Error('Cannot find package');
});

describe('otel without @opentelemetry/api', () => {
  it('throws once, naming the package and the install command', async () => {
    const { otel } = await import('../../src/runtime/otel.ts');
    const handler = otel();
    const span = {
      name: 'brumate.render' as const,
      label: 'x',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      start: 1,
      end: 2,
      status: 'ok' as const,
      attributes: {},
    };
    await expect(handler(span)).rejects.toThrow(
      /@opentelemetry\/api.*npm install @opentelemetry\/api/,
    );
    await expect(handler(span)).resolves.toBeUndefined();
  });
});
