# brumate

> A component language and compiler for resumable web apps.

`brumate` compiles single-file `.brm` components into server-rendered HTML and small client modules. The browser does not hydrate. It reads the state that the server wrote into the page, and loads the code of an event handler only when that event fires.

## Install

```bash
pnpm add brumate
pnpm add -D vite @brumate/tsc typescript
```

brumate needs Node 22.18 or newer, and Vite.

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

```ts
// src/client.ts
import 'virtual:brumate/start';
```

## A component

```html
<script>
  import { $memo, $signal } from 'brumate/signals';

  let count = $signal(0);
  const double = $memo(count * 2);
</script>

<button onClick=(() => count++)>Clicked {count} times</button>
<p>Double: {double}</p>
```

The server renders the button and the text. The browser loads the code of the click handler, and of the updates it causes, the first time the button is clicked.

## What it includes

- `brumate/signals`: the compile-time functions, such as `$signal`, `$memo`, `$effect`, `$props`, `$action` and `$optimistic`.
- `brumate/vite`: the Vite plugin. It compiles `.brm` files, splits client code per handler, serves server function calls in development, and can prerender pages.
- `brumate/server`: rendering, streaming, routes, server functions, sessions, cookies, and validation with Standard Schema.
- `brumate/loader` and `brumate/client`: the loader and the core that run in the browser.
- `brumate/testing`: mounting components in a DOM test, with the real server functions.

## Documentation

- [Getting started](https://github.com/lxsmnsyc/brumate/blob/main/website/docs/getting-started.md)
- [Your first app](https://github.com/lxsmnsyc/brumate/blob/main/website/docs/tutorial.md)
- [All guides and reference](https://github.com/lxsmnsyc/brumate/tree/main/website/docs)

brumate is at 0.x. The page format can change between versions, so the server and the client must come from the same version.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
