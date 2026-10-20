import { createServer as createHTTPServer } from 'node:http';
import { createServer } from 'vite';

// Renders the page with Vite in development. Vite also serves the client modules
// and answers server function calls.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

const http = createHTTPServer((request, response) => {
  vite.middlewares(request, response, async () => {
    try {
      const { renderToString, stateScript } = await vite.ssrLoadModule('brumate/server');
      const App = (await vite.ssrLoadModule('/src/App.brm')).default;
      const { html, state } = await renderToString(App, {
        initial: [
          { id: '1', title: 'Write the docs', done: true },
          { id: '2', title: 'Build the compiler', done: false },
        ],
      });
      const page = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>brumate todos</title>
    <style>.done { text-decoration: line-through; } li { cursor: pointer; }</style>
  </head>
  <body>
    ${html}
    ${stateScript(state)}
    <script type="module" src="/src/client.ts"></script>
  </body>
</html>`;
      response.setHeader('content-type', 'text/html');
      response.end(await vite.transformIndexHtml(request.url ?? '/', page));
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
