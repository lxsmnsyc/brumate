import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

/** Turns a Node request into a web Request. */
export async function toRequest(request: IncomingMessage): Promise<Request> {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
  }
  return new Request(`http://localhost${request.url}`, {
    method: request.method,
    headers: request.headers as Record<string, string>,
    body: request.method === 'POST' ? body : undefined,
  });
}

/** Sends a web Response, as it streams. No response means no route matched. */
export function send(answer: Response | undefined, response: ServerResponse): void {
  if (!answer) {
    response.statusCode = 404;
    response.end('Not found');
    return;
  }
  response.writeHead(answer.status, Object.fromEntries(answer.headers));
  if (answer.body) {
    Readable.fromWeb(answer.body as never).pipe(response);
  } else {
    response.end();
  }
}
