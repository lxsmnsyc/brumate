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

## On the server

The server renders the page once, so it waits for the values that the page needs:

- Markup outside every `#loading` block waits for the memos it reads. The page starts to stream after they settle.
- Markup inside a `#loading` block does not hold up the page. Its fallback goes out with the first render, and the content streams in when its values settle.

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

### One call for many keys

A list whose rows each load one thing, such as the profile of each player, makes one call per row. `batched` from `brumate/batch` turns the calls of one moment in the browser into one call with every key:

```ts
// profiles.ts
'use server';

export async function getProfiles(ids: string[]): Promise<Map<string, Profile>> {
  return new Map((await db.profiles(ids)).map((profile) => [profile.id, profile]));
}
```

```ts
// profile.ts, a plain module, since a 'use server' file exports only server functions
import { batched } from 'brumate/batch';
import { getProfiles } from './profiles.ts';

export const getProfile = batched(getProfiles, (found, id: string) => found.get(id) ?? null, {
  limit: 50,
});
```

```html
<!-- Row.brm: each row asks for one profile. -->
<script>
  const profile = $memo(getProfile(id));
</script>
```

- `batched(readMany, lookup, options)` gives a function of one key. The calls made before the next task, such as the rows of a list that the browser renders, become one call of `readMany` with every distinct key. Each call gets its value from `lookup`.
- `key` says what makes two keys the same, for keys that are objects. `limit` splits a large batch into several calls. `wait` gathers for that many milliseconds.
- A failed read rejects only the calls that it read for, and a `lookup` that throws rejects only the calls of its key.
- On the server, each call reads its own key at once. The server renders the rows of a list one after another, so their calls never happen at the same time, and calls of one key in a render still share one result. A page that renders many rows on the server reads faster with one call in the list, such as `$memo(getProfiles(ids))`, whose result it hands to the rows.
- `refresh(getProfiles)` does not load the memos that call `getProfile` again, since the compiler sees only `getProfile`. Refresh the memo of the list instead, or load the page again.
- A batched read runs a moment after it is called, outside the code that called it, so it cannot see the writes of a transaction around that code. Read many keys with one query there.

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
