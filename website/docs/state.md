# State

State is the data of a component that can change in the browser. `$signal` declares a value that you write, and `$memo` declares a value that is computed from other values.

```brm live
<script>
  import { $memo, $signal } from 'brumate/signals';

  let count = $signal(0);
  const double = $memo(count * 2);
</script>

<button onClick=(() => count++)>Clicked {count} times</button>
<p>Double: {double}</p>
```

## `$signal`

`$signal(value)` declares writable state. The variable is the value: read it like any variable, and assign to it to change it.

```brm
<script>
  import { $signal } from 'brumate/signals';

  let name = $signal('Ada');
  let tags = $signal<string[]>([]);
  let selected = $signal<number>();
</script>
```

- Declare a signal with `let`, because you assign to it. `const` is a compile error.
- Assigning a new value updates every part of the page that reads it. `count++`, `count += 1` and `count = count + 1` all work.
- The initial value is computed once, on the server, when the component renders.
- Without an argument, the value is `undefined`. Give the type as `$signal<number>()`, and the type includes `undefined`.
- The initial value does not track what it reads. `let total = $signal(price * 2)` keeps its value when `price` changes. Use `$memo` for a value that follows other values.

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let name = $signal('Ada');
</script>

<label>
  Name
  <input value=name onInput=((event) => (name = event.currentTarget.value))>
</label>
<p>Hello, {name}.</p>
```

### Where you can write a signal

A signal can be written in code that runs in the browser:

- Event handlers, such as `onClick` and `onInput`.
- Functions that a handler calls.
- `$effect` and `$client` callbacks. See [Effects and browser code](./effects.md).

Code that runs while the component renders cannot write a signal. Its value at render time is the value that the page starts with, so a later write there would have no effect. The compiler reports it:

```brm
<script>
  import { $signal } from 'brumate/signals';

  let count = $signal(0);
  count = 5;
</script>
```

```
Signal "count" can only be written in event handlers, effects, $client callbacks and functions (App.brm:5:3)
```

Compute the starting value in the call instead: `let count = $signal(5)`.

## `$memo`

`$memo(expression)` declares a value that is computed from other values. When a value that it reads changes, the memo computes again.

```brm live
<script>
  import { $memo, $signal } from 'brumate/signals';

  let items = $signal(['apple', 'apricot', 'banana', 'cherry']);
  let query = $signal('');
  const shown = $memo(items.filter((item) => item.startsWith(query)));
  const count = $memo(shown.length);
</script>

<label>
  Filter
  <input value=query onInput=((event) => (query = event.currentTarget.value))>
</label>
<p>{count} of {items.length} shown</p>
<ul>
  #for (item of shown by item) {
    <li>{item}</li>
  }
</ul>
```

- Declare a memo with `const`. `let` is a compile error, and so is assigning to the memo: `Cannot assign to memo "count"`.
- A memo can read other memos. `count` above reads `shown`, which reads `items` and `query`.
- A memo computes on the server for the first render. The browser gets its value with the page, so it does not compute again until a value it reads changes.
- Keep a memo free of side effects, such as writing a signal or changing the page. Use an [effect](./effects.md) for those.

A memo can also hold a promise, such as the result of a server function. [Async data](./async-data.md) covers that.

### Waiting for a pause

A search field that loads results as the user types should wait for a pause. `$debounced(value, ms)` is a memo that takes the value once it stops changing for `ms` milliseconds:

```brm
<script>
  import { $debounced, $isPending, $memo, $signal } from 'brumate/signals';
  import { search } from './search.ts';

  let query = $signal('');
  const settled = $debounced(query, 300);
  const results = $memo(search(settled));
</script>

<input type="search" value=query onInput=((event) => (query = event.currentTarget.value))>
#if ($isPending(settled)) {
  <p>Waiting for you to stop typing…</p>
}
<ul>
  #for (result of results by result.id) {
    <li>{result.title}</li>
  }
