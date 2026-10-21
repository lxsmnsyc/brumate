import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { toNodeHeaders } from 'brumate/server';

/** Turns a Node request into a web Request. */
export async function toRequest(request: IncomingMessage): Promise<Request> {
  // Bytes, so files in form data stay intact.
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  // The host keeps its port, so a redirect to a URL built from `request.url` stays on this server.
  return new Request(`http://${request.headers.host ?? 'localhost'}${request.url}`, {
    method: request.method,
    headers: request.headers as Record<string, string>,
    body: request.method === 'POST' ? new Uint8Array(Buffer.concat(chunks)) : undefined,
  });
}

/** Sends a web Response, as it streams. No response means no route matched. */
export function send(answer: Response | undefined, response: ServerResponse): void {
  if (!answer) {
    response.statusCode = 404;
    response.end('Not found');
    return;
  }
  // Each cookie stays a header of its own.
  response.writeHead(answer.status, toNodeHeaders(answer.headers));
  if (answer.body) {
    Readable.fromWeb(answer.body as never).pipe(response);
  } else {
    response.end();
  }
}
