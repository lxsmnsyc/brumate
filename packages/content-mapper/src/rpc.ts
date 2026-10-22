import type { Readable, Writable } from 'node:stream';
import { DIAGNOSTIC_SOURCE, mapBrm } from './index.ts';
import type { InitializeParams, PositionEncoding, TransformParams } from './protocol.ts';

interface Message {
  id?: number | string | null;
  method?: string;
  params?: unknown;
}

// Error codes of JSON-RPC.
const INVALID_PARAMS = -32602;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

class RpcError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

const HEADER_END = Buffer.from('\r\n\r\n');

/**
 * Answers the requests of TypeScript. Each message is JSON after a
 * `Content-Length` header, as in the language server protocol. The mapper
 * keeps nothing per project, because a `.brm` file maps the same way in each.
 */
export function serve(input: Readable, output: Writable): void {
  let encoding: PositionEncoding | undefined;
  let buffer = Buffer.alloc(0);

  const send = (message: object): void => {
    const body = JSON.stringify({ jsonrpc: '2.0', ...message });
    output.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  };

  const answer = (method: string, params: unknown): unknown => {
    switch (method) {
      case 'initialize': {
        const offered = (params as InitializeParams).positionEncodings;
        // Strings in JavaScript count UTF-16 units, so offsets need no conversion.
        encoding = offered.includes('utf-16')
          ? 'utf-16'
          : offered.includes('utf-8')
            ? 'utf-8'
            : undefined;
        if (!encoding) {
          throw new RpcError(INVALID_PARAMS, 'No position encoding that the mapper supports');
        }
        return { positionEncoding: encoding, diagnosticSource: DIAGNOSTIC_SOURCE };
      }
      case 'openProject':
        return {};
      case 'closeProject':
        return null;
      case 'transform': {
        const { fileName, content } = params as TransformParams;
        return mapBrm(fileName, content, encoding);
      }
      default:
        throw new RpcError(METHOD_NOT_FOUND, `Unknown method ${method}`);
    }
  };

  const receive = (message: Message): void => {
    // Notifications, such as `$/cancelRequest`, need no answer. Each request is answered at once.
    if (message.id === undefined || message.id === null || !message.method) {
      return;
    }
    try {
      send({ id: message.id, result: answer(message.method, message.params) });
    } catch (error) {
      send({
        id: message.id,
        error: {
          code: error instanceof RpcError ? error.code : INTERNAL_ERROR,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  input.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf(HEADER_END);
      if (headerEnd === -1) {
        return;
      }
      const length = /Content-Length: *(\d+)/i.exec(
        buffer.subarray(0, headerEnd).toString('ascii'),
      );
      if (!length) {
        throw new Error('A message has no Content-Length header');
      }
      const start = headerEnd + HEADER_END.length;
      const end = start + Number(length[1]);
      if (buffer.length < end) {
        return;
      }
      const body = buffer.subarray(start, end).toString('utf8');
      buffer = buffer.subarray(end);
      receive(JSON.parse(body) as Message);
    }
  });
}
