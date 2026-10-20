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

Nothing else runs before the first event. The first event loads `brumate/client` and the module of the component that handles it.

## Rendering a page

On the server, render a component with `renderToStream`. It writes the markup and the page state first. Promises in the state do not hold it up: a script for each one follows when it settles.

```ts
import { renderToStream } from 'brumate/server';
import App from './src/App.brm';

const stream = renderToStream(App, { initial: [] }, {
  start: '<!doctype html><html><body>',
  // `async`, so the loader starts before the pending state records arrive.
  scripts: '<script type="module" async src="/src/client.ts"></script>',
  end: '</body></html>',
  // For a Content Security Policy: the inline scripts that swap in #loading bodies get this nonce.
  nonce,
});
```

`renderToString` returns the same parts without a stream: the markup, the state script, and the rest as an async iterable of markup: `#loading` bodies and state records, in the order they are ready.

```ts
const { html, state, pending } = await renderToString(App, { initial: [] });
write(html + state + clientScript);
for await (const chunk of pending) {
  write(chunk);
}
```

In development, load the component with `vite.ssrLoadModule('/src/App.brm')`. [`examples/todos`](../examples/todos) is a complete server.

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

| Import                                 | What it is                                                           |
| -------------------------------------- | -------------------------------------------------------------------- |
| `./App.brm` on the server              | The server module. Its default export renders the component.         |
| `./App.brm` in the browser             | The client module.                                                   |
| `./App.brm?brumate-client&part=<name>` | A part of the client module. The entry imports it when it is needed. |
| `./App.brm?brumate-render`             | The render module, for a component rendered on the client.           |
| `virtual:brumate/start`                | Starts the loader with the manifest.                                 |
| `virtual:brumate/manifest`             | Exports `load(id)`, which imports the client module of a component.  |
| `virtual:brumate/server`               | Exports `functions` and `handle(request)`.                           |

The plugin finds `.brm` files under the root when the build starts, and again when files are added or removed. It skips `node_modules`, `dist` and hidden directories. Component IDs come from the path relative to the root, so they are the same on every machine.

The plugin also finds which props each component's parents can change, so props that never change ship no code. A change to any `.brm` file runs this again and reloads every `.brm` module.

## Options

```ts
brumate({
  // The URL prefix of server function calls.
  rpc: '/_brumate',
  // Directories to skip when looking for .brm files.
  exclude: (directory) => directory === 'node_modules',
});
```

## Updates

A resumed page cannot swap a component's code, so a change to a `.brm` file reloads the page.
