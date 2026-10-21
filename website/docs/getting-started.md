# Getting started

A brumate app is a Vite app with the brumate plugin, and a server that renders pages.

## Install

```bash
pnpm add brumate
pnpm add -D vite @brumate/tsc
```

## Configure Vite

```ts
// vite.config.ts
import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [brumate()],
  build: {
    manifest: true,
    rolldownOptions: { input: 'src/client.ts' },
  },
});
```

The client entry only starts the loader:

```ts
// src/client.ts
import 'virtual:brumate/start';
```

## Add routes

Routes are `.brm` files under `src/routes`. A layout renders the document around them.

```html
<!-- src/routes/_layout.brm -->
<script>
  import { $props } from 'brumate/signals';

  const { children } = $props();
</script>

<html lang="en">
  <head>
    <meta charset="utf-8">
  </head>
  <body>
    <main>{children}</main>
  </body>
</html>
```

```html
<!-- src/routes/index.brm -->
<script>
  import { $signal } from 'brumate/signals';

  let count = $signal(0);
</script>

<h1>Hello</h1>
<button onClick=(() => count++)>Clicked {count} times</button>
```

## Serve pages

`virtual:brumate/routes` answers a request with the page for its path, streamed.

```ts
// server.ts
import { createServer as createHTTPServer } from 'node:http';
import { Readable } from 'node:stream';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

createHTTPServer((request, response) => {
  vite.middlewares(request, response, async () => {
    const { handle } = await vite.ssrLoadModule('virtual:brumate/routes');
    const answer = await handle(new Request(`http://localhost${request.url}`), {
      scripts: '<script type="module" async src="/src/client.ts"></script>',
    });
    if (!answer) {
      response.statusCode = 404;
      response.end('Not found');
      return;
    }
    response.writeHead(answer.status, Object.fromEntries(answer.headers));
    Readable.fromWeb(answer.body).pipe(response);
  });
}).listen(5173);
```

Open `http://localhost:5173`. The page works before any script runs. The first click loads the handler.

## Type-check

```bash
brumate-tsc --noEmit
```

Add `"types": ["brumate/types"]` to `tsconfig.json`. [TypeScript](./typescript.md) describes what is checked.

## Next

- [Syntax](./syntax.md) describes components, markup and control flow.
- [Routing](./routing.md) describes layouts and sibling routes.
- [Server functions](./server-functions.md) describes `'use server'` and forms.
- [`examples/todos`](../examples/todos) is a complete app with a production server.