</ul>
```

- `$throttled(value, ms)` takes the value at most once every `ms` milliseconds: the first change at once, and the last one after the wait. Use it for values that change all the time, such as the position of the pointer.
- On the server, both are the value itself, so the page renders the results for the query that it has.
- In the browser, the memo is pending while it waits, so `$isPending` is true.
- `ms` is a number, such as `300`.

## `$produce`

A signal changes when you assign a new value. To change one item of an array or one field of an object, `$produce` gives you a draft that you can change in place, and writes the result as a new value:

```brm live
<script>
  import { $memo, $produce, $signal } from 'brumate/signals';

  let todos = $signal([
    { id: 1, title: 'Write the docs', done: true },
    { id: 2, title: 'Ship it', done: false },
  ]);
  const left = $memo(todos.filter((todo) => !todo.done).length);

  function toggle(id: number) {
    $produce(todos, (draft) => {
      const todo = draft.find((item) => item.id === id);
      if (todo) {
        todo.done = !todo.done;
      }
    });
  }
</script>

<ul>
  #for (todo of todos by todo.id) {
    <li>
      <label>
        <input type="checkbox" checked=todo.done onChange=(() => toggle(todo.id))>
        {todo.title}
      </label>
    </li>
  }
</ul>
<p>{left} left</p>
```

- The new value shares every object that the recipe did not change. With a keyed `#for`, only the changed item updates.
- If the recipe changes nothing, the signal keeps its value and nothing updates.
- The recipe can return a new value instead of changing the draft.
- Only plain objects and arrays are drafted. A `Map`, a `Set` or a class instance inside the value is used as it is.
- `$produce` writes the signal, so it is allowed where writes are.

Without `$produce`, write a new value yourself: `todos = todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo))`.

## `$untrack`

`$untrack(expression)` reads values without depending on them. The memo or effect around it does not compute again when they change.

Here the list follows the filter as you type, but a new page size only applies with the next change of the filter:

```brm live
<script>
  import { $memo, $signal, $untrack } from 'brumate/signals';

  const fruits = ['apple', 'apricot', 'avocado', 'banana', 'blueberry', 'cherry'];
  let query = $signal('');
  let size = $signal(2);
  const shown = $memo(fruits.filter((fruit) => fruit.includes(query)).slice(0, $untrack(size)));
</script>

<label>
  Filter
  <input value=query onInput=((event) => (query = event.currentTarget.value))>
</label>
<label>
  Page size
  <input type="number" value=size onInput=((event) => (size = Number(event.currentTarget.value)))>
</label>
<ul>
  #for (fruit of shown by fruit) {
    <li>{fruit}</li>
  }
</ul>
```

`$untrack` also covers the functions that the expression calls. [Effects](./effects.md#effects-depend-on-the-functions-they-call) shows why that matters.

## Rules and common mistakes

- Changing a value in place does not update anything, because the signal still holds the same object. `todos.push(todo)` and `todo.done = true` are compile warnings, such as `This changes the value of todos in place, so nothing that reads it updates`. Assign a new value, or use `$produce`.
- A signal never leaves its file. A function receives the value of a signal, not the signal, so the compiler can see every read and write. To let another component change a value, pass it a function, such as `onChange=((value) => (count = value))`. See [Components](./components.md).
- Functions imported from other modules work with values. `format(count)` gets a number, and cannot write `count`.
- Each signal holds one value. There are no stores: an object or array changes by assigning a new value, or with `$produce`.
- Declare signals and memos at the top level of a `<script>`, or of the script of a block. A declaration inside a function is a compile error.

## What the browser gets

The server renders the page with the values of every signal and memo. The browser only gets the values that its code reads, such as a signal that a handler writes and the memos that read it. A signal that no code in the browser writes stays on the server, and the page shows it as plain HTML.

[What runs where](./what-runs-where.md) explains which code and values the browser gets.
