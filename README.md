<p align="center"><img src=".github/banner.png" alt="brumate: web apps that resume, not hydrate. A component language and compiler for the web." width="100%"></p>

# brumate

> A component language and compiler for resumable web apps.

`brumate` compiles single-file components into server-rendered HTML and small client chunks. The client does not hydrate. It reads the state that the server wrote into the page and loads the code for an event handler only when that event fires.

The compiler generates a server module that renders HTML with the state, and client modules that resume it. A Vite plugin compiles `.brm` files in an app.

This repository holds the compiler and its runtime, the type checker and editor support, the website, examples, benchmarks and smoke tests. brumate is at 0.x: the page format can change between versions, so the server and the client must come from the same version.

## Goals

- Ship only the client code that an interaction can reach. Markup that never changes ships as HTML and nothing else.
- Never run component code again on the client to rebuild state.
- Keep the loader, the only code that loads before the page is used, under 1 KB. It is about 2 KB after gzip today.
- Keep the syntax small: scripts, markup with `#` blocks, and a few compile-time functions.

## Example

```html
<script>
  import { $memo, $props, $signal } from 'brumate/signals';
  import { prevent } from 'brumate/events';
  import { persist } from './todos.server';

  const { initial } = $props<{ initial: Todo[] }>();
  let todos = $signal(initial);
  let draft = $signal('');
  const left = $memo(todos.filter((todo) => !todo.done).length);

  async function add() {
    todos = [...todos, { id: crypto.randomUUID(), title: draft, done: false }];
    draft = '';
    await persist(todos);
  }
</script>

<h1>Todos</h1>
<form onSubmit=(prevent(add))>
  <input value=draft onInput=((event) => (draft = event.currentTarget.value))>
</form>
<ul>
  #for (todo of todos by todo.id) {
    <li class={ done: todo.done }>{todo.title}</li>
  }
</ul>
<p>{left} left</p>
```

The `<h1>` produces no client code. The `#for` item template ships because `add` can change `todos`. `persist` is a server function, so the client only gets a call stub.

## Try it

```bash
pnpm install
pnpm build
pnpm --filter example-todos dev
```

[`examples/todos`](./examples/todos) renders a todo list and a counter on the server. In the browser, only the loader runs until the page loads.

[`examples/tracker`](./examples/tracker) is a small issue tracker with sign-in, middleware, form validation, optimistic updates, streaming and a prerendered page. Run it with `pnpm --filter example-tracker dev`.

[`examples/hackernews`](./examples/hackernews) is a Hacker News reader with feeds, threads of comments and users, cached on the server. Run it with `pnpm --filter example-hackernews dev`.

[`examples/ui-kit`](./examples/ui-kit) is a package of components, and [`examples/kit-app`](./examples/kit-app) is an app that uses it.

## Documents

The documentation is in [`website/docs`](./website/docs), and the website shows it with samples that run in the page.

- [Introduction](./website/docs/index.md) and [Getting started](./website/docs/getting-started.md) set up a project.
- [Your first app](./website/docs/tutorial.md) builds a todo app step by step.
- The guides cover [components](./website/docs/components.md), [state](./website/docs/state.md), [async data](./website/docs/async-data.md), [server functions](./website/docs/server-functions.md), [routing](./website/docs/routing.md), [testing](./website/docs/testing.md), [publishing components](./website/docs/packages.md) and the rest.
- The reference lists every [compile-time function](./website/docs/reference-signals.md), [block](./website/docs/reference-blocks.md), [runtime export](./website/docs/reference-server.md) and [plugin option](./website/docs/reference-plugin.md).
- The internals describe the [reactive graph](./website/docs/reactive-graph.md), the [page format](./website/docs/page-format.md) and the [server function protocol](./website/docs/server-protocol.md).

Design notes for contributors are in [`docs`](./docs):

- [Grammar](./docs/grammar.md) defines the file format in EBNF.
- [Intermediate representation](./docs/ir.md) defines the data that each compiler stage produces.
- [Compiler](./docs/compiler.md) describes the pipeline, the output and the runtime.
- [Decisions](./docs/decisions.md) lists what is decided and what is still open.
- [Proposals](./docs/proposals.md) lists features that would be good to add, with a sketch of each.
- [Prior art](./docs/prior-art.md) compares other resumable and partially hydrated frameworks.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format
pnpm e2e                          # browser tests of the website and examples
pnpm bench                        # benchmarks, against other frameworks
pnpm --filter website check:samples   # the live samples of the docs compile
```

Build first: the examples and the website use the built `brumate` package.

The tests in [`packages/brumate/test/fixtures`](./packages/brumate/test/fixtures) parse and analyze each `.brm` file. The output of every stage is compared with a snapshot in `test/__snapshots__`. The tests in [`packages/brumate/test/render`](./packages/brumate/test/render) compile each component, render it on the server, and compare the modules, the HTML and the state with a snapshot. The tests in `test/resume.test.ts` load that HTML into a DOM, start the loader, and check that events update the page.

## Branches

Minor work (features, minor fixes, docs of unreleased work) goes to pull requests against `next`. Hotfixes go to pull requests against `main`. Releases are published from `main` only, and `next` publishes nothing. After each release from `main`, merge `main` into `next`. A minor release promotes `next` into `main` in one pull request. See [Decisions](./docs/decisions.md).

## Benchmarks

[`benchmarks`](./benchmarks) builds the same three pages with brumate, Qwik 1, Qwik 2 and Marko 6: a small counter and todo app, a dashboard with 50 rarely used widgets, and a table of rows from js-framework-benchmark. It compares the client code each page loads, the size of the server-rendered HTML, how fast the server renders, and the work of the browser after a click. It needs a local Chrome for the browser metrics.

```bash
pnpm bench
```

[`benchmarks/README.md`](./benchmarks/README.md) describes each metric and has the results of a run.

## Smoke tests

[`e2e`](./e2e/README.md) builds the website and the examples, serves them, and uses them in Chrome. Run it with `pnpm e2e`.

## Name

Brumation is the dormant state of reptiles in cold weather. A reptile in brumation stays inactive but wakes up briefly to drink when it needs to, then goes back to rest. A `brumate` page does the same with its code. It loads a handler only when an event needs it.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
