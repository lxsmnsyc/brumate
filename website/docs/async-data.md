# Async data

A `$memo` can hold a promise, such as the result of a server function. The memo gives the value that the promise settles to, so markup and other memos never see the promise.

```brm live
<script>
  import { $isPending, $memo, $signal } from 'brumate/signals';

  async function search(query: string): Promise<string[]> {
    'use server';
    await new Promise((done) => setTimeout(done, 400));
    const fruits = ['apple', 'apricot', 'avocado', 'banana', 'blueberry', 'cherry'];
    return fruits.filter((fruit) => fruit.includes(query));
  }

  let query = $signal('');
  const results = $memo(search(query));
</script>

<label>
  Search
  <input value=query onInput=((event) => (query = event.currentTarget.value))>
</label>
#if ($isPending(results)) {
  <p>Searching…</p>
}
<ul>
  #for (result of results by result) {
    <li>{result}</li>
  }
</ul>
```

`search` is a [server function](./server-functions.md): it runs on the server, and the browser calls it over the network. Type in the field to see the old results stay while new ones load.

## Loading a value

Any expression that gives a promise works in a memo: a server function, `fetch`, or an imported async function.

```ts
const user = $memo(getUser(id));
const posts = $memo(fetch(`/api/posts?user=${id}`).then((response) => response.json()));
```

- A memo that reads a loading memo gets its value, never a promise. While the value loads, that memo waits too.
- `await` works in the expression: `$memo(await load(id))`.
- The type of the memo is the value, not the promise. `$memo(getUser(id))` has the type of the user.

## `await`

`await` says where the server waits instead of streaming. A read with `await` gives the value, never a promise and never a fallback:

```brm
<script>
  import { $memo, $props } from 'brumate/signals';
  import { fetchSettings, fetchUser, listTags } from './data.server';

  const { id } = $props<{ id: string }>();
  // The server waits here. A constant: it does not load again in the browser.
  const settings = await fetchSettings();
  // A memo that the page waits for. It loads again when `id` changes.
  const user = await $memo(fetchUser(id));
  // A memo that streams, unless an `await` reads it.
  const tags = $memo(listTags());
</script>

<p>{settings.theme}</p>
#loading {
  <!-- The page waits for the user. The tags can show the fallback. -->
  <h1>{user.name}</h1>
  <p>{tags.join(', ')}</p>
} #else {
  <p>Loading…</p>
}
```

- In a script, `await` of a promise works as in JavaScript. The script runs on the server only, so the value is a constant. A component whose script awaits a promise renders only on the server: the browser throws when it renders the component, such as inside a block of a parent that changes.
- `const name = await $memo(value)` declares a memo that the page waits for where it is declared. In the browser it is a memo like any other: it loads again when what it reads changes.
- `await name` of a memo, in a script, an insert, an attribute, a prop or a block header, waits for the memo in the render around it, and never shows a fallback for it. Outside every `#loading` body, the page waits. Inside a `#loading` body, the render around the block waits before it reaches the block: the page, or the body of a `#loading` around it. Inside a `#defer` body, the request for the body waits.
- In the browser, the value of a memo is settled when the code that reads it runs, so `await name` is a plain read. Code that the browser renders or updates, such as a branch of an `#if` that changes, can await nothing other than a memo. The compiler reports it in the same file.
- A run of `await $memo(…)` declarations, one after another, starts every memo of the run, then waits for all of them where the run ends: before the next statement, and before any markup. Independent memos load at the same time. Another statement ends the run, so code between two declarations sees the first memo settled, as it would in JavaScript. A memo that reads another one waits for it by itself, so in `const a = await $memo(foo()); const b = await $memo(bar(a))`, `bar(a)` runs when `foo()` settles. When a memo fails, the error comes where the run waits.

## On the server

The server renders the page once, so it waits for the values that the page needs:

- Markup outside every `#loading` block waits for the memos it reads. The page starts to stream after they settle.
- Markup inside a `#loading` block does not hold up the page. When the values that the body reads are ready as the block renders, the body renders in place. Otherwise the fallback goes out with the first render, and the body streams in when its values settle.
- A page that waits for every value it loads has one state record, and nothing streams after it.

