# Plugin options and modules

The options of the Vite plugin, the modules that it provides, the `brumate` command, and the compiler API.

```ts
// vite.config.ts
import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [brumate({ navigate: { transition: true } })],
});
```

## Options

| Option       | Type                                                                      | Default                                                          | Meaning                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rpc`        | `string`                                                                  | `'/_brumate'`                                                    | The URL prefix of server function calls.                                                                                                                                |
| `origins`    | `string[]`                                                                | `[]`                                                             | Other origins that may call server functions and post forms, such as `'https://app.example.com'`. Calls from other sites answer 403.                                    |
| `routes`     | `string`                                                                  | `'src/routes'`                                                   | The directory of route files, relative to the root.                                                                                                                     |
| `routeTypes` | `string \| false`                                                         | `'src/brumate-routes.d.ts'`                                      | The declaration file that gives `href` the paths of the routes. The plugin writes it when routes are added or removed. `false` writes none.                             |
| `navigate`   | `boolean \| { transition?: boolean }`                                     | `true`                                                           | Loads pages without a full page load. `{ transition: true }` swaps pages inside a view transition.                                                                      |
| `preload`    | `boolean`                                                                 | `true`                                                           | After the page loads, while the browser is idle, loads the core and the code of handlers in or near the viewport. See [Idle preload](./client-modules.md#idle-preload). |
| `prerender`  | `boolean \| PrerenderOptions`                                             | `false`                                                          | Writes pages as static HTML files after the server build. `true` renders `/` and the pages its links lead to.                                                           |
| `merge`      | `number`                                                                  | `4096`                                                           | A component whose client parts are smaller than this many bytes in all, after minifying, ships them in its entry. `0` keeps one module per part.                        |
| `exclude`    | `(directory: string) => boolean`                                          | skips `node_modules`, `dist` and directories that start with `.` | Directories that are not searched for `.brm` files.                                                                                                                     |
| `a11y`       | `boolean`                                                                 | `true`                                                           | Warns about common accessibility mistakes in markup.                                                                                                                    |
| `devtools`   | `boolean`                                                                 | `true`                                                           | Adds the devtools button to pages on the dev server. Builds never have it.                                                                                              |
| `report`     | `boolean`                                                                 | `false`                                                          | Prints what the client build ships. See [Inspect and devtools](./inspect.md#build-report).                                                                              |
| `budget`     | `{ loader?: number; route?: number; event?: number; component?: number }` | none                                                             | Fails the client build when a size goes over it, in bytes after gzip.                                                                                                   |

### `PrerenderOptions`

| Option   | Type                                                  | Default         | Meaning                                                                               |
| -------- | ----------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `paths`  | `string[]`                                            | `['/']`         | The paths to render first.                                                            |
| `crawl`  | `boolean`                                             | `true`          | Follows links in each rendered page to other pages of the site, and renders them too. |
| `client` | `string`                                              | `'dist/client'` | The output directory of the client build, relative to the root.                       |
| `head`   | `(manifest: Record<string, ManifestChunk>) => string` | none            | Markup for the head of every page, from the manifest of the client build.             |

The client build must run first. The `_error.brm` of the root renders as `404.html`. See [Deploying](./deploying.md).

## `errorPage(error, server)`

`brumate/vite` exports `errorPage`, for a dev server that renders with `ssrLoadModule`. It returns a page that shows the error in Vite's error overlay:

```ts
} catch (error) {
  response.statusCode = 500;
  response.setHeader('content-type', 'text/html');
  response.end(errorPage(error, vite));
}
```

- A compile error shows the file, the line and the lines around it. A click on the file opens it in the editor.
- Other errors show their stack, with lines of the source files.
- The page loads again when a file changes, so a fix shows the page.
- It logs the error in the terminal too.

## Modules

| Import                     | Exports                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `virtual:brumate/start`    | Nothing. Importing it starts the loader with the manifest and the options of the plugin. Import it in the client entry.                                                                     |
| `virtual:brumate/manifest` | `load(id)`, which imports the client module of a component by component ID.                                                                                                                 |
| `virtual:brumate/routes`   | `routes`, the route tree, and `handle(request, options?)`, which answers a request with its page or endpoint, and form posts without scripts. It returns `undefined` when no route matches. |
| `virtual:brumate/server`   | `functions`, every server function by ID, and `handle(request)`, which answers server function calls only.                                                                                  |
| `virtual:brumate/testing`  | `mount` and `answerCalls`, for component tests. See [Testing](./testing.md).                                                                                                                |
| `./App.brm?brumate-server` | The server version of a component, in an environment that would load the client version, such as a test. It imports the server code of `'use server'` files.                                |

A server calls the `handle` of `virtual:brumate/server` for server function calls, and the `handle` of `virtual:brumate/routes` for pages. The second takes the [`DocumentOptions`](./reference-server.md#documentoptions), such as `scripts`. See [Deploying](./deploying.md).

Add `brumate/types` to the `types` of `tsconfig.json` to type these modules and `.brm` imports.

## Packages of components

The plugin also compiles the `.brm`, `.brm.ts` and `'use server'` files of dependencies whose `package.json` has a `brumate` field. Their components join the manifest. Their server functions join `virtual:brumate/server` when the app imports their files. The plugin keeps these packages out of Vite's dep optimizer and compiles them into the server build. See [Publishing components](./packages.md).

## The `brumate` command

```bash
brumate inspect [--json] [files or directories]
```

Shows what each component ships to the browser, and why. See [Inspect and devtools](./inspect.md).

## Compiler API

The `brumate` package exports the compiler, for tools.

| Export                            | What it does                                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compile(source, options?)`       | Compiles a `.brm` file. Returns `server`, `client`, `parts`, `render`, `css`, `warnings`, `maps` (a source map for each module) and `modules` (the `.brm.ts` modules it calls into). Throws `CompileError` with every error. |
| `inspect(source, options?)`       | Compiles a file and returns `{ report, text }`, the report of `brumate inspect`.                                                                                                                                             |
| `analyzeProject(files)`           | Finds, for each file of a map of sources, the props that its parents can change.                                                                                                                                             |
| `analyzeProjectProps(files)`      | The same, with the parents that change each prop.                                                                                                                                                                            |
| `toTypeScript(source, filename?)` | The TypeScript that the type checker reads for a file, with source mappings.                                                                                                                                                 |
| `parse(source, options?)`         | The syntax tree of a file. Throws `BrumateError` on a syntax error.                                                                                                                                                          |

`compile` takes these options:

| Option          | Type                                                     | Meaning                                                                                                                           |
| --------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `filename`      | `string`                                                 | The file name, for messages, the component name and the component ID.                                                             |
| `liveProps`     | `Set<string>`                                            | The props that parents can change, from `analyzeProject`. Without it, every prop can change.                                      |
| `path`          | `string`                                                 | The absolute path of the file, so SCSS and Less can import files next to it.                                                      |
| `merge`         | `number`                                                 | Merges small client parts, as the plugin option does. Defaults to `0`.                                                            |
| `a11y`          | `boolean`                                                | Warns about accessibility mistakes. Defaults to `true`.                                                                           |
| `hideNames`     | `boolean`                                                | Hashes the names of server functions in their IDs. The plugin sets it in builds. Defaults to `false`.                             |
| `resolveModule` | `(specifier, importer) => { path, source } \| undefined` | Reads a [module of reactive logic](./reactive-modules.md) that the file imports. Defaults to reading it from disk next to `path`. |

`inspect` takes the options of `compile`, and `parents`, the parents that change each prop, from `analyzeProjectProps`.
