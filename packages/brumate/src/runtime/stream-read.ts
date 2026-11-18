// The read side of the answer of a server function. The browser loads only this
// module, not the writer that the server uses (see `stream.ts`).

import { createJSONReader } from '@seroval/transport/read';
import { fromWebStream } from '@seroval/transport/web';
import { serialOptions, plugins } from './serial.ts';

/** The key of the answer among the values of the stream. */
export const ANSWER = 'answer';

/**
 * Reads the first value of a byte stream, and the rest in the background, so
 * the promises and async iterables in it settle as their messages arrive.
 */
export async function fromChunkStream(stream: ReadableStream<Uint8Array>): Promise<unknown> {
  const reader = createJSONReader({ plugins, ...serialOptions() });
  void fromWebStream(stream, reader);
  return reader.get(ANSWER);
}
