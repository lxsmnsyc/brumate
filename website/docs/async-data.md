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
- On the client, a `#loading` body keeps its content while a new value loads. Use `$isPending` to show that it is loading again, or name the memo in the header to show the `#else` body again (see [below](#show-the-fallback-again)).

### Show the fallback again

Name memos in the header of `#loading` to show its `#else` body again while one of them loads:

```brm
<script>
  import { $memo, $signal } from 'brumate/signals';

  async function postsOf(user: number): Promise<string[]> {
    'use server';
    return [`Post of ${user}`];
  }

  let user = $signal(1);
  const posts = $memo(postsOf(user));
</script>

<button onClick=(() => user++)>Next user</button>
#loading (posts) {
  <ul>
    #for (post of posts) {
      <li>{post}</li>
    }
  </ul>
} #else {
  <p>Loading the posts…</p>
}
```

- Once the body has shown, the `#else` body shows while `posts` loads again. The cause can be a write of a value it reads, a server function that calls `refresh` for it, or a load that it starts. When the load ends, the body comes back with the same elements. Text typed in a field and the scroll of a list stay.
- The body stays in the page, hidden as a hidden [`#offscreen`](./control-flow.md#offscreen) body is. Its effects and `$client` callbacks stop, its `window` and `document` handlers do not run, and its `#portal` content hides. Updates still reach it.
- Each name is a memo of the component, or of a block script around the block, that markup in the body reads. Any other name is a compile error.
- The block also shows the fallback while a memo that the named one reads loads. With `const posts = $memo(postsOf(user.id))` and `user` a memo that loads, `#loading (posts)` holds while either loads. Name the last memo of a chain.
- Memos that the header does not name keep the content while they load, as without a header. Readers outside the body keep the old value, and `$isPending` is true for them.
- Put the control that changes a named memo's input outside the body. A hidden body loses the focus.
- A memo that a child component loads for itself is not held by the header of its parent. Give the child its own `#loading (memo)`, or pass the memo to it as a prop.
- A `$debounced` or `$throttled` memo is pending while it waits. A header that names it, or a memo that reads it, shows the fallback at each change of its value, and the compiler warns.

To show a new record with fresh state, such as a form for another user, wrap the block in `#key`. The body renders again for each ID, and the fallback shows while its memos load. A reload of the same ID keeps the content:

```brm
<script>
  import { $memo, $props } from 'brumate/signals';

  async function userOf(id: number): Promise<{ name: string }> {
    'use server';
    return { name: `User ${id}` };
  }

  const { id } = $props<{ id: number }>();
</script>

#key (id) {
  <script>
    const user = $memo(userOf(id));
  </script>
  #loading {
    <input value=(user.name)>
  } #else {
    <p>Loading…</p>
  }
}
```

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
- A `#reveal` inside a `#loading` body orders the bodies of that body. In markup that the browser renders, `#reveal` orders the `#loading` blocks that it renders, also those of the components inside it, in the same orders and with `collapsed`. A block that a later update adds inside it, such as a new row, is not ordered. `#defer` blocks inside it are not ordered.

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
- Pass several memos to ask about all of them at once. `$isPending(a, b)` is true while any of them loads, and false once none does. It means the same as `$isPending(a) || $isPending(b)`. To wait for all of them, use `await Promise.all([$resolve(a), $resolve(b)])`.

### Reads while a memo is pending

A memo that loads has no value until it arrives. A read never gives a promise or `undefined`. Code that needs the value waits for it with `$resolve`:

```ts
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

  ```ts
  $effect(() => {
    $resolve(user).then((profile) => send(profile.name));
  });
  ```

- When the component leaves the page while it waits, it rejects with an `AbortError`.
- When `$resolve` returns, another handler can already have changed the inputs again. Read what you need from the result, and expect that a later handler may run before your code after the `await`.

Without it, a plain read in a handler gives the last value, which can be stale while the memo loads again. `$isPending(memo)` is true then:

- A handler, a handler prop of a component and a `$client` callback that read a memo that has no value yet are a compile error, [BRM182](./errors.md#brm182), unless `$isPending` guards the read or the code waits with `await $resolve(memo)`. The compiler follows the functions of the same script that they call.
- A memo has no value yet when it is async (it awaits, or calls a server function) or reads such a memo, and the server did not wait for it. The server waits for a memo that markup reads outside `#loading`, and for one declared with `await $memo(…)`, so a read of those compiles. In a component that the browser renders, `await $memo(…)` in its script waits too (see [`await`](#await)). There, a `#loading` block shows its `#else` while a memo that its body waits for loads, as a streamed one does, and keeps its content on later updates. Outside every `#loading` block, a memo that loads, such as a memo of a promise prop (`$memo(user)`), is empty text, or an absent attribute, until its value arrives. In an app where a component that the browser renders waits at `await $memo(…)`, a block outside every `#loading` holds its new body until such memos settle instead, as the server does.
- These guards count: an earlier `if ($isPending(memo)) return;` (or `throw`, `continue`, `break`), also through `const waiting = $isPending(memo)`, a read inside `if (!$isPending(memo)) { … }` or in the `else` of `if ($isPending(memo))`, `$isPending(memo) ? … : read`, and `!$isPending(memo) && read`. A check of several memos, as `$isPending(a, b)`, guards a read of each memo it names. A check of a memo that reads the memo counts too, and so does an earlier `await $resolve(memo)` that always runs before the read in the same block (not one inside an `if`, a `&&` or a `try`).
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

## Promises in markup

A promise in text or in an attribute value renders the value that it settles to:

```brm
<script>
  async function getTitle(): Promise<string> {
    'use server';
    return 'Release notes';
  }
</script>

<h1 title=getTitle()>{Promise.resolve('hello world')}</h1>
```

A pending promise makes the nearest `#loading` pending, as a memo that loads does:

- Inside a `#loading`, the block shows its `#else` until the promise settles. The server streams the body then, and sends each element with its final attributes. Outside every `#loading`, the server waits for the promise before it sends that part.
- A `#loading` body whose text or attributes call code, such as `{format(user)}` or `title=getTitle()`, always streams from the server, since the call can give a promise. A body that only reads values can still render in place.
- In the browser, the boundary counts the promise as a wait: a `#loading` shows its `#else`, and outside every `#loading` the block keeps what it shows until the new body is ready, in a build whose browser renders wait at an `await $memo`. In other builds, the body shows at once and the value fills in when it settles.
- A spread follows the attribute rule: `{...{ title: getTitle() }}` writes `title` once it settles. A boolean attribute is there for `true` and gone for `false`, and `null` or `undefined` removes the attribute.
- On resume, the browser keeps the value that the server rendered and does not call the expression again. It calls it when a signal that it reads changes. An update keeps the text or the attribute until the new promise settles. When a newer promise replaces one that has not settled, the latest wins.
- A rejection goes to the nearest `#catch`, or the page error with none.

The browser waits for a value when the compiler sees that it can be a promise: an expression that calls code, or a prop typed as a promise, such as `const { user } = $props<{ user: Promise<User> }>()`. A plain read of a prop or a signal that holds a promise renders nothing in a render of the browser. Read it with `$memo(user)` or type the prop.

Markup does not wait in an event handler, the key of a `#for`, `ref` or `$bind`, which need the value at once. A promise that the compiler sees there is a compile error ([BRM188](./errors.md#brm188)). Otherwise the browser throws in development for a promise as a handler prop or a `#for` key, and production uses the value as it is.

To share one promise between several reads, or to show the old value and `$isPending` while it loads again, use a memo: `const title = $memo(getTitle())`.

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
- A component that the browser renders, such as in a branch of an `#if` that opens or in a new row of a `#for`, waits at `await $memo(…)` in its script too, and so does the script of a block body or of a `#for` row that the browser renders. The code before the `await` runs once. Outside every `#loading` block, the block holds its new body until the memo settles, as the server holds the page: a branch of an `#if` or `#switch`, a `#key` body, a `#client` body or the fallback of a `#for` keeps what it shows until then, and a new row shows nothing until then. A switch back during the wait drops the held body, unless the block switches to it again before it settles, which does not load again. The old body stays live until the swap, so the old body of a `#key` that reads the key takes the new key too. The script of a new body runs before the cleanups of the old one, and its effects and `$client` callbacks after them. A prop that changes during the wait loads the memo again, and the component renders with the value of the latest load. The loads of several `await $memo(…)` start where the server starts them, see below. A load that reads an awaited memo through a function or another memo starts after that memo's `await` in the browser.
- In the browser, a load that rejects, or a render after the `await` that throws, goes to the nearest `#try` that the server rendered, or to the `brumate:error` event on `window`. A `#try` that the browser renders does not catch it yet.
- `await name` of a memo, in a script, an insert, an attribute, a prop or a block header, waits for the memo in the render around it, and never shows a fallback for it. Outside every `#loading` body, the page waits. Inside a `#loading` body, the render around the block waits before it reaches the block: the page, or the body of a `#loading` around it. Inside a `#defer` body, the request for the body waits.
- In the browser, the value of a memo is settled when the code that reads it runs, so `await name` is a plain read. In markup that the browser renders, the render waits for the memos that the markup reads with `await` at the start of the markup, after the script, as a `#loading` body waits on the server. Code that the browser renders or updates, such as a branch of an `#if` that changes, can await nothing other than a memo. The compiler reports it in the same file.
- On the server, and in a render of the browser, each `await $memo(…)` starts its load as soon as the values it reads are ready, and still waits where it is written. The load starts right after the last statement before it that declares a name it reads, or that can change one: a write such as `q = x`, a call such as `params.set('a', '1')`, a name passed to a call, or a call of a local function that mentions the name. A plain read of the name does not hold the load. So in `const user = await $memo(a()); log('next'); const tags = await $memo(b())`, `b()` starts with `a()`. Its expression runs before the statements it does not depend on, and those statements still run once, in their order, after `user` settles. A guard such as `if (!user) throw redirect('/login')` does not hold a later load that reads nothing of `user`, and neither does a call of an imported function that changes state the load reads only through the module: make the load read a name that the statement changes, or read `user`.
- A run of `await $memo(…)` declarations, one after another, waits for all of them where the run ends: before the next statement, and before any markup. `$effect`, `$client`, imports and types do not end a run. A memo that reads another one waits for it by itself, so in `const a = await $memo(foo()); const b = await $memo(bar(a))`, `bar(a)` runs when `foo()` settles. A memo that reads a value computed from another one, such as `const id = a.id`, waits for that statement. When a memo fails, or its expression throws, the error comes where its `await` is written.

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
