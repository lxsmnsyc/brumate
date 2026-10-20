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

There are six. They need no import.

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
- It can hold a promise. On the server, a `#loading` body that reads it renders after the rest of the page, and the stream sends it when the promise settles. Code and markup outside every `#loading` body that read it wait for it where the memo is declared.
- An async `$memo` may only call server functions. See [Server functions](./server-functions.md).

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

### Where writes are allowed

Signals can be written in event handlers, `$effect` callbacks, `$client` callbacks and functions called from them. A write anywhere else is a compile error, such as a write inside a `$memo` or at setup after the declaration.

### Not supported

These solid-sfc functions are not supported:

- `$root`, `$owner`, `$runWithOwner` and `$reaction` need a runtime owner tree.
- `$renderEffect` and `$trackedEffect` are replaced by `$effect`.
- `$settled` and `$cleanup` are replaced by `$client` and the cleanup return value.
- `$derefSignal`, `$derefMemo`, `$get`, `$set`, `$refSignal` and `$property` pass signals out of the file. Signals never leave the file, so the compiler can see every read and write.
- `$store` and its helpers are deferred. In v1, an object in a signal is replaced as a whole.

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

Sets when the loader preloads the chunks of an element's handlers: `'hover'`, the default, `'visible'`, `'idle'` or `'none'`.

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
- `#repeat`, `#switch`, `#key`, `#try` with `#catch`, and `#loading`.
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
