# Vite

`brumate/vite` compiles `.brm` files, serves their client modules, and answers server function calls in development.

## Set up

```ts
// vite.config.ts
import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [brumate()],
});
```

Add the types to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vite/client", "brumate/types"]
  }
}
```

## Client entry

The client entry only starts the loader:

```ts
// src/client.ts
import 'virtual:brumate/start';
```

Nothing else runs before the first event. The first event loads `brumate/client` and the module of the component that handles it. The first click on a link loads the navigation module. See [Routing](./routing.md#navigation).

## Rendering a page

Server rendering streams. Render a component that renders the whole document with `renderToStream`:

```html
<!-- src/Root.brm -->
<script>
  import App from './App.brm';
</script>

<html lang="en">
  <head>
    <meta charset="utf-8">
  </head>
  <body>
    <App />
  </body>
</html>
```

```ts
import { renderToStream } from 'brumate/server';
import Root from './src/Root.brm';

const stream = renderToStream(Root, {}, {
  // `async`, so the loader starts before the #loading bodies that are still pending.
  scripts: '<script type="module" async src="/src/client.ts"></script>',
  // For a Content Security Policy: the inline scripts that swap in #loading bodies get this nonce.
  nonce,
});
```

- The first chunk is the whole first render, sent as soon as it is ready: the document from `<!doctype html>` to `</html>`, with the fallbacks of `#loading` blocks.
- In the first chunk, the head of the components, their `$title`, `#head` blocks and stylesheets, goes before `</head>`, and the page state, `scripts` and portal content go before `</body>`.
- Each `#loading` body and each state record that settles a promise follows as it resolves. These chunks come after `</html>`, and the browser's parser moves them into `<body>`, as it does for any content after `</html>`.

A component that renders only part of the page can take `start` and `end`, which are part of the first chunk. `start` can be a function that receives the head:

```ts
renderToStream(App, {}, {
  start: (head) => `<!doctype html><html><head>${head}</head><body>`,
  scripts,
  end: '</body></html>',
});
```

`render` is the step under `renderToStream`. It returns the parts: the markup, the head, the state script, the response headers that server functions set, and the rest as an async iterable of markup in the order it is ready. It does not wait for `#loading` bodies either. Use it to send the response headers before the stream starts.

### Several roots on one page

A page can hold several roots that render apart, such as islands in a page from another tool. Each one after the first starts its IDs above the one before it, with `base`:

```ts
const first = await render(Header, {});
const second = await render(Cart, {}, { base: first.next() });
```

- `next()` returns a number above every ID of the render. Call it after the `pending` markup of the render has been sent, if a later root must also start above its `#loading` bodies.
- The records of a render with a `base` carry `data-root`, so the client keeps their references apart.
- One loader and one core serve every root.

In development, load the component with `vite.ssrLoadModule('/src/Root.brm')`. [`examples/todos`](../examples/todos) is a complete server.

## Production

Build the client and the server separately:

```bash
vite build --outDir dist/client
vite build --ssr src/server.ts --outDir dist/server
```

- Set `build.manifest` and make `src/client.ts` the client input, so the server can find the built client entry in `dist/client/.vite/manifest.json`.
- The server entry exports what the server needs, such as the root component, `renderToStream` and `handle` from `virtual:brumate/server`.

[`examples/todos`](../examples/todos) has a complete production server in `server.prod.ts`.

## Server functions

In development, the plugin answers `POST /_brumate/<id>` itself.

In production, `virtual:brumate/server` exports every server function of the project, and a `handle` function for a web `Request`:

```ts
import { handle } from 'virtual:brumate/server';

export async function fetch(request: Request): Promise<Response> {
  return (await handle(request)) ?? renderPage(request);
}
```

`handle` returns `undefined` for requests that are not server function calls.

## Modules

| Import                                 | What it is                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `./App.brm` on the server              | The server module. Its default export renders the component.                  |
| `./App.brm` in the browser             | The client module.                                                            |
| `./App.brm?brumate-client&part=<name>` | A part of the client module. The entry imports it when it is needed.          |
| `./App.brm?brumate-render`             | The render module, for a component rendered on the client.                    |
| `virtual:brumate/start`                | Starts the loader with the manifest.                                          |
| `virtual:brumate/manifest`             | Exports `load(id)`, which imports the client module of a component.           |
| `virtual:brumate/server`               | Exports `functions` and `handle(request)`.                                    |
| `virtual:brumate/routes`               | Exports `routes` and `handle(request, options)`. See [Routing](./routing.md). |

The plugin finds `.brm` files under the root when the build starts, and again when files are added or removed. It skips `node_modules`, `dist` and hidden directories. Component IDs come from the path relative to the root, so they are the same on every machine.

The plugin also finds which props each component's parents can change, so props that never change ship no code. A change to any `.brm` file runs this again and reloads every `.brm` module.

## Options

```ts
brumate({
  // The URL prefix of server function calls.
  rpc: '/_brumate',
  // Other origins that may call server functions. Calls from other sites answer 403.
  origins: [],
  // Directories to skip when looking for .brm files.
  exclude: (directory) => directory === 'node_modules',
  // The directory of route files.
  routes: 'src/routes',
  // Loads pages without a full page load. See Routing.
  navigate: true,
  // Client parts smaller than this in all become one module. 0 keeps one module per part.
  merge: 2048,
});
```

## Updates

A resumed page cannot swap a component's code, so a change to a `.brm` file reloads the page.
