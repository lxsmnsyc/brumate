# State and browser code

## Signals and memos

```brm
<script>
  import { $memo, $produce, $signal } from 'brumate/signals';

  let todos = $signal([{ id: 1, title: 'Write the docs', done: false }]);
  let query = $signal('');
  let selected = $signal<number>();
  const left = $memo(todos.filter((todo) => !todo.done).length);
  const shown = $memo(todos.filter((todo) => todo.title.includes(query)));

  function toggle(id: number) {
    $produce(todos, (draft) => {
      const todo = draft.find((item) => item.id === id);
      if (todo) {
        todo.done = !todo.done;
      }
    });
    selected = id;
  }
</script>

<input value=query onInput=((event) => (query = event.currentTarget.value))>
<p>{left} left, selected {selected}</p>
<ul>
  #for (todo of shown by todo.id) {
    <li><button onClick=(() => toggle(todo.id))>{todo.title}</button></li>
  }
</ul>
```

- `let name = $signal(value)` declares state that you write. `const name = $memo(expression)` declares a value that follows other values. A memo can read other memos.
- The start value of a signal is computed once, on the server, and does not track what it reads. Use a memo for a value that follows others.
- Without an argument, `$signal<number>()` starts as `undefined`.
- `$produce(signal, (draft) => …)` changes a draft in place and writes the result as a new value. Without it, assign a new array or object: `todos = todos.map(…)`.
- `$untrack(expression)` reads without depending on the values in it.
- A signal or a memo holds data that the server can send: strings, numbers, booleans, `null`, `undefined`, `bigint`, plain objects and arrays, `Date`, `Map`, `Set`, `URL`, typed arrays and promises. It never holds a function, a class instance or a regular expression. Keep a function as a plain function in the script, or pass it as a function prop. Send the source and the flags of a regular expression, and make it where you use it. An app that sends a class registers a plugin in `src/serial.ts`.
- Declare signals and memos at the top level of a script, or of the script of a block. A signal never leaves its file: pass its value, or a function that writes it.

```brm wrong: Cannot assign to memo "double"
<script>
  import { $memo, $signal } from 'brumate/signals';

  let count = $signal(0);
  const double = $memo(count * 2);

  function reset() {
    double = 0;
  }
</script>

<button onClick=reset>{double}</button>
```

```brm wrong: Signal "count" can only be written in event handlers, effects, $client callbacks and functions
<script>
  import { $signal } from 'brumate/signals';

  let count = $signal(0);
  count = 5;
</script>

<p>{count}</p>
```

```brm wrong: Declare $signal with let
<script>
  import { $signal } from 'brumate/signals';

  const count = $signal(0);
</script>

<p>{count}</p>
```

## Other derived values

- `const settled = $debounced(query, 300)` takes the value once it stops changing for 300 ms. `$throttled(value, ms)` takes it at most once in `ms`. The wait is a number literal.
- `$isPending(memo)` is true while an async memo loads.
- `let shown = $optimistic(source)` follows a memo, an action or a prop, and takes a value in the meantime.
- `const field = $id()` is an ID that is the same on the server and in the browser.

## Async data

A memo can hold a promise, such as the result of a server function. Markup and other memos see the value, never the promise.

```brm
<script>
  import { $debounced, $isPending, $memo, $signal } from 'brumate/signals';

  async function search(query: string): Promise<string[]> {
    'use server';
    return ['apple', 'banana'].filter((fruit) => fruit.includes(query));
  }

  let query = $signal('');
  const settled = $debounced(query, 300);
  const results = $memo(search(settled));
</script>

<input type="search" value=query onInput=((event) => (query = event.currentTarget.value))>
#if ($isPending(results)) {
  <p>Searching…</p>
}
#loading {
  <ul>
    #for (result of results by result) {
      <li>{result}</li>
    }
  </ul>
} #else {
  <p>Loading…</p>
}
```

- A server function is `async` with `'use server'` on its first line, in any script. It runs on the server and the browser calls it over the network. It reads no variable of the instance script: pass values as arguments. Its arguments and result are serializable data.
- A `.ts` file that starts with `'use server'` makes every export a server function.
- `#loading { … } #else { … }` renders the fallback first, and the body when the values it reads have loaded.
- `#defer { … }` renders its body on the server later, in a request of its own. It cannot be in a `#client` body or in markup that the browser renders.
- `const result = $action(save)` gives the result of a form that posts to the server function `save` of the same file.

```brm wrong: Server function "save" must be async
<script>
  function save(list: string[]) {
    'use server';
    return list.length;
  }
</script>

<p>Saving</p>
```

```brm wrong: Server function "save" captures "user". Pass it as an argument
<script>
  let user = 'Ada';

  async function save() {
    'use server';
    return user;
  }
</script>

<p>Saving</p>
```

## Effects and code for the browser

```brm
<script>
  import { $client, $effect, $signal } from 'brumate/signals';

  let count = $signal(0);
  let width = $signal<number>();
  let box = $signal<HTMLDivElement>();

  $effect(() => {
    document.title = `Clicked ${count} times`;
  });

  $client(() => {
    const measure = () => {
      width = window.innerWidth;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });

  $client(() => {
    box!.focus();
  }, 'idle');
</script>

<button onClick=(() => count++)>Add</button>
<div ref=$bind(box) tabindex="-1">The window is {width ?? 'not measured yet'} pixels wide.</div>
```

| You want to                                     | Use               |
| ----------------------------------------------- | ----------------- |
| Respond to something the user does              | A handler         |
| Run code when a value changes                   | `$effect`         |
| Run code when the page loads or comes into view | `$client`         |
| Render markup that needs the browser            | `#client`         |
| Reach an element from browser code              | `ref=$bind(name)` |

- `$effect` runs after the first change of a value that it reads. It never runs on mount and never on the server. Use `$client` for code on mount.
- `$client(callback, trigger)` runs once. The trigger is `'visible'` (the default), `'idle'` or `'load'`. Prefer `'visible'` or `'idle'`.
- A callback returns a cleanup function if it needs one. It runs before the next run of an effect, and when the component leaves the page.
- An effect depends on the values read by the functions that it calls. Wrap a call that reads and writes the same signal in `$untrack(save())`.
- The callback of `$effect` and `$client` takes no parameters and is not `async`.
- `ref=$bind(name)` writes the element into the signal `name`. On the server it is `undefined`, so read it in handlers, effects and `$client` callbacks.
- A handler that only writes signals needs no effect: the page updates by itself.

```brm wrong: The trigger of $client must be "visible", "idle" or "load"
<script>
  import { $client } from 'brumate/signals';

  $client(() => {
    document.title = 'Ready';
  }, 'mount');
</script>

<p>Ready</p>
```

```brm wrong: "field" is not declared
<script>
  import { $signal } from 'brumate/signals';

  let input = $signal<HTMLInputElement>();
</script>

<input ref=$bind(field)>
```

## Context

```brm
<script>
  import { $getContext, $setContext, $signal } from 'brumate/signals';
  import { Theme } from './theme.ts';

  let theme = $signal<'light' | 'dark'>('light');
  $setContext(Theme, theme);
  const parent = $getContext(Theme);
</script>

<p>{parent}</p>
```

`createContext` comes from `brumate/context`: `export const Theme = createContext<'light' | 'dark'>('light');` in a `.ts` file. A component reads the context of the nearest component above it, children included.
