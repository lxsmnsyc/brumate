# brumate

> A component language and compiler for resumable web apps.

`brumate` compiles single-file components into server-rendered HTML and small client chunks. The client does not hydrate. It reads the state that the server wrote into the page and loads the code for an event handler only when that event fires.

This repository holds the design and the compiler. The compiler generates a server module that renders HTML with the state, and a client module that resumes it. A Vite plugin compiles `.brm` files in an app.

## Goals

- Ship only the client code that an interaction can reach. Markup that never changes ships as HTML and nothing else.
- Never run component code again on the client to rebuild state.
- Keep a loader under 1 KB that is the only code loaded before the first interaction.
- Keep the syntax small: scripts, markup with `#` blocks, and a few compile-time functions.

## Example

```html
<script>
  import { $memo, $props, $signal } from 'brumate/signals';
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
<form onSubmit:prevent=add>
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

[`examples/todos`](./examples/todos) renders a todo list and a counter on the server. In the browser, only the loader runs before the first click.

## Documents

- [Execution model](./docs/model.md) explains what runs where and how the compiler decides what ships.
- [Syntax](./docs/syntax.md) describes the file format, the compile-time functions, markup and control flow.
- [Server functions](./docs/server-functions.md) describes the `'use server'` directive.
- [Styles](./docs/styles.md) describes scoped CSS and style variables.
- [Grammar](./docs/grammar.md) defines the file format in EBNF.
- [Intermediate representation](./docs/ir.md) defines the data that each compiler stage produces.
- [Compiler](./docs/compiler.md) describes the pipeline, the output and the runtime.
- [Vite](./docs/vite.md) describes the Vite plugin.
- [Routing](./docs/routing.md) describes route files, layouts and sibling routes.
- [TypeScript](./docs/typescript.md) describes type-checking `.brm` files.
- [Inspect](./docs/inspect.md) describes `brumate inspect`, which shows what each component ships to the client and why.
- [Page format](./docs/page-format.md) describes the markers and the state that the server writes into the page.
- [Decisions](./docs/decisions.md) lists what is decided and what is still open.
- [Proposals](./docs/proposals.md) lists features that would be good to add, with a sketch of each.
- [Prior art](./docs/prior-art.md) compares other resumable and partially hydrated frameworks.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm format
```

The tests in [`packages/brumate/test/fixtures`](./packages/brumate/test/fixtures) parse and analyze each `.brm` file. The output of every stage is compared with a snapshot in `test/__snapshots__`. The tests in [`packages/brumate/test/render`](./packages/brumate/test/render) compile each component, render it on the server, and compare the modules, the HTML and the state with a snapshot. The tests in `test/resume.test.ts` load that HTML into a DOM, start the loader, and check that events update the page.

## Name

Brumation is the dormant state of reptiles in cold weather. A reptile in brumation stays inactive but wakes up briefly to drink when it needs to, then goes back to rest. A `brumate` page does the same with its code. It loads a handler only when an event needs it.

The name is free on npm.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
