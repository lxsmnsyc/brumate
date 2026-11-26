import { createServer as createHTTPServer } from 'node:http';
import type { RequestListener } from 'node:http';
import { errorPage } from 'brumate/vite';
import { toNodeHandler } from 'srvx/node';
import { createServer } from 'vite';

// An own server renders the page with Vite in development, in middleware mode. Vite also
// serves the client modules and answers server function calls. The script tags are the
// default: brumate writes them.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

const render = toNodeHandler(async (request) => {
  try {
    // The route files under src/routes render the page.
    const { handle } = await vite.ssrLoadModule('virtual:brumate/routes');
    return (await handle(request)) ?? new Response('Not found', { status: 404 });
  } catch (error) {
    // Vite's error overlay shows the error, and the page loads again after a fix.
    return new Response(errorPage(error, vite), {
      status: 500,
      headers: { 'content-type': 'text/html' },
    });
  }
}) as RequestListener;

const http = createHTTPServer((request, response) => {
  vite.middlewares(request, response, () => render(request, response));
});

const port = Number(process.env.PORT ?? 5173);
http.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