### One call for the same arguments

While a page renders, calls of the same server function with the same arguments share one result. Two components that load `getUser(1)` make one call:

```ts
// Header.brm and Sidebar.brm, on one page
const user = $memo(getUser(id));
```

- It holds for the server functions of components and of `'use server'` files.
- Arguments are compared by value, as they would be sent, so `getUser({ id: 1 })` twice is one call.
- Each render starts with no results, so a new request loads fresh data.
- Calls from the browser, such as from a handler, always run. A function that changes something, such as `save(todo)`, runs each time it is called.

## `#loading`

`#loading` shows a fallback while the values that its body reads load:

```brm live
<script>
  import { $memo } from 'brumate/signals';

  async function quote(): Promise<string> {
    'use server';
    await new Promise((done) => setTimeout(done, 1500));
    return 'Ship less code to the browser.';
  }

  const text = $memo(quote());
</script>

<h2>Quote of the day</h2>
#loading {
  <blockquote>{text}</blockquote>
} #else {
  <p>Loading a quote…</p>
}
```

- The heading shows at once. The quote streams in after a second and a half.
- Without `#loading`, the whole page waits for the quote.
- When the values that the body reads are ready as the block renders, such as a value the page waited for with `await`, the body renders in place: no fallback, no swap. A body that renders a component, a dynamic tag, a template or a prop always streams, because those can wait on their own.
- On the client, a `#loading` body keeps its content while a new value loads. Use `$isPending` to show that it is loading again.

## On the client

When a value that the memo reads changes in the browser, the memo runs again:

- The page keeps the old value until the new one arrives, so content does not disappear while it loads.
- Only the latest run is written. When you type quickly, an older answer that arrives late is dropped.
- A newer run aborts the server function calls of the older one. A server function sees this on [the request](./server-functions.md#the-request), with `getEvent().request.signal`.
- If the promise rejects, the memo keeps its old value and the error is logged. Handle errors in the function when the page should show them, such as by returning `{ error }`.

## `$isPending`

`$isPending(memo)` is true while a new value of the memo loads on the client. It is also true while a memo that it reads loads.

```ts
const results = $memo(search(query));
const count = $memo(results.length);
// True while `results` loads, because `count` reads it.
const busy = $isPending(count);
```

- On the server it is always false, because the server waits for the value before it renders.
- Pass the memo itself, not an expression.

## Promises as props

A component can pass a promise to another component as a prop. The child loads it with a memo:

```brm live
<script>
  import { $signal } from 'brumate/signals';
  import Profile from './Profile.brm';

  async function getUser(id: number) {
    'use server';
    await new Promise((done) => setTimeout(done, 400));
    return { id, name: ['Ada', 'Grace', 'Alan'][id % 3] };
  }

  let id = $signal(0);
</script>

<button onClick=(() => id++)>Next user</button>
<Profile user=getUser(id) />
```

```brm live Profile.brm
<script>
  import { $isPending, $memo, $props } from 'brumate/signals';

  const { user } = $props<{ user: Promise<{ id: number; name: string }> }>();
  const profile = $memo(user);
</script>

<p class={ pending: $isPending(profile) }>User {profile.id}: {profile.name}</p>
```

When the parent passes a new promise, the child keeps the old value until it settles, and `$isPending(profile)` is true meanwhile.

## Streams

A server function can be an async generator. A memo of it takes each value as it arrives:

```brm live
<script>
  import { $isPending, $memo, $signal } from 'brumate/signals';

  async function* progress(steps: number) {
    'use server';
    for (let step = 1; step <= steps; step++) {
      await new Promise((done) => setTimeout(done, 300));
      yield `Step ${step} of ${steps}`;
    }
  }

  let steps = $signal(1);
  const status = $memo(progress(steps));
</script>

<button onClick=(() => (steps = 5))>Run five steps</button>
<p>{status}</p>
#if ($isPending(status)) {
  <p>Starting…</p>
}
```

- The memo is pending until the first value arrives, then shows each value in turn.
- A newer run of the memo stops reading the older stream.
- The server renders the first value only, because the page renders once.
- `$memo` gives the type of the values, so `status` above is a `string`.
