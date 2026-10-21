// The answer of a server function, as a stream of seroval chunks. Promises
// and async iterables in the answer settle as their chunks arrive.
//
// Each chunk is a 12-byte header with the size of its data in bytes, as 8
// hex digits, and the data: `;0x0000001f;{...}`. The reader knows how many
// bytes to wait for, and can refuse a chunk that is too large.

import { fromCrossJSON, isStream, toCrossJSONStream } from 'seroval';
import type { SerovalNode } from 'seroval';
import { disabledFeatures, plugins } from './shared.ts';

const HEADER_SIZE = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** The content type of a stream of chunks. */
export const STREAM_TYPE = 'application/x-brumate-stream';

/** One chunk: its header and its data, in one array. */
function chunk(text: string): Uint8Array {
  const data = encoder.encode(text);
  const result = new Uint8Array(HEADER_SIZE + data.length);
  encoder.encodeInto(`;0x${data.length.toString(16).padStart(8, '0')};`, result);
  result.set(data, HEADER_SIZE);
  return result;
}

/** Serializes a value as a stream of chunks. */
export function toChunkStream(value: unknown): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      toCrossJSONStream(value, {
        refs: new Map(),
        plugins,
        disabledFeatures,
        onParse(node) {
          controller.enqueue(chunk(JSON.stringify(node)));
        },
        onDone() {
          controller.close();
        },
        onError(error) {
          controller.error(error);
        },
      });
    },
  });
}

/** Reads chunks of a stream, buffering only the bytes of the chunk it waits for. */
class ChunkReader {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private pieces: Uint8Array[] = [];
  private length = 0;
  private done = false;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }

  private async fill(size: number): Promise<void> {
    while (this.length < size && !this.done) {
      // oxlint-disable-next-line no-await-in-loop -- Pieces arrive in order.
      const piece = await this.reader.read();
      if (piece.done) {
        this.done = true;
      } else {
        this.pieces.push(piece.value);
        this.length += piece.value.length;
      }
    }
  }

  private take(size: number): Uint8Array {
    const result = new Uint8Array(size);
    let offset = 0;
    while (offset < size) {
      const piece = this.pieces[0]!;
      const count = Math.min(piece.length, size - offset);
      result.set(piece.subarray(0, count), offset);
      offset += count;
      if (count === piece.length) {
        this.pieces.shift();
      } else {
        this.pieces[0] = piece.subarray(count);
      }
    }
    this.length -= size;
    return result;
  }

  /** The data of the next chunk, or undefined at the end of the stream. */
  async next(): Promise<string | undefined> {
    await this.fill(HEADER_SIZE);
    if (this.length === 0) {
      return undefined;
    }
    const head = this.length < HEADER_SIZE ? '' : decoder.decode(this.take(HEADER_SIZE));
    const match = /^;0x([0-9a-f]{8});$/.exec(head);
    if (!match) {
      throw new Error('The answer of a server function is not a stream of chunks');
    }
    const size = Number.parseInt(match[1]!, 16);
    await this.fill(size);
    if (this.length < size) {
      throw new Error('The answer of a server function ended in the middle of a chunk');
    }
    return decoder.decode(this.take(size));
  }

  cancel(reason: unknown): void {
    this.done = true;
    void this.reader.cancel(reason).catch(() => {});
  }
}

const ignore = (): void => {};

/**
 * The refs of a stream. A promise in the answer can fail with nothing that
 * reads it, such as a field the caller ignores, so its failure is claimed
 * here. Code that awaits it still sees the failure.
 */
class Refs extends Map<number, unknown> {
  override set(id: number, value: unknown): this {
    if (value instanceof Promise) {
      value.catch(ignore);
    }
    return super.set(id, value);
  }
}

/**
 * Fails the promises and async iterables that still wait for a chunk, when
 * the stream ends early. Failing a settled one does nothing.
 */
function failPending(refs: Refs, error: unknown): void {
  for (const value of refs.values()) {
    try {
      if (isStream(value)) {
        value.throw(error);
      } else if (value !== null && typeof value === 'object') {
        const resolver = value as { p?: unknown; f?: unknown };
        if (resolver.p instanceof Promise && typeof resolver.f === 'function') {
          resolver.p.catch(ignore);
          (resolver.f as (error: unknown) => void)(error);
        }
      }
    } catch {
      // A value that a plugin made, which has no such methods.
    }
  }
}

/**
 * Reads the first chunk of a stream as the value, and the rest in the
 * background, so the promises and async iterables in it settle as their
 * chunks arrive.
 */
export async function fromChunkStream(stream: ReadableStream<Uint8Array>): Promise<unknown> {
  const reader = new ChunkReader(stream);
  const refs = new Refs();
  const read = (data: string): unknown =>
    fromCrossJSON(JSON.parse(data) as SerovalNode, { refs, plugins, disabledFeatures });
  const first = await reader.next();
  if (first === undefined) {
    throw new Error('The answer of a server function is empty');
  }
  const value = read(first);
  void (async () => {
    try {
      for (;;) {
        // oxlint-disable-next-line no-await-in-loop -- Chunks arrive in order.
        const data = await reader.next();
        if (data === undefined) {
          break;
        }
        read(data);
      }
      failPending(refs, new Error('The answer of a server function ended early'));
    } catch (error) {
      reader.cancel(error);
      failPending(refs, error);
    }
  })();
  return value;
}
