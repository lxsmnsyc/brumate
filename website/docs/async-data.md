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

## `#loading`

`#loading` renders its `#else` body first, and its own body once the values it reads have loaded. The rest of the page does not wait for them:

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
- When the values that the body reads are ready as the block renders, such as a value the page waited for with [`await`](#await), the body renders in place: no fallback, no swap. A body that renders a component, a dynamic tag, a template or a prop always streams, because those can wait on their own.
- On the client, a `#loading` body keeps its content while a new value loads. Use `$isPending` to show that it is loading again.

### When a value fails

A memo that fails inside a `#loading` body renders the nearest [`#catch`](./control-flow.md#try-and-catch), as it does when the page waits for the value. The `#try` can be in the body, around the block, or in a parent component. When the body fails after the page is sent, the server renders the `#catch` body and streams it in place of the `#try` body. In development the `#catch` gets the real error. In production it gets a generic one, and the server logs the real one. A `#try` that holds a `#loading` block or a component has markers in the page for this.

Without a `#try` around the block, the fallback stays, the server logs the error, and the page gets a `brumate:error` event on `window`.

### When the stream ends early

The browser can lose the connection before a `#loading` body arrives. After a client navigation, the page notices when the stream ends with a fallback still in place. The fallback stays, and the page gets a `brumate:error` event on `window` for each lost body, with the message `The page stopped loading before this part arrived`. No `#catch` renders, because the server is not asked again. A `#defer` block is not affected, since it waits for its trigger.

When the browser loads the page itself, it gives the page no event for a connection that dropped: Chromium leaves the document loading and fires neither `DOMContentLoaded` nor `load`. The fallbacks stay, and the browser shows that the page did not finish. A reload gets the whole page.

### Reveal order

`#loading` bodies show as their data arrives, in any order, so a page with several of them can jump around while it streams. `#reveal` shows them in an order:

```brm
#reveal ('sequential', collapsed) {
  #loading { <Profile /> } #else { <p>Loading the profile…</p> }
  #loading { <Posts /> } #else { <p>Loading the posts…</p> }
  #loading { <Friends /> } #else { <p>Loading the friends…</p> }
}
```

- `'sequential'`, the default, shows the bodies in the order of the markup. A body that is ready waits until every body before it shows.
- `'backwards'` shows them from the last to the first.
- `'together'` shows every body at once, when the last one is ready.
- `'natural'` shows each body when it is ready, as without `#reveal`.
- `collapsed`, with `'sequential'`, shows only the fallback of the next body to show. The others appear one at a time, as the body before each shows.
- The data of every body still loads at once. Only the showing waits, on the server, so it needs no code in the browser.
- A body that fails keeps its fallback and takes its turn, so the bodies after it still show.
- It orders the `#loading` blocks in its markup, and those of the components that it renders, such as a list of cards that each load their own data.
- A `#reveal` inside a `#loading` body orders the bodies of that body. Markup that the browser renders has no stream, so there `#reveal` renders its children as they are. `#defer` blocks inside it are not ordered.

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

### Reads while a memo is pending

A memo that loads has no value until it arrives. A read never gives a promise or `undefined`. Code that needs the value waits for it with `$resolve`:

```brm
async function save() {
  const profile = await $resolve(user);
  send(profile.name);
}
```

`$resolve(memo, { timeout, signal })` returns a promise of the value:

- It resolves at once when the memo has its value, and after the load when the memo loads its first value or loads again.
- When the inputs of the memo change while it waits, it waits for the load of the current inputs. A load that the change replaced never resolves it, so writing an input and then awaiting `$resolve` gives the result for the new input.
- It rejects with the error of the memo, when `timeout` milliseconds pass, or when `signal` aborts.
- Call it in a handler, an effect or a `$client` callback. It is a compile error where a memo computes or markup renders. It takes a memo only, not a signal.
- An effect callback cannot be `async`, so an effect uses `.then`:

  ```brm
  $effect(() => {
    $resolve(user).then((profile) => send(profile.name));
  });
  ```

- When the component leaves the page while it waits, it rejects with an `AbortError`.
- When `$resolve` returns, another handler can already have changed the inputs again. Read what you need from the result, and expect that a later handler may run before your code after the `await`.

Without it, a plain read in a handler gives the last value, which can be stale while the memo loads again. `$isPending(memo)` is true then:

- A handler, a handler prop of a component and a `$client` callback that read a memo that has no value yet are a compile error, [BRM182](./errors.md#brm182), unless `$isPending` guards the read or the code waits with `await $resolve(memo)`. The compiler follows the functions of the same script that they call.
- A memo has no value yet when it is async (it awaits, or calls a server function) or reads such a memo, and the server did not wait for it. The server waits for a memo that markup reads outside `#loading`, and for one declared with `await $memo(…)`, so a read of those compiles. In a component that the browser renders, `await $memo(…)` does not wait yet, and the read throws at run time.
- These guards count: an earlier `if ($isPending(memo)) return;` (or `throw`, `continue`, `break`), also through `const waiting = $isPending(memo)`, a read inside `if (!$isPending(memo)) { … }` or in the `else` of `if ($isPending(memo))`, `$isPending(memo) ? … : read`, and `!$isPending(memo) && read`. A check of a memo that reads the memo counts too, and so does an earlier `await $resolve(memo)` that always runs before the read in the same block (not one inside an `if`, a `&&` or a `try`).
- A read that the compiler cannot follow, such as a function that a parent passes as a prop, an imported helper or code after an `await`, throws an error at run time when the value is still loading. It goes to the nearest [`#try`](./control-flow.md#try-and-catch) like other handler errors, and the message points to `$resolve`.
- A prop that the parent passes as a promise, and a promise that the server streams in a signal, have no value until they settle, so they follow the same rule. A promise that code in the browser writes into a signal is an ordinary value.
- An [effect](./effects.md#effect) that reads such a value skips that run, and runs again when the value arrives.

## On the client

When a value that the memo reads changes in the browser, the memo runs again:

- The page keeps the old value until the new one arrives, so content does not disappear while it loads.
- Only the latest run is written. When you type quickly, an older answer that arrives late is dropped.
- A newer run aborts the server function calls of the older one. A server function sees this on [the request](./server-functions.md#the-request), with `getEvent().signal`.
- If the promise rejects, the memo holds the error until it computes again, and each read of it throws. A `#try` around the read renders its `#catch` body, and code that does not read the memo runs as usual. See [Errors in the browser](./effects.md#errors-in-the-browser). The function can also return `{ error }` when the page should show the failure as a value.

## Waiting for a pause

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

## Loading again

A memo that calls a server function loads again when the values it reads change. When another server function changes the data, call `event.refresh` with the function that reads it. Every memo on the page that calls that function loads again.

```brm live
<script module>
  // Kept in memory for the sample. A real app would use a database.
  const names: string[] = ['Ada'];
</script>

<script>
  import { $memo, $signal } from 'brumate/signals';
  import { getEvent } from 'brumate/server';

  async function list() {
    'use server';
    return [...names];
  }

  async function add(name: string) {
    'use server';
    names.push(name);
    getEvent().refresh(list);
  }

  const people = $memo(list());
  let draft = $signal('');
</script>

<input aria-label="Name" value=draft onInput=((event) => (draft = event.currentTarget.value))>
<button onClick=(() => add(draft))>Add</button>
<ul>
  #for (person of people by person) {
    <li>{person}</li>
  }
</ul>
```

- `event.refresh` takes a server function of the same component, or a function of a `'use server'` file.
- The memos load again in every component on the page that calls the function.

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

The prop itself stays a promise, as its type says. The child can `await user`, call `user.then(…)` or pass it on to another component, in markup, a handler, an effect or a `$client` callback, before and after it settles. Read it with `$memo(user)` when you want its value in markup, pending until it settles.

Because the prop does not change when the promise settles:

- An effect that reads the prop does not run again then. It runs when its other dependencies change, or it awaits the promise itself.
- `$isPending(user)` is false. Use `$isPending(profile)` of the memo `profile = $memo(user)`.
- If the promise rejects, `await user` rejects in the child, and a read of `$memo(user)` throws into the nearest `#try`. A rejection that nothing reads is not reported.

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

### Lists that grow

`gather` from `brumate/stream` turns a stream into the list of its values so far, such as the tokens of a reply, search results or log lines. A memo of it renders with `#for`:

```brm
<script>
  import { $memo, $signal } from 'brumate/signals';
  import { gather } from 'brumate/stream';
  import { reply } from '../chat.ts';

  let prompt = $signal('');
  const tokens = $memo(gather(reply(prompt), { key: (token) => token.id }));
</script>

<ol>
  #for (token of tokens by token.id) {
    <li>{token.text}</li>
  } #else {
    <li>Ask something</li>
  }
</ol>
```

- The list starts empty, and grows by one item for each value of the stream.
- `key` puts a value with a key that came before in place of its item, so a stream can update an item.
- A new stream, such as for a new prompt, starts the list again, and the memo stops reading the older stream.
- The empty list comes before the stream is read. The server renders the first value of a memo, so it renders the empty list and never starts the stream. The list fills in the browser, when the memo runs there, such as after the prompt changes.

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

### Pages for readers without scripts

A `#loading` body streams in a `<template>` that a script swaps in. A reader that runs no scripts, such as a crawler, would keep the fallback. For such a reader, the server renders every `#loading` and `#defer` body in place, in the order of the page: it waits for each body and writes it where the block is, with no `<template>` and no swap. The page arrives later, and complete, and resumes as it does when it streams.

- `inOrder` in the options of `handle`, `render` or `renderToStream` decides. `'bots'`, the default, does it for requests whose `User-Agent` is a known crawler or link preview. `true` does it for every request, `false` for none, and a function of the request decides for each.
- A `#defer` body renders with the page, since a crawler does not fire its trigger.
- A body that fails renders the nearest `#catch` in place of the `#try` body, as a page that does not stream does.
- A `#client` body has no server markup, so a crawler sees its `#else` body.

## `#defer`

`#defer` renders its body on the server later, in a request of its own. The page has the `#else` body until the trigger fires, with the same triggers as [`#client`](./effects.md#client-blocks). The browser then asks the server for the body, which replaces the fallback:

```brm
#defer ('visible') {
  <Recommendations {user} />
} #else {
  <p>Loading recommendations…</p>
}
```

Use it for markup that the server renders but that the first response does not need, such as content far below the fold, or the parts of a cached page that depend on the user.

- The body renders on the server, with the same route, request, cookies and values as the page. It can call server functions and read the database.
- The request goes to the URL of the page, so middleware runs for it as it does for the page. The answer has `vary: x-brumate-defer`, and so does the page.
- The server renders the route again for the request, up to the block. It renders the `#loading` and `#defer` bodies around the block, without sending them, and no other body. Data that the page loads before the block loads again. Data that only the body needs is not loaded for the page: put it in the body, such as in a component inside it.
- If the page's data changed since it loaded, and the block is not where the browser has it, the fallback stays.
- Without scripts, the fallback stays. A prerendered page needs a server for the request.
- A `#defer` block can be inside a `#loading` or `#defer` body. It cannot be inside a `#client` body, or in markup that the browser renders, such as a branch of an `#if` that changes. The compiler reports it in the same file.
- A component with a `#defer` block that the browser renders, such as inside the `#client` body of its parent, keeps the fallback. The compiler cannot see this across files.

`#client` renders its body in the browser, for markup that needs the browser. `#defer` renders it on the server, for markup that needs the server.
