# Publishing components

A package can ship `.brm` components for other apps to use. It ships them as source, and the Vite plugin of the app compiles them with the app's own files.

## What a package can ship

- `.brm` components, with their styles, handlers and server functions.
- `.brm.ts` [modules of reactive logic](./reactive-modules.md).
- `'use server'` [files of server functions](./server-functions.md#a-file-of-server-functions).
- Plain TypeScript or `.js` modules, which the components import.

A package cannot ship routes. The routes of an app come only from its own `src/routes`.

## Set up `package.json`

```json
{
  "name": "@acme/ui",
  "version": "1.0.0",
  "type": "module",
  "brumate": { "version": 1, "dir": "src" },
  "exports": {
    "./*.brm": "./src/*.brm",
    "./*.brm.ts": "./src/*.brm.ts",
    "./greeting": "./src/greeting.ts"
  },
  "files": ["src"],
  "sideEffects": ["**/*.css"],
  "peerDependencies": {
    "brumate": "^0.1.0"
  }
}
```

- `brumate` tells the plugin of the app that the package ships `.brm` files. `dir` names the folder to search, so test files stay out. Without `dir`, or with `"brumate": true`, the plugin searches the whole package. Folders named `node_modules` and hidden folders are skipped.
- `version` is the version of this field. This version of brumate reads `1`. A package with another version fails the start of Vite with a message that names it.
- `exports` lets the app import `@acme/ui/Button.brm`. Export each `.brm`, `.brm.ts` and `'use server'` file that the app imports. An export can name a `.brm.ts` module without its extension, such as `"./forms": "./src/forms.brm.ts"`, and the app imports it as `@acme/ui/forms`. The plugin reads the `import`, `module`, `node`, `browser` and `default` conditions, and a `brumate` condition if you need one.
- `files` publishes the source.
- `sideEffects` lets the bundler drop modules that the app does not use. List the stylesheets that the package imports for their effect, such as `import './theme.css'`, or the bundler drops them. The styles of `.brm` files are part of the components, so they need no entry.
- `peerDependencies` names the versions of brumate that the package works with. See [Versions](#versions).

The app adds the package to its `dependencies` or `devDependencies`, and imports from it:

```brm
<script>
  import Button from '@acme/ui/Button.brm';
</script>

<Button label="Save" />
```

## How the plugin finds packages

When Vite starts, the plugin reads the `package.json` of the app. For each dependency whose `package.json` has a `brumate` field, it:

- finds its `.brm` files and `'use server'` files, as it finds those of the app,
- adds its components to the manifest, and the server functions that the app reaches to `virtual:brumate/server`,
- finds the props that the app changes on each of its components, across the package boundary,
- keeps the package out of Vite's dep optimizer, so its files reach the plugin,
- compiles the package into the server build, instead of importing it from `node_modules`.

- A package that depends on another package with a `brumate` field brings that one too.
- Links, such as those of pnpm, resolve to the real folder. `resolve.preserveSymlinks` gives the same IDs.
- An edit of a linked package, such as one of a workspace, updates the page on the dev server. A linked package outside the workspace is added to `server.fs.allow`.
- A change to the `package.json` of the app or of a package that changes the packages restarts the dev server.
- The app and its packages share one copy of the brumate runtime, through `resolve.dedupe`.
- The field takes effect only for a dependency. A package that runs its own tests or dev server compiles its files as an app does.

### Dependencies of a package

Vite does not pre-bundle the package, so it does not pre-bundle the CommonJS dependencies that its browser code imports either. Add them to `optimizeDeps.include` of the app, with the package name before them:

```ts
// vite.config.ts of the app
export default defineConfig({
  plugins: [brumate()],
  optimizeDeps: { include: ['@acme/ui > some-cjs-dependency'] },
});
```

The plugin does not add them itself, because a dependency that only server code uses would be bundled for the browser. Dependencies that ship ES modules need nothing.

## IDs

The ID of a component comes from the name of the package and the path of the file in it. `src/Button.brm` of `@acme/ui` is `Button_` and a hash of `@acme/ui/src/Button.brm`. The IDs of server functions of a `'use server'` file come from the same name.

- An ID is the same wherever the package is installed, and on every machine.
- When the app has two versions of one package, the version is part of the name, such as `@acme/ui@1.0.0/src/Button.brm`.
- A build hashes the names of server functions, as it does for the app.

Compile errors and warnings name the file the same way, such as `@acme/ui/src/Button.brm:4:3`.

## Styles

A `<style>` block of a package component is scoped to it, as in the app. The app cannot style the inside of a package component with its own selectors. A package can:

- take a `class` prop and put it on its root element,
- use CSS custom properties, which the app sets on an ancestor,
- document the `:global(…)` selectors that the app may use. See [Styling child components](./styles.md#styling-child-components).

SCSS and Less work if the app installs `sass` or `less`. List the one you use as a peer dependency.

Tailwind CSS does not look in `node_modules` for class names. An app that uses Tailwind adds the package to its sources:

```css
@import 'tailwindcss';
@source '../node_modules/@acme/ui/src';
```

## Server functions

A server function of a package becomes an endpoint of the app only when the app reaches its file. The plugin follows the imports of the app's files into the package, and the imports of those files. A `'use server'` file or a component that nothing reaches has no endpoint, so installing a package does not add endpoints by itself.

A server function that the app reaches can be called by anyone, with any arguments, not only by the components of the package.

- Validate the arguments. See [Validating arguments](./server-functions.md#validating-arguments).
- Check who is calling before you read or change data. Read the session from the request, as the app does. See [The request](./server-functions.md#the-request).
- Do not read secrets from fixed places. Let the app pass them in, such as with a setup function that the app calls on its server.

See [Security](./reference-security.md).

## Testing a package

A package tests its components with [`brumate/testing`](./testing.md), as an app does. Add the plugin to its Vitest config:

```ts
// vitest.config.ts
import brumate from 'brumate/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [brumate()],
  test: { environment: 'happy-dom' },
});
```

`answerCalls` runs the server functions of the package in the test:

```ts
import { expect, it } from 'vitest';
import { answerCalls, mount } from 'virtual:brumate/testing';
import Greeter from '../src/Greeter.brm?brumate-server';

it('greets', async () => {
  const restore = answerCalls();
  const page = await mount(Greeter, { name: 'Ada' });
  page.click('button');
  await page.waitFor(() => expect(page.text('output')).toBe('Hello, Ada'));
  page.unmount();
  restore();
});
```

## Type checking

`brumate-tsc` and the editor plugin follow the `exports` of the package to its `.brm` files, so the app gets the props of each component. A prop with the wrong type is an error in the app.

- The app and the package both add `brumate/types` to the `types` of their `tsconfig.json`. See [TypeScript](./typescript.md).
- Use `"moduleResolution": "bundler"`, so TypeScript reads `exports`.
- The package does not need `.d.ts` files for its components.
- `brumate-tsc` checks the files of the package too, as `tsc` checks the `.ts` files of a package that ships TypeScript source. `skipLibCheck` does not skip them. An error in the package shows in the app, so check the package with `brumate-tsc` before you publish it.

## Versions

The app compiles the package with its own version of brumate. The compiled code and the [page format](./page-format.md) come from that version, so the package must use only what that version of the language supports.

- Set the peer dependency on brumate to the range that you test with, such as `^0.1.0`. A package manager warns when the app has another version.
- While brumate is below 1.0, a minor version can change the language. Publish a new version of the package for each minor version of brumate that it supports.
- The page format is the same for the app and its packages, because one compiler writes both.

## A complete package

```
acme-ui/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    Counter.brm
    counter.brm.ts
    Greeter.brm
    greeting.ts
  test/
    greeter.test.ts
```

```ts
// src/counter.brm.ts
import { $memo, $signal } from 'brumate/signals';

export function counter(start: number) {
  let count = $signal(start);
  const double = $memo(count * 2);

  function increment() {
    count++;
  }

  return { count, double, increment };
}
```

```brm
<!-- src/Counter.brm -->
<script>
  import { $props } from 'brumate/signals';
  import { counter } from './counter.brm.ts';

  const { start = 0 } = $props<{ start?: number }>();
  const { count, double, increment } = counter(start);
</script>

<button onClick=increment>Clicked {count} times</button>
<p>Double: {double}</p>

<style>
  button {
    font: inherit;
  }
</style>
```

```ts
// src/greeting.ts
'use server';

export async function greet(name: string): Promise<string> {
  return `Hello, ${name}`;
}
```

```brm
<!-- src/Greeter.brm -->
<script>
  import { $props, $signal } from 'brumate/signals';
  import { greet } from './greeting.ts';

  const { name } = $props<{ name: string }>();
  let message = $signal('');
</script>

<button onClick=(async () => (message = await greet(name)))>Greet {name}</button>
<output>{message}</output>
```

[`examples/ui-kit`](https://github.com/lxsmnsyc/brumate/tree/main/examples/ui-kit) is a package like this one, and [`examples/kit-app`](https://github.com/lxsmnsyc/brumate/tree/main/examples/kit-app) is an app that uses it.
