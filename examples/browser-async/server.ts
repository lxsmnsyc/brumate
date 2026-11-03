import { createServer as createHTTPServer } from 'node:http';
import { send, toRequest } from './node.ts';
import { errorPage } from 'brumate/vite';
import { createServer } from 'vite';

// Renders the page with Vite in development. Vite also serves the client modules
// and answers server function calls.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

const http = createHTTPServer((request, response) => {
  vite.middlewares(request, response, async () => {
    try {
      // The route files under src/routes render the page.
      const { handle } = await vite.ssrLoadModule('virtual:brumate/routes');
      const answer = await handle(await toRequest(request), {
        // `async`, so the loader starts before the #loading bodies that are still pending.
        scripts:
          '<script type="module" src="/@vite/client"></script><script type="module" async src="/src/client.ts"></script>',
      });
      send(answer, response);
    } catch (error) {
      // Vite's error overlay shows the error, and the page loads again after a fix.
      response.statusCode = 500;
      response.setHeader('content-type', 'text/html');
      response.end(errorPage(error, vite));
    }
  });
});

const port = Number(process.env.PORT ?? 5173);
http.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
