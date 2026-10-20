import { createServer as createHTTPServer } from 'node:http';
import { Readable } from 'node:stream';
import { createServer } from 'vite';

// Renders the page with Vite in development. Vite also serves the client modules
// and answers server function calls.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

const http = createHTTPServer((request, response) => {
  vite.middlewares(request, response, async () => {
    try {
      const { renderToStream } = await vite.ssrLoadModule('brumate/server');
      // Root renders the whole document. The runtime adds its head, the page state and the scripts.
      const Root = (await vite.ssrLoadModule('/src/Root.brm')).default;
      const stream = renderToStream(
        Root,
        {
          initial: [
            { id: '1', title: 'Write the docs', done: true },
            { id: '2', title: 'Build the compiler', done: false },
          ],
        },
        {
          // `async`, so the loader starts before the #loading bodies that are still pending.
          scripts:
            '<script type="module" src="/@vite/client"></script><script type="module" async src="/src/client.ts"></script>',
        },
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
