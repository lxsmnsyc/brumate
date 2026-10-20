import { createServer as createHTTPServer } from 'node:http';
import { Readable } from 'node:stream';
import { createServer } from 'vite';

// Renders the page with Vite in development. Vite also serves the client modules
// and answers server function calls.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

// The head comes from the components, such as their `$title`.
const start = (head: string): string => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    ${head}
    <style>.done { text-decoration: line-through; } li { cursor: pointer; }</style>
    <script type="module" src="/@vite/client"></script>
  </head>
  <body>
`;

const end = `
  </body>
</html>`;

const http = createHTTPServer((request, response) => {
  vite.middlewares(request, response, async () => {
    try {
      const { renderToStream } = await vite.ssrLoadModule('brumate/server');
      const App = (await vite.ssrLoadModule('/src/App.brm')).default;
      const stream = renderToStream(
        App,
        {
          initial: [
            { id: '1', title: 'Write the docs', done: true },
            { id: '2', title: 'Build the compiler', done: false },
          ],
        },
        // `async`, so the loader starts before the state records that are still pending.
        { start, scripts: '<script type="module" async src="/src/client.ts"></script>', end },
      );
      response.setHeader('content-type', 'text/html');
      // The markup is sent first. State records follow as their promises settle.
      Readable.fromWeb(stream).pipe(response);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      response.statusCode = 500;
      response.end(String((error as Error).stack));
    }
  });
});

const port = Number(process.env.PORT ?? 5173);
http.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
