// The answer of a server function, as a byte stream of @seroval/transport.
// Promises and async iterables in the answer settle as their messages arrive.

import { toWebStream } from '@seroval/transport/web';
import { createJSONWriter } from '@seroval/transport/write';
import { serialOptions, plugins } from './serial.ts';
import { ANSWER } from './stream-read.ts';

export { fromChunkStream } from './stream-read.ts';

/** The content type of a stream of messages. */
export const STREAM_TYPE = 'application/x-brumate-stream';

/**
 * Serializes a value as a byte stream. `onError` gets the error of a value that cannot be
 * serialized, which the reader only sees as a failed answer.
 */
export function toChunkStream(
  value: unknown,
  onCancel?: (reason: unknown) => void,
  onError?: (error: unknown) => void,
): ReadableStream<Uint8Array> {
  return toWebStream((sink) => {
    const writer = createJSONWriter({ ...sink, onError, plugins, ...serialOptions() });
    writer.write(ANSWER, value);
    writer.flush();
    return {
      // The reader went away, such as a browser that aborted the call.
      close(reason) {
        onCancel?.(reason);
        writer.close(reason);
      },
    };
  });
}
