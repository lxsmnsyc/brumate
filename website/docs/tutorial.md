# Your first app

This tutorial builds a todo list in six steps: a list, a form that adds items, toggling items, a count of what is left, saving on the server, and a route. Each step shows the whole component, and every sample before the last runs in the page, so you can change it and see what happens.

## 1. Show a list

A signal holds the todos, and `#for` renders one item for each:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  interface Todo {
    id: number;
    title: string;
    done: boolean;
  }

  let todos = $signal<Todo[]>([
    { id: 1, title: 'Read the docs', done: true },
    { id: 2, title: 'Build an app', done: false },
  ]);
</script>

<h2>Todos</h2>
<ul>
  #for (todo of todos by todo.id) {
    <li>{todo.title}</li>
  }
</ul>
```

- `$signal` declares state. `todos` reads like any variable.
- `#for (todo of todos by todo.id)` renders the body for each item. `by todo.id` names the key that tells items apart when the list changes.
- Nothing can change `todos` yet, so no code of this component ever loads in the browser. The list is HTML only.

## 2. Add items

A second signal holds the text of the field. Submitting the form adds a todo with it:

```brm live
<script>
  import { $signal } from 'brumate/signals';
  import { prevent } from 'brumate/events';

  interface Todo {
    id: number;
    title: string;
    done: boolean;
  }

  let todos = $signal<Todo[]>([
    { id: 1, title: 'Read the docs', done: true },
    { id: 2, title: 'Build an app', done: false },
  ]);
  let draft = $signal('');

  function add() {
    if (draft.trim() === '') {
      return;
    }
    todos = [...todos, { id: Date.now(), title: draft, done: false }];
    draft = '';
  }
</script>

<h2>Todos</h2>
<form onSubmit=(prevent(add))>
  <label>
    New todo
    <input value=draft onInput=((event) => (draft = event.currentTarget.value))>
  </label>
  <button>Add</button>
</form>
<ul>
  #for (todo of todos by todo.id) {
    <li>{todo.title}</li>
  } #else {
    <li>Nothing to do.</li>
  }
</ul>
```

- `onSubmit=(prevent(add))` runs `add` when the form is submitted. `prevent` from `brumate/events` stops the browser from loading a new page, before the code of `add` loads.
- Assigning to a signal writes it: `draft = ''` empties the field, because the field reads `value=draft`.
- `todos = [...todos, …]` writes a new array. Changing the array in place, such as with `todos.push(…)`, would not update the page, and the compiler warns about it.
- `#else` renders when the list is empty.
- The code of each handler loads the first time its event fires. The page loads none of it before that.

## 3. Toggle items

A checkbox on each item marks it done. `$produce` changes one item in place on a copy, and writes the copy:

```brm live
<script>
  import { $produce, $signal } from 'brumate/signals';
  import { prevent } from 'brumate/events';

  interface Todo {
    id: number;
    title: string;
    done: boolean;
  }

  let todos = $signal<Todo[]>([
    { id: 1, title: 'Read the docs', done: true },
    { id: 2, title: 'Build an app', done: false },
  ]);
  let draft = $signal('');

  function add() {
    if (draft.trim() === '') {
      return;
    }
    todos = [...todos, { id: Date.now(), title: draft, done: false }];
    draft = '';
  }

  function toggle(id: number) {
    $produce(todos, (list) => {
      const todo = list.find((item) => item.id === id);
      if (todo) {
        todo.done = !todo.done;
      }
    });
  }
</script>

<h2>Todos</h2>
<form onSubmit=(prevent(add))>
  <label>
    New todo
    <input value=draft onInput=((event) => (draft = event.currentTarget.value))>
  </label>
  <button>Add</button>
</form>
<ul>
  #for (todo of todos by todo.id) {
    <li>
      <label>
        <input type="checkbox" checked=todo.done onChange=(() => toggle(todo.id))>
        {todo.title}
      </label>
    </li>
  } #else {
    <li>Nothing to do.</li>
  }
</ul>
```

- `$produce(todos, recipe)` gives the recipe a copy to change, and writes the result to `todos`. Items that the recipe did not touch stay the same objects, so their markup does not update.
- `checked=todo.done` sets the attribute from the item, and updates it when the item changes.

## 4. Count what is left

A memo computes a value from other values. It updates when they change:

