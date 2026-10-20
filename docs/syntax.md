# Syntax

The syntax follows [solid-sfc](https://github.com/lxsmnsyc/solid-sfc). The file parts, the attribute syntax, the `#` blocks and block scripts are the same. The compile-time functions are fewer and some have different semantics.

The file extension is `.brm` for now.

## Parts of a file

```html
<script module>
  // Runs once when the module loads. Client chunks can import from it.
  export const MAX = 10;
</script>

<script>
  // Runs once for each instance, on the server only.
</script>

<style>
  /* Scoped CSS. ${expression} reads a value of the component. See Styles. */
</style>

<!-- Everything else is markup. -->
```

[Styles](./styles.md) describes `<style>` blocks.

## Compile-time functions

There are twelve. They need no import. Their types are in `brumate/types`, which also declares `.brm` modules and the Vite plugin's virtual modules:

```json
{ "compilerOptions": { "types": ["brumate/types"] } }
```

The code inside `.brm` files is not type-checked yet.

```ts
const { initial } = $props<{ initial: number }>();

let count = $signal(initial);
const double = $memo(count * 2);
let input = $signal<HTMLInputElement>();

$effect(() => {
  document.title = `${count}`;
  return () => {};
});

$client(() => {
  const chart = mount(canvas);
  return () => chart.destroy();
}, 'idle');

$untrack(count);
```

### `$props`

Returns the props of the component. Destructuring the call keeps each prop reactive, as in solid-sfc.

### `$signal`

Declares writable state. Reading the variable reads the value. Assigning to it writes the value.

- The initial value is computed once, on the server. Without an argument, it is `undefined`.
- It does not track the values it reads. `$signal(price * 2)` does not change when `price` changes.
- To reset a signal when a source changes, write it in an `$effect`.

### `$memo`

Declares a read-only value computed from other values.

- Assigning to it is a compile error.
- Any memo can hold a promise, such as the result of a server function, `fetch` or an imported function. The compiler does not need to know which ones do: it checks the value when the memo runs.
- On the server, a `#loading` body that reads a promise renders after the rest of the page, and the stream sends it when the promise settles. Code and markup outside every `#loading` body that read the memo wait for it where the memo is declared.
- On the client, when the values that the memo reads change, the memo runs again. If it returns a promise, the page keeps the old value until the promise settles. Only the latest run is written, so a slow answer to an older run is dropped. If the promise rejects, the old value stays and the error is logged.
- `await` can be used in the expression, as in `$memo(await load(id))`.

### `$isPending`

`$isPending(memo)` is true while a new value of the memo is loading on the client:

```html
<script>
  let query = $signal('');
  const results = $memo(search(query));
</script>

#if ($isPending(results)) {
  <p>Searching</p>
}
```

On the server, it is always false.

### `$id`

`const name = $id()` returns an ID that is unique in the page, for attributes such as `for`, `id` and `aria-describedby`:

```html
<script>
  const id = $id();
</script>

<label for=id>Email</label>
<input id=id>
```

- The ID is made from the ID of the scope and the position of the call in its script, such as `b0-0`. Server and client make the same ID, and nothing is counted at runtime.
- In the script of a block, each instance gets its own IDs, such as each item of a `#for`.
- Scopes that the client creates have negative IDs, so IDs made on the client never match the server's.

### `$title`

`$title(value)` sets the title of the page. It is a statement at the top level of a script.

```ts
let count = $signal(0);
$title(`Clicked ${count} times`);
```

The server writes `<title>` into the head of the page. When the value changes on the client, the title changes too. If several components set a title, the last one that renders wins. A component in a `#loading` body that resolves after the first render sets the title when its body streams in.

### `$provide` and `$context`

A context passes a value to every component inside a component, without props:

```ts
// theme.ts
import { createContext } from 'brumate/context';

export const Theme = createContext<'light' | 'dark'>('theme', 'light');
```

```html
<!-- Layout.brm -->
<script>
  import { Theme } from './theme';

  let theme = $signal<'light' | 'dark'>('dark');
  $provide(Theme, theme);
</script>

<!-- Button.brm, anywhere inside Layout -->
<script>
  import { Theme } from './theme';

  const theme = $context(Theme);
</script>
```

- `createContext(key, defaultValue)` creates a context. The key names it in the page state, so it must be unique in the app.
- `$provide(context, value)` is a statement at the top level of a script. A block script provides to the markup of its block.
- `const name = $context(context)` reads the value of the nearest component above that provides it, or the default value.
- When the provided value changes on the client, every component that reads it from that provider updates, including components that the client renders later.

### Element references

`ref=name` on an element writes the element into the signal `name`:

```html
<script>
  let input = $signal<HTMLInputElement>();

  function focus() {
    input.focus();
  }
</script>

<input ref=input>
<button onClick=focus>Focus</button>
```

- The target must be a `$signal` declared in the same file.
- On the server, the signal stays `undefined`. Setup code cannot read the element.
- For an element that the server rendered, the signal is serialized as a reference to the element's marker. The runtime finds the element when client code first reads the signal.
- For an element that the client creates, such as in a new `#for` item, the runtime writes the signal when it creates the element. Nodes that read the signal update.

### `$effect`

Runs a callback when the values it reads change, after the page resumes.

- It never runs on the server.
- It never runs on page load. Its first run is after the first change.
- The callback can return a cleanup function. It runs before the next run and when the scope is removed.

### `$client`

Runs a callback in the browser when a trigger fires, without waiting for a change.

| Trigger     | Runs when                                                                          |
| ----------- | ---------------------------------------------------------------------------------- |
| `'visible'` | The first element of the scope enters the viewport. This is the default.           |
| `'idle'`    | The browser is idle.                                                               |
| `'load'`    | The page loads. The compiler warns, because this code runs before any interaction. |

The callback can return a cleanup function.

### `$untrack`

Reads a value without adding an edge to the graph.

### `$produce`

Changes an object or an array in a signal by changing a draft of it:

```ts
let todos = $signal<Todo[]>([]);

function toggle(id: string) {
  $produce(todos, (draft) => {
    const todo = draft.find((item) => item.id === id);
    if (todo) {
      todo.done = !todo.done;
    }
  });
}
```

- It writes the signal with a new value, as `todos = produce(todos, recipe)` would. It is allowed where writes are.
- The new value shares every object that the recipe did not change. A keyed `#for` keeps the elements of those items, and their markup does not update.
- If the recipe changes nothing, the signal keeps its value and nothing updates.
- The recipe can return a new value instead of changing the draft.
- Only plain objects and arrays are drafted. A `Map`, a `Set` or a class instance inside the value is used as it is, so changing it does not make a new value.

### Where writes are allowed

Signals can be written in event handlers, `$effect` callbacks, `$client` callbacks and functions called from them. A write anywhere else is a compile error, such as a write inside a `$memo` or at setup after the declaration.

### Not supported

These solid-sfc functions are not supported:

- `$root`, `$owner`, `$runWithOwner` and `$reaction` need a runtime owner tree.
- `$renderEffect` and `$trackedEffect` are replaced by `$effect`.
- `$settled` and `$cleanup` are replaced by `$client` and the cleanup return value.
- `$derefSignal`, `$derefMemo`, `$get`, `$set`, `$refSignal` and `$property` pass signals out of the file. Signals never leave the file, so the compiler can see every read and write.
- Changing a value in place, such as `todos.push(todo)` or `todo.done = true`, is a warning, because nothing updates.
- `$store` and its helpers are not supported. An object or array in a signal changes by assigning a new value, such as `todos = todos.map(…)`, or with `$produce`. A keyed `#for` keeps the elements of items that stay, so only changed items update.

Scripts, expressions and attribute values cannot contain markup, as they can in solid-sfc. Use `#for` for lists and a [`#template`](#control-flow) for markup that is used as a value.

Functions imported from other modules receive values, not signals. They run on the server at setup, or on the client inside a client root.

## Markup

The attribute syntax is the same as solid-sfc:

```html
<button onClick=increment disabled=(count > MAX)>{count}</button>
<a {href} {...rest}>Open</a>
<{tag} class="title">Hello</>
```

### Event modifiers

Modifiers follow the event name and apply before the handler loads:

| Modifier   | Effect                                     |
| ---------- | ------------------------------------------ |
| `:prevent` | Calls `event.preventDefault()`.            |
| `:stop`    | Calls `event.stopPropagation()`.           |
| `:passive` | Adds the listener as passive.              |
| `:once`    | Removes the handler after the first event. |
| `:capture` | Listens in the capture phase.              |

```html
<form onSubmit:prevent=save>
```

### `prefetch`

Sets when the loader preloads the core and the parts of an element's handlers, so the first event does not wait for them:

- `'hover'`, the default: when the pointer moves over the element, or the element gets focus.
- `'visible'`: when the element enters the viewport.
- `'idle'`: when the browser is idle after the page loads.
- `'none'`: never.

### Window and document events

```html
<window onKeyDown=close />
<document onVisibilityChange=pause />
```

They are client roots. Their listeners are added when the page resumes, and removed with their scope.

## Control flow

These blocks work as in solid-sfc:

- `#if`, `#else if` and `#else`.
- `#for (item, index of list by key)` and its `#else`.
- `#repeat`, `#switch`, `#key`, `#try` with `#catch`, and `#loading`. The `reset` of `#catch (error, reset)` renders the `#try` body again on the client. If it throws again, the fallback renders again.
- `#portal`. See below.
- `#template`.
- A `<script>` at the start of a block body.

The difference is that a block's create code ships only if its condition, list or key can change on the client. Otherwise the block is HTML only.

Markup is static by default. Markup that never changes ships as HTML only, so there is no block to mark it static.

### `#portal`

Renders its body somewhere else in the page.

```html
#if (open) {
  #portal {
    <dialog open>Saved</dialog>
  }
}

#portal ('#sidebar') {
  <nav>…</nav>
}
```

- Without a target, the body goes to the end of the page. The server writes it after the rest of the markup, and the client appends it to `<body>`.
- With a target, an element or a selector, the client renders the body into the target when the page loads, because the target exists only in the browser. A target that changes on the client is not supported yet.
- The content of a portal is removed with the block that contains it, such as the `#if` above.

### `#head`

Renders its body into the document's `<head>`, for tags such as `<meta>` and `<link>`:

```html
#head {
  <meta name="description" content=(`${count} items`)>
}
```

- The server collects it into the head of the page, after the `$title`.
- Attributes can change on the client.
- Inside a block that the client renders, the content is added to `<head>`, and removed with the block.
- Use `$title` for the title. Text in `<title>` cannot hold the markers that updates need.

### `#client`

Skips the body on the server. The client renders it when its trigger fires. The trigger is the same as for `$client`, and defaults to `'visible'`.

```html
#client ('idle') {
  <Map center=location />
}
```

## Components

```html
<!-- Child.brm -->
<script>
  const { value, onChange } = $props<{ value: number; onChange: (value: number) => void }>();
</script>

<button onClick=(() => onChange(value + 1))>{value}</button>
```

```html
<!-- Parent.brm -->
<script>
  import Child from './Child.brm';

  let count = $signal(0);
</script>

<Child value=count onChange=((value) => (count = value)) />
```

- A prop can change on the client only if a parent passes it a value that can change. The compiler finds these props across the project. See [Props across files](./compiler.md#props-across-files).
- A function passed as a prop must be a client function. The compiler moves it out of the parent and gives it a reference to the parent's scope.
- `children` and `#template` values passed as props are rendered on the server. They ship only if the client must create them again.
- `children` ship as the HTML that the server rendered. When a component inserts them again on the client, such as in an `#if` that opens, the client updates the values in them to the current ones. Their handlers work.
