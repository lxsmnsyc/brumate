import { describe, expect, it } from 'vitest';
import { SerovalPluginValidationError, fromJSON } from 'seroval/read';
import { toJSON } from 'seroval/write';
import { ElementReference } from '../src/runtime/shared.ts';
import { plugins, serialOptions } from '../src/runtime/serial.ts';
import { fromChunkStream, toChunkStream } from '../src/runtime/stream.ts';

describe('validation of what is decoded from the network', () => {
  it('reads a well formed plugin node', () => {
    const json = toJSON(new ElementReference(1, 2), { plugins, ...serialOptions() });
    const value = fromJSON<ElementReference>(json, { plugins, ...serialOptions() });
    expect(value).toBeInstanceOf(ElementReference);
    expect(value.anchor).toBe(2);
  });

  it('rejects a plugin node whose field has the wrong type', () => {
    const json = JSON.parse(
      JSON.stringify(toJSON(new ElementReference(1, 2), { plugins, ...serialOptions() })),
    );
    // The anchor is a number; the client sends a string.
    json.t.s.b = { t: 1, s: 'not a number' };
    let thrown: unknown;
    try {
      fromJSON(json, { plugins, ...serialOptions() });
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).cause).toBeInstanceOf(SerovalPluginValidationError);
    expect((thrown as Error).cause).toMatchObject({ tag: 'brumate/element', field: 'b' });
  });

  it('reads a value from a byte stream, and fails the read of a malformed one', async () => {
    const stream = toChunkStream({ name: 'Ada', later: Promise.resolve(3) });
    const value = (await fromChunkStream(stream)) as { name: string; later: Promise<number> };
    expect(value.name).toBe('Ada');
    expect(await value.later).toBe(3);
    const bad = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('not a frame at all'));
        controller.close();
      },
    });
    await expect(fromChunkStream(bad)).rejects.toThrow(/./);
  });
});
