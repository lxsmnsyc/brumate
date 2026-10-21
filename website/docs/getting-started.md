# Getting started

A brumate app is a Vite app with the brumate plugin, route files under `src/routes`, and a small server that renders pages. This page sets one up from scratch.

## Install

```bash
pnpm add brumate
pnpm add -D vite @brumate/tsc typescript
```

The project needs Node 22.18 or newer, which runs `.ts` files directly.

## Project layout

```
my-app/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── server.ts            the development server
└── src/
    ├── client.ts        starts the loader in the browser
    └── routes/
        ├── _layout.brm  the document around every page
        └── index.brm    the page at /
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

The client entry only starts the loader. Nothing else runs in the browser until the first event:

```ts
// src/client.ts
import 'virtual:brumate/start';
```

## Add a layout and a page

A layout renders the document around the pages. `children` is the page for the current path:

```brm
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

`index.brm` is the page at `/`:

```brm
<!-- src/routes/index.brm -->
<script>
  import { $signal } from 'brumate/signals';

  let count = $signal(0);
</script>

<h1>Hello</h1>
<button onClick=(() => count++)>Clicked {count} times</button>
```

[Routing](./routing.md) describes the other route files, such as `[id].brm` and `_error.brm`.

## Serve pages in development

`virtual:brumate/routes` exports `handle`, which answers a request with the page for its path. In development, Vite loads it and serves the client modules:

```ts
// server.ts
import { createServer as createHTTPServer } from 'node:http';
import { Readable } from 'node:stream';
import { toNodeHeaders } from 'brumate/server';
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
    response.writeHead(answer.status, toNodeHeaders(answer.headers));
    Readable.fromWeb(answer.body).pipe(response);
  });
}).listen(5173);
```

- `scripts` is the markup that loads the client entry. It goes at the end of the page.
- `handle` returns undefined when no route matches and the root has no `_error.brm`.
- This server passes only the URL. Forms that post to a route need the method, the headers and the body too. [`examples/todos`](https://github.com/lxsmnsyc/brumate/tree/main/examples/todos) has a complete server.

Run it:

```bash
node server.ts
```

Open `http://localhost:5173`. The page works before any script runs, and the first click loads the click handler.

[Deploying](./deploying.md) describes the production build and server, and static sites.

## Edit while it runs

The dev server updates the page when you save a component, and keeps its state when it can:

- An edit of a `<style>` block replaces the styles of the component in place.
- An edit of a script or an event handler that keeps the markup and the values of the component loads the new code. The page keeps its state, and the next event runs the new code.
- An edit of the markup, or one that adds or removes a value, reloads the page, because the HTML of the server no longer matches the page.

An edit of a [module of reactive logic](./reactive-modules.md) updates the components that call it in the same way.

## Type-check

`brumate-tsc` type-checks the project, `.brm` files included. Add the types of brumate to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vite/client", "brumate/types"]
  }
}
```

```bash
pnpm brumate-tsc --noEmit
```

[TypeScript](./typescript.md) describes what is checked, and [Editors](./editor.md) sets up VS Code.

## Next

- [Your first app](./tutorial.md) builds a todo app step by step.
- [Components](./components.md) describes the parts of a `.brm` file.
- [State](./state.md) describes signals and memos.
