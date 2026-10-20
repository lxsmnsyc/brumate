import { createServer as createHTTPServer } from 'node:http';
import { Readable } from 'node:stream';
import { createServer } from 'vite';

// Renders the pages with Vite in development. Vite also serves the client modules.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

const http = createHTTPServer((request, response) => {
  vite.middlewares(request, response, async () => {
    try {
      const { handle } = await vite.ssrLoadModule('virtual:brumate/routes');
      const answer: Response | undefined = await handle(
        new Request(`http://localhost${request.url}`),
        {
          scripts:
            '<script type="module" src="/@vite/client"></script><script type="module" async src="/src/client.ts"></script>',
        },
      );
      if (!answer) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      response.writeHead(answer.status, Object.fromEntries(answer.headers));
      Readable.fromWeb(answer.body as never).pipe(response);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      response.statusCode = 500;
      response.end(String((error as Error).stack));
    }
  });
});

const port = Number(process.env.PORT ?? 5180);
http.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
