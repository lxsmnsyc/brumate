import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { serve } from '../src/rpc.ts';

function frame(message: object): string {
  const body = JSON.stringify({ jsonrpc: '2.0', ...message });
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

/** Starts the server, and returns a function that sends text and reads the answers so far. */
function start(): (text: string) => unknown[] {
  const input = new PassThrough();
  const output = new PassThrough();
  serve(input, output);
  return (text) => {
    input.write(text);
    const answers: unknown[] = [];
    const data = String(output.read() ?? '');
    for (const part of data.split(/Content-Length: \d+\r\n\r\n/).filter(Boolean)) {
      answers.push(JSON.parse(part));
    }
    return answers;
  };
}

describe('serve', () => {
  it('answers the requests of TypeScript', () => {
    const send = start();
    expect(
      send(
        frame({ id: 1, method: 'initialize', params: { positionEncodings: ['utf-8', 'utf-16'] } }),
      ),
    ).toEqual([
      { jsonrpc: '2.0', id: 1, result: { positionEncoding: 'utf-16', diagnosticSource: 'BRM' } },
    ]);
    expect(send(frame({ id: 2, method: 'openProject', params: { projectHandle: 'p' } }))).toEqual([
      { jsonrpc: '2.0', id: 2, result: {} },
    ]);
    const [transform] = send(
      frame({
        id: 3,
        method: 'transform',
        params: { fileName: 'A.brm', content: '<p>é</p>', projectHandle: 'p' },
      }),
    ) as { id: number; result: { extension: string } }[];
    expect(transform).toMatchObject({ id: 3, result: { extension: '.ts' } });
    expect(send(frame({ id: 4, method: 'closeProject', params: { projectHandle: 'p' } }))).toEqual([
      { jsonrpc: '2.0', id: 4, result: null },
    ]);
  });

  it('reads a message that comes in parts, and skips notifications', () => {
    const send = start();
    const message =
      frame({ method: '$/cancelRequest', params: { id: 1 } }) +
      frame({ id: 1, method: 'initialize', params: { positionEncodings: ['utf-8'] } });
    expect(send(message.slice(0, 20))).toEqual([]);
    expect(send(message.slice(20))).toEqual([
      { jsonrpc: '2.0', id: 1, result: { positionEncoding: 'utf-8', diagnosticSource: 'BRM' } },
    ]);
  });

  it('answers an unknown method with an error', () => {
    const send = start();
    expect(send(frame({ id: 1, method: 'shutdown' }))).toEqual([
      { jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Unknown method shutdown' } },
    ]);
  });
});
