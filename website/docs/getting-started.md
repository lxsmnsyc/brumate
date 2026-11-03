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

The client entry starts the loader. The loader then loads the core and the code of the components on the page:

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
import { errorPage } from 'brumate/vite';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

createHTTPServer((request, response) => {
  vite.middlewares(request, response, async () => {
    try {
      const { handle } = await vite.ssrLoadModule('virtual:brumate/routes');
      const answer = await handle(new Request(`http://localhost${request.url}`), {
        scripts:
          '<script type="module" src="/@vite/client"></script><script type="module" async src="/src/client.ts"></script>',
      });
      if (!answer) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      response.writeHead(answer.status, toNodeHeaders(answer.headers));
      Readable.fromWeb(answer.body).pipe(response);
    } catch (error) {
      response.statusCode = 500;
      response.setHeader('content-type', 'text/html');
      response.end(errorPage(error, vite));
    }
  });
}).listen(5173);
```

- `scripts` is the markup that loads the client entry. It goes at the end of the page. `/@vite/client` updates components when you edit them.
- `errorPage` answers with the Errors tab of the devtools when a page fails to render, such as after a compile error. It shows the lines of the file around the error, and the page loads again when you fix it.
- `handle` returns undefined when no route matches and the root has no `_error.brm`.
- This server passes only the URL. Forms that post to a route need the method, the headers and the body too. [`examples/todos`](https://github.com/lxsmnsyc/brumate/tree/main/examples/todos) has a complete server.

Run it:

```bash
node server.ts
```

Open `http://localhost:5173`. The page shows before any script runs, and the click handler loads with the page.

[Deploying](./deploying.md) describes the production build and server, and static sites.

## Edit while it runs

The dev server updates the page when you save a component, and keeps its state when it can:

- An edit of a `<style>` block replaces the styles of the component in place.
- An edit of a script or an event handler that keeps the markup and the values of the component loads the new code. The page keeps its state, and the next event runs the new code.
- An edit of the markup, or one that adds or removes a value, renders the page again without reloading it. The server renders the new markup, and each signal of the component's script keeps its value, by its name. Signals in blocks, such as in a `#for` body, start again.
- A file that does not compile reloads the page, which shows the error. See [`errorPage`](./reference-plugin.md#errorpageerror-server).

Rendering again uses the client router. With [`navigate: false`](./navigation.md#links-that-the-browser-loads), the page reloads instead.

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

[TypeScript](./typescript.md) describes what is checked, and [Editors](./editor.md) sets up VS Code. `npx brumate check` compiles every `.brm` file and type-checks the project in one run. `npx brumate skill` copies a skill for coding agents into `.claude/skills/brumate`.

## Next

- [Your first app](./tutorial.md) builds a todo app step by step.
- [Components](./components.md) describes the parts of a `.brm` file.
- [State](./state.md) describes signals and memos.