```brm live
<script>
  import { $memo, $produce, $signal } from 'brumate/signals';
  import { prevent } from 'brumate/events';

  interface Todo {
    id: number;
    title: string;
    done: boolean;
  }

  let todos = $signal<Todo[]>([
    { id: 1, title: 'Read the docs', done: true },
    { id: 2, title: 'Build an app', done: false },
  ]);
  let draft = $signal('');
  const left = $memo(todos.filter((todo) => !todo.done).length);

  function add() {
    if (draft.trim() === '') {
      return;
    }
    todos = [...todos, { id: Date.now(), title: draft, done: false }];
    draft = '';
  }

  function toggle(id: number) {
    $produce(todos, (list) => {
      const todo = list.find((item) => item.id === id);
      if (todo) {
        todo.done = !todo.done;
      }
    });
  }
</script>

<style>
  .done {
    color: gray;
    text-decoration: line-through;
  }
</style>

<h2>Todos</h2>
<form onSubmit=(prevent(add))>
  <label>
    New todo
    <input value=draft onInput=((event) => (draft = event.currentTarget.value))>
  </label>
  <button>Add</button>
</form>
<ul>
  #for (todo of todos by todo.id) {
    <li class={ done: todo.done }>
      <label>
        <input type="checkbox" checked=todo.done onChange=(() => toggle(todo.id))>
        {todo.title}
      </label>
    </li>
  } #else {
    <li>Nothing to do.</li>
  }
</ul>
<p>{left} left</p>
```

- `$memo(todos.filter(…).length)` follows `todos`. Toggling or adding a todo updates `left`.
- `class={ done: todo.done }` adds the class `done` while `todo.done` is true.
- The `<style>` block applies only to this component. [Styles](./styles.md) describes it.

## 5. Save on the server

A function with `'use server'` runs on the server. In the browser, calling it sends a request. Here the server keeps the todos in a list of its module. This sample's server runs in the page, so the list resets when you edit the code:

```brm live
<script module>
  // The todos on the server. A real app would use a database.
  const saved = [
    { id: 1, title: 'Read the docs', done: true },
    { id: 2, title: 'Build an app', done: false },
  ];
</script>

<script>
  import { $memo, $produce, $signal } from 'brumate/signals';
  import { prevent } from 'brumate/events';

  interface Todo {
    id: number;
    title: string;
    done: boolean;
  }

  async function load(): Promise<Todo[]> {
    'use server';
    return saved;
  }

  async function save(list: Todo[]): Promise<number> {
    'use server';
    saved.splice(0, saved.length, ...list);
    return saved.length;
  }

  let todos = $signal(await load());
  let draft = $signal('');
  let status = $signal('');
  const left = $memo(todos.filter((todo) => !todo.done).length);

  async function add() {
    if (draft.trim() === '') {
      return;
    }
    todos = [...todos, { id: Date.now(), title: draft, done: false }];
    draft = '';
    status = `Saved ${await save(todos)} todos`;
  }

  async function toggle(id: number) {
    $produce(todos, (list) => {
      const todo = list.find((item) => item.id === id);
      if (todo) {
        todo.done = !todo.done;
      }
    });
    status = `Saved ${await save(todos)} todos`;
  }
</script>

<style>
  .done {
    color: gray;
    text-decoration: line-through;
  }
</style>

<h2>Todos</h2>
<form onSubmit=(prevent(add))>
  <label>
    New todo
    <input value=draft onInput=((event) => (draft = event.currentTarget.value))>
  </label>
  <button>Add</button>
</form>
<ul>
  #for (todo of todos by todo.id) {
    <li class={ done: todo.done }>
      <label>
        <input type="checkbox" checked=todo.done onChange=(() => toggle(todo.id))>
        {todo.title}
      </label>
    </li>
  } #else {
    <li>Nothing to do.</li>
  }
</ul>
<p>{left} left. {status}</p>
```

- `<script>` runs once for each instance, on the server only. `await load()` gets the todos while the page renders, and the signal starts with them.
- `<script module>` runs once when the module loads. Server functions can use what it declares.
- `save` runs on the server. Its body never ships to the browser, and its arguments and its result are sent as data.
- The page writes `todos` first and saves after, so the list updates at once.

[Server functions](./server-functions.md) describes the rules, errors and the request.

## 6. Move it into a route

In an app, the todo list is a component that a route renders. Move the component to `src/Todos.brm`, and render it from a route file:

```brm
<!-- src/routes/todos.brm -->
<script>
  import Todos from '../Todos.brm';
</script>

<Todos />
```

The page is now at `/todos`, inside the layout of `src/routes/_layout.brm`. Add a link to it in the layout:

```brm
<nav>
  <a href="/">Home</a>
  <a href="/todos">Todos</a>
</nav>
<main>{children}</main>
```

Once the loader runs, a click on a link loads the next page without a full page load, and the layout stays. [Routing](./routing.md) and [Navigation](./navigation.md) describe both.

## Next

- [Components](./components.md) splits the list into components with props.
- [State](./state.md) describes signals, memos and `$produce` in depth.
- [Async data](./async-data.md) loads data that streams in after the page.
