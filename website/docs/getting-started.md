---
type: tutorial
---

# Getting started

A brumate app is a Vite app with the brumate plugin and route files under `src/routes`. `vite dev` serves its pages. This page sets one up from scratch.

## Before you start

- Node 22.18 or newer, which runs `.ts` files directly.
- pnpm. The commands below use it. `npm` and `npx` work the same way.
- A folder for the project.

## Install

```bash
pnpm add brumate
pnpm add -D vite @brumate/tsc typescript
```

## Project layout

```text
my-app/
├── package.json
├── tsconfig.json
├── vite.config.ts
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
    rolldownOptions: { input: 'src/client.ts' },
  },
});
```

The client entry starts the loader. The loader then loads the core and the code of the components on the page:

```ts
// src/client.ts
import 'virtual:brumate/start';
```

You never write the script tag of the client entry. brumate adds it to every page.

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

Run Vite:

```bash
pnpm vite dev
```

Open `http://localhost:5173`. The page shows before any script runs, and the click handler loads with the page.

- The plugin answers each request that Vite and the server functions leave, of any method, with `handle` from `virtual:brumate/routes`. Pages stream, and forms post to their routes.
- brumate adds the script tags at the end of each page: the Vite client, which updates components when you edit them, and your client entry, the `input` of the client build. An app with no client entry gets the loader.
- A page that fails to render, such as after a compile error, answers with the Errors tab of the devtools. It shows the lines of the file around the error, and the page loads again when you fix it.
- A path that no route matches gets Vite's 404, unless the root has an `_error.brm`.
- The plugin sets `appType: 'custom'` when the config leaves it unset. See [The dev server](./reference-plugin.md#the-dev-server).

An app needs no server file in development. A production build builds the client first, because the server build reads its manifest to write the script tags. [Deploying](./deploying.md) describes the build, the production server, with Nitro or a server of your own, and static sites.

## Edit while it runs

The dev server updates the page when you save a component, and keeps its state when it can:

- An edit of a `<style>` block replaces the styles of the component in place.
- An edit of a script or an event handler that keeps the markup and the values of the component loads the new code. The page keeps its state, and the next event runs the new code.
- An edit of the markup, or one that adds or removes a value, renders the page again without reloading it. The server renders the new markup, and each signal of the component's script keeps its value, by its name. Signals in blocks, such as in a `#for` body, start again.
- A file that does not compile reloads the page, which shows the error. See [`errorPage`](./reference-plugin.md#errorpageerror-server).

A client entry that calls `start` from `brumate/loader` itself gets the same updates and the devtools. The plugin sets them up on the dev server, so the entry only calls `start({ load })`. Under `vite dev`, the script tags that brumate adds load that entry, so its own code runs, as it does in the build.

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

## Next steps

- [Your first app](./tutorial.md) builds a todo app step by step.
- [Components](./components.md) describes the parts of a `.brm` file.
- [State](./state.md) describes signals and memos.
