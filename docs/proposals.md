# Proposals

Features that would be good to add, with the reason for each, a sketch, and a rough cost. None of them is decided. [Decisions](./decisions.md) lists what is.

## Summary

Middleware entry, request locals and timing helpers shipped in 0.2.0. These shipped after it, so they are no longer here:

- Handlers from scripts (`$handler`) and progressive forms (`brumate/forms`).
- Two-way binding (`$bind`) and view transitions of handlers (`transition`).
- Caching (`cache`, `cached` and `revalidate`), the serial entry (`src/serial.ts`), forms that run once (`idempotent`), and prerendered pages with their `#defer` bodies in one response (`shell`).
- The reveal order of `#loading` bodies (`#reveal`), and lists that grow from a stream (`gather`).

| Proposal                                                              | Area     | Value  | Cost   |
| --------------------------------------------------------------------- | -------- | ------ | ------ |
| [Idempotent calls](#idempotent-calls)                                 | Server   | Low    | Small  |
| [Two-way realtime](#two-way-realtime)                                 | Server   | Medium | Medium |
| [Embedding in other sites](#embedding-in-other-sites)                 | Build    | Medium | Medium |
| [Named view transitions](#named-view-transitions)                     | Syntax   | Low    | Small  |
| [Long lists](#long-lists)                                             | Syntax   | Medium | Medium |
| [Streaming lists](#streaming-lists)                                   | Syntax   | Low    | Medium |
| [Styles in blocks](#styles-in-blocks)                                 | Syntax   | Medium | Medium |
| [Reveal order of `#defer` blocks](#reveal-order-of-defer-blocks)      | Syntax   | Low    | Small  |
| [Server components](#server-components)                               | Syntax   | High   | Large  |
| [Devtools](#devtools)                                                 | Tooling  | High   | Medium |
| [Component workbench](#component-workbench)                           | Tooling  | Medium | Medium |
| [Agent support](#agent-support)                                       | Tooling  | High   | Medium |
| [Worker functions](#worker-functions)                                 | Runtime  | Medium | Medium |
| [Offline pages](#offline-pages)                                       | Runtime  | Medium | Medium |
| [Observability](#observability)                                       | Runtime  | Medium | Medium |
| [Ordered updates](#ordered-updates)                                   | Runtime  | Medium | Medium |
| [Content mappers for TypeScript 7](#content-mappers-for-typescript-7) | Tooling  | High   | Medium |
| [Headless UI components](#headless-ui-components)                     | Library  | High   | Large  |
| [Markdown with components](#markdown-with-components)                 | Library  | Medium | Medium |
| [Internationalization](#internationalization)                         | Library  | High   | Large  |
| [Images](#images)                                                     | Build    | Medium | Medium |
| [State in the URL](#state-in-the-url)                                 | Routing  | High   | Small  |
| [A smaller and faster client](#a-smaller-and-faster-client)           | Compiler | High   | Large  |

## Syntax

### Named view transitions

`transition` of `brumate/events` runs a handler inside a view transition. An element animates on its own only when it has a `view-transition-name`, which the author writes by hand and keeps unique, such as ``style=(`view-transition-name: todo-${todo.id}`)`` in a `#for`. Every named element then takes part in every view transition of the page, including navigations.

```html
#for (todo of todos by todo.id) {
  <li viewTransition="todo">{todo.title}</li>
}
#if (open) {
  <div class="panel" viewTransition="panel">…</div>
}
```

```css
::view-transition-group(.todo) { animation-duration: 200ms; }
::view-transition-new(.todo):only-child { animation: fade-in 150ms; }
::view-transition-old(.todo):only-child { animation: fade-out 150ms; }
```

- `viewTransition="todo"` marks an element. It renders as an attribute, and the element gets `view-transition-class: todo`.
- The core names a marked element only while a transition of brumate runs: before the browser captures the old page, and again after the updates for the elements that they added. It removes the names when the transition finishes.
- The name comes from the element itself, such as `todo-7`, not from the key of `by`. A key can be any value, such as an object, and two keys such as `1` and `'1'` would give one name. Keyed lists keep the element of an item, so an element that moves keeps its name and slides. A new element fades in, and a removed one fades out.
- `viewTransitionName=(expression)` gives a name of the author, which pairs two different elements, such as a picture on a list page and on its detail page. A navigation needs it, because the new page has new elements. Elements of layouts that stay keep their names.
- Only marked elements near the viewport get a name, because each named element is a capture of its own. An element that comes from far off screen fades in instead of sliding.
- In development, two rendered elements with the same name of the author are an error in the Errors tab, since the browser skips such a transition without one.
- A name that the CSS of the author gives an element stays.

Limits:

- A named element inside another one animates in a flat group, so the order of painting can be wrong while it runs, until browsers support `view-transition-group: contain`.
- The writes of a handler after its first `await` change the page without an animation, as with `transition` now.

Test first that the names reach elements that an update inserted after its code loaded, and how fast a list of 200 items reorders in Chrome and Safari.

Build it when an app animates lists or shared elements. The manual names work until then, and the UI components animate overlays with CSS and `Transition`.

Cost: about 2 to 3 days. The compiler only renders the attribute.

### Long lists

A long list renders every item on the server and in the browser. A windowed list renders only the items in view, and the browser renders the rest as the user scrolls.

```html
#for (row of rows by row.id) window(48) {
  <tr>…</tr>
}
```

- `window(height)` gives the height of an item, so the list knows which items are in view. The server renders the first items and a spacer for the rest, so the page has the right height and the first items show without scripts.
- The browser renders the items that come into view from the render module, and removes those that leave. Items keep their scopes while they are in the list, so state inside them stays.
- Items of different heights measure themselves once rendered.
- The `Virtualizer` of the UI components, in phase 6, becomes this block.

Cost: about 2 weeks, most of it for scrolling, focus and the items of different heights.

### Streaming lists

`gather` from `brumate/stream` gives the list of the values of a stream so far, which a memo renders with `#for` as it grows in the browser. The server renders the empty list, because it reads only the first value of a memo.

- `#for await (item of stream) { … } #else { … }` would be the same without the memo, and the server would stream the items of a stream that starts with the page, as `#loading` bodies stream, with the browser reading on from there.

Cost: about 1 to 2 weeks for the server part, when a page needs a stream that starts with it. Handing the stream from the server to the browser without reading it twice is most of it.

### Styles in blocks

A block body can start with a `<script>`, which declares values for each instance of the body. A `<style>` could live in a block body too, scoped as the `let` of a block script is:

```brm
#for (tag of tags by tag.id) {
  <script>
    let hovered = $signal(false);
  </script>
  <span class="tag" onPointerEnter=(() => (hovered = true))>{tag.name}</span>
  <style>
    .tag {
      background: ${tag.color};
      outline: ${hovered ? '2px solid' : 'none'};
    }
  </style>
}
```

Today `${}` in a `<style>` reads only values of the component, and its custom properties are set on the top-level elements of the component. Values for each item of a `#for` need inline `style` attributes, or a component of their own.

Scope, as for `let`:

- A style in a block matches the elements of the block and of the blocks inside it. It reaches nothing outside the block: not the other markup of the component, and not a block next to it.
- The `<style>` of the component is the outer scope, and its rules match the elements of every block, as now.
- When an outer and an inner style both match an element, both apply, as CSS does. The compiler writes the rules of an inner block after those of the outer ones, so the inner rule wins at the same specificity.
- `${}` reads what is in scope where the style is: the values of the block script, of the blocks around it, and of the component.
- Children that the block inserts belong to the component that wrote them, so a style in the block does not reach them. The markup of a `#template` is a block of its own.

The compile:

- Each block with a style gets an attribute of scope, such as `s-<hash>-2`, on its elements and on the elements of the blocks inside it. Its selectors get that attribute, as the selectors of the component get `s-<hash>`.
- The custom properties of `${}` go on the top-level elements of each instance of the block, as they go on the top-level elements of a component now. A change sets them on the elements of that instance.
- The styles of the blocks join the stylesheet of the component, so it still loads once per page.
- A style in a block cannot hold `:global(…)`. A global rule reads as if it applied while the block shows, and it would not. Global rules stay in the `<style>` of the component.
- A `<style>` in markup is an error today, so nothing that works now changes.

A style in an `#if` matches only the elements of its branch, which exist only while the branch shows. So the CSS needs no condition of its own.

Cost: about a week: the attribute of scope and its selectors, variables for each instance of a block, and the docs, as "A style in a block" next to "A script in a block".

### Reveal order of `#defer` blocks

`#reveal` orders the `#loading` bodies that stream from the server. `#defer` blocks inside it show when each body arrives.

- The module that loads `#defer` bodies would wait to put a body in until the ones before it are in, in the order of the `#reveal` around them.

Cost: a day or two, when a page needs it.

### Server components

A server component renders on the server, also when the browser needs it again. The browser sends its inputs and gets new HTML, so it has no render code and no data for it. React Server Components work this way.

Brumate already has much of what React gets from them:

- An instance script runs only on the server, and markup that never changes ships no code.
- `#defer` bodies, server functions and memos read the database on the server.
- `#defer` asks the server for its body, and the answer holds HTML and state records.

What is missing is a render on the server when inputs change in the browser. Today, markup that the browser renders again needs its render code and its data in the browser. A server component would add:

- Code that stays on the server, such as a Markdown renderer, a syntax highlighter, translation catalogs, or a module with secrets.
- A smaller page state, since the values that the component reads on the server are not serialized.
- A plain `await` anywhere in its script, since the browser never renders it.

#### A server component

A file marks the component as one that renders on the server. `<script server>` stands for the mark here, which is to choose:

```brm
<!-- Profile.brm -->
<script server>
  import { $props } from 'brumate/signals';
  import { getUser } from '../db.ts';

  const { userId, children } = $props<{ userId: string; children?: unknown }>();
  const user = await getUser(userId);
</script>

<section class="profile">
  <h2>{user.name}</h2>
  {children}
</section>
```

```brm
<!-- A component that renders it -->
<Profile userId=selected>
  <Counter />
  <input value=$bind(note)>
</Profile>
```

- Its props are its inputs. When a prop changes in the browser, the browser asks the server for a new render.
- Props must be values that brumate can send, as the arguments of server functions are. A function prop must be a server function.
- `getUser` and the modules that only server components import never reach the browser.
- Markup in it can be interactive, with handlers and state, as a `#defer` body can.

#### `#server`

`#server` is a server component written inline, without children:

```brm
#server {
  <script>
    const data = await getUser(userId);
  </script>
  <UserProfile {data} />
}
```

- It is a block like the others: no element of its own, and markers around its range.
- Its inputs are the values from outside the block that the body reads, such as `userId`. The compiler finds them as it finds what an insert reads, so the header lists none. A value that the body computes, such as `data`, is not an input.
- A body that reads nothing from outside renders once, as markup without the block does.
- The header can hold a trigger, as `#defer ('visible')` does, or a debounce for inputs that change on each key.

#### A render again

1. On the first render, the server renders everything, as it does now, and the page resumes as usual.
2. When an input changes, the browser sends the inputs, as a call of a server function sends its arguments. That reuses the serialization, the check of the origin and rate limits.
3. The server renders the component alone, with the inputs and the values of the contexts that it reads. It does not render the route up to it, as `#defer` does, so the data of the page does not load again.
4. The answer has the HTML and the state records of the new render.
5. The browser replaces the range, disposes the scopes of the old render, and indexes the new markup, as for `#defer` and navigation.

`refresh(fn)` in a server function loads the memos that read `fn` again. It can also ask again for each server component whose last render called `fn`, so a form that changes the user updates `Profile` with no code in the browser.

#### Children

A component in the browser passes children to a server component, and the server component puts them in place. The children stay interactive, and keep their state, when the server component renders again.

Children already belong to the component that writes them: their scope has that component as its parent (`from`), and an export of their own renders them. So the server never renders them again, and only says where they go:

- On a render again, the browser sends a token for each children value that it holds.
- Where the server component inserts `children`, the server writes a hole, such as `<!--k1-->`, in place of their markup.
- The browser takes the range of each child out of the page by its markers, puts the new HTML in, and moves each range into its hole. `Element.moveBefore()` keeps focus and the state of iframes, where the browser has it.
- Disposing the old render skips the scopes of the children, so `Counter` keeps its count and the input keeps its text.
- Children that the new render does not insert are disposed, as when an `#if` closes. Children that it inserts twice render again for the second place, with their export, as children do now.
- A server component inside the children of another one belongs to the caller. The outer render keeps it, and it renders again on its own.

Children read the contexts where they are inserted, which is inside the server component. When a render provides a context with another value, such as the user that it loaded, the children must update without rendering again. The answer carries the new values that the server component provides, and the browser writes them, so the readers of the children update as for any change of a context. The state record lists the contexts that each scope reads, in `x`, so the server knows what to send.

#### To decide in a spike

- The state inside the server component, other than children, starts over on each render: focus, the text of fields and what is open. Brumate could morph the DOM, or keep keyed parts, as children are kept.
- Each change is a request, so it suits changes of single events, such as a search, a filter or a preview, more than each key of an input.
- Server functions, memos and `refresh` cover the data already. The spike measures what a server component saves in code and in size against them, for two cases of the website: a preview of Markdown or code, which needs the highlighter in the browser today, and a list with a filter.
- The children work leans on `from`, `t`, `f` and the exports of children. The spike covers nested children and children that a component passes on.
- Whether a static block of the server can drop its markers and scope IDs, when it never renders again.

Cost: a spike of about a week, then the design.

## Reactivity

### Ordered updates

A write runs the updates that read its slot at once, in the order of the `g` table of the module. Memos run before bindings, and a memo comes after the memos it reads, because it is declared after them. Three cases follow, which the tests under "updates of a signal and a memo of it" in `test/resume.test.ts` show:

- A memo that reads a signal and a memo of that signal computes twice, once for each.
- A binding that reads a signal and a memo of it runs twice.
- A child that gets both as props gets one before the other. The memo of the parent runs first, so its prop reaches the child first, and a memo of the child computes with the new value of one prop and the old value of the other.

The first two only waste work. The third is a real error. A child that reads `letters[last]` reads past the end of the old list when the list grows, throws, and the update stops, so the page keeps the old text. A memo that calls a server function would also send a call with old inputs.

The graph is known at compile time, so the order can be too:

- The compiler ranks the memos of a component by a topological sort of the graph. For each slot, `g` lists every memo downstream of it in that order, then the bindings, each once.
- A write runs those memos in order. A memo computes only when a slot it reads changed in this pass, and its write triggers nothing, because the list already holds its readers.
- Bindings wait in a queue, keyed by scope and update, as effects do now. The queue runs when the outermost update ends, and effects run after it.
- Memos stay eager, so a handler that writes `count` and then reads `double` still reads the new value.
- A prop update writes the slot of the child and waits to trigger it until the pass of the parent ends, so the child computes once, with every new prop.

To check:

- A `$bind` write from a child into its parent starts a pass of its own.
- Async memos, values the server streams and `$optimistic` guesses write later, and start passes of their own.
- The size of the core, and of the `g` tables with the memo lists.

#### Batching

Today each write is a pass of its own. `run` runs the updates of the write at once, and effects wait only until that write ends, since `running` goes back to 0 after it. A handler that writes `first = 'Ada'; last = 'Lovelace'` makes two passes:

- A binding such as `{first} {last}` writes the DOM twice, once with the new first name and the old last name.
- An effect that reads both runs twice.
- A state between the writes can throw. `{total / count}` can divide by zero, and the body of `#if (items.length)` that reads `items[index]` can read past the end.

A pass would be the outermost unit of code that runs at once, not a single write:

- A handler, a `$client` callback, a run of effects, or a value that settles, such as an async memo, a value that the server streams, or an `$optimistic` guess. The core already starts each of them, as `handle()` starts a handler.
- In a pass, writes mark their slots. Memos stay eager, so a handler that writes `count` and then reads `double` reads the new value.
- Bindings wait in the queue of ordered updates, once each, and run in the order of the graph when the pass ends. Effects run after them.
- A handler that awaits is a pass up to its first `await`, and each part after an `await` is a pass of its own. So nothing depends on when microtasks run.
- A `$bind` write from a child, in the same handler, joins the pass of the parent.
- `flush()` from `brumate/signals` runs the waiting bindings at once, for a handler that opens an `#if` and must focus or measure what it rendered.

Batching on microtasks, as Vue and Svelte 5 do, would batch across `await` too. But every handler that writes and then reads the DOM would need `await tick()`, and the parts of `@brumate/ui` focus and measure right after they open things. A pass for each unit of code keeps the DOM written when the handler returns.

To check:

- The handlers of `@brumate/ui` that write and then read the DOM before they return. Each one needs `flush()`, or does that work in a `$client` callback or an effect already.
- A test for each case above: one DOM write for two writes in a handler, one run of an effect that reads both, no throw from a state between writes, and `flush()`.

The tests mark each case with `it.fails`. The fix turns them into `it`.

Cost: a few days for the order, and a day or two more for batching, since it uses the queue of bindings that the order adds. The change is a pass in the compiler that ranks memos, the `table` of the client codegen, and `run`, `memo`, `writeSlot` and `handle` of the core.

## Data

### Worker functions

Heavy work, such as parsing a large file, building a search index or processing an image, blocks the page when it runs in a handler. A worker function runs in a Web Worker, and returns a channel, as a socket function does:

```ts
// search.worker.ts
import { createChannel } from 'brumate/channel';
import type { Channel } from 'brumate/channel';

export function search(documents: Document[], client: Channel<{ progress(done: number): void }>) {
  'use worker';
  const index = createIndex(documents, (done) => client.run('progress', done));
  return createChannel({
    query(text: string) {
      return index.query(text);
    },
    add(document: Document) {
      index.add(document);
    },
  });
}
```

```ts
const worker = await search(documents, createChannel({ progress: (done) => (loaded = done) }));
const results = await worker.run('query', 'resume');
worker.close();
```

- The browser calls a worker function as a server function, and gets a promise of its channel. The index stays in the worker between calls, and `run` calls into it.
- Closing the channel that it returned, from either end, ends the worker. The worker can close it to stop itself, such as when its work is done. A worker function that returns a plain value, not a channel, ends its worker when it returns.
- The worker loads on the first call, with only the code of its functions.
- The channel is the one of [two-way realtime](#two-way-realtime), over `postMessage` in place of a connection, with the same serializer, so the worker can report its progress through a channel of the browser.
- On the server, a worker function runs in place, or in a worker thread with an option.

Cost: about 1 to 2 weeks, after the channels of two-way realtime. Without them, a few days for calls with values only.

### Offline pages

A resumed page needs the network only for the parts that its handlers load. The idle preload already knows which parts a page can reach.

Note, 2026-10-25: the page's code now loads when it starts, in one bundle per root component. `prefetch` and the `preload` option were removed.

- A generated service worker caches the page, the loader, the core and those parts, so a page that was loaded once works offline, and its handlers run.
- A server function call made offline waits in a queue with an option, and goes when the connection comes back. Its result settles the same promise.
- `$online` is a signal of the connection, for a page that shows that it is offline.
- A page that was never loaded shows the offline page of the app.

Cost: about 2 weeks, most of it for updates of the service worker and for which calls are safe to queue.

### Observability

The benchmarks measure renders and loads, but an app cannot see them.

- On the server, `onTrace(span)` receives the time of each render, each memo load, each server function call and each `#defer` request, with the component and the route. A small adapter turns them into OpenTelemetry spans.
- In the browser, `onTrace` receives the time from an event to its handler, split into the parts it loaded and the run, so a slow first click shows where its time went.
- The traces are off unless the option is set, and cost nothing then.

Cost: about 1 week.

## Routing

### State in the URL

A filter, a tab or a page of results belongs in the URL, so it survives a reload and can be shared. `$route().search` reads the query string, but it cannot write it, and a change of the query string asks the server for the page again (`navigation.md`). Each change of a filter costs a request.

`$searchParam(name, options)` from `brumate/signals` gives a signal bound to one parameter of the query string:

```brm
<script>
  import { $searchParam } from 'brumate/signals';

  let query = $searchParam('q', { default: '' });
  let page = $searchParam('page', { default: 1, parse: Number });
</script>

<input type="search" value=$bind(query)>
<p>Page {page}</p>
```

- On the server it reads the URL of the request, so the first render shows the right state, with no flash.
- In the browser a write updates the URL with `history.replaceState`, or `pushState` with `{ history: 'push' }`, and does not ask the server. The updates run in the browser, as for any signal.
- Back and forward write the signal from the URL.
- `parse` and `serialize` convert other types than strings. A value equal to `default` leaves the parameter out of the URL.
- `{ server: true }` keeps the request: a write navigates, so the server renders the page with the new value, as a change of the query string does now. It suits a parameter that the server needs, such as a page of results that a `#defer` body reads.
- Two writes in one handler make one change of the URL, with the batching of ordered updates.
- `$route().search` reads the parameters that `$searchParam` writes.

It is like `nuqs` in React or the shallow routing of SvelteKit, with no hydration to read the URL first.

Cost: a few days.

## Server

### Idempotent calls

`idempotent(fn)` makes forms that run once for each render: a second post of the same form gets the first result. Calls from the browser, such as from a handler, have no key yet, because nothing sends a call again.

- When the offline queue or a reconnect sends calls again, the browser sends a key with each call, and the same key when it sends that call again. The server already keeps the result of a key.

Cost: a day, with the first feature that sends calls again.

### Two-way realtime

Server functions can stream values to the browser, which covers updates that only go one way, such as an activity feed. Chat, presence and shared editing need calls both ways, on one connection.

A socket function is a server function that keeps a connection open. What it returns is a channel: an object of functions that stay on the server, which the browser calls by name.

```ts
// chat.server.ts
import { createChannel } from 'brumate/channel';
import type { Channel } from 'brumate/channel';
import { getSocket } from 'brumate/server';

export async function room(name: string, client: Channel<{ message(message: Message): void }>) {
  'use socket';
  const user = currentUser();
  // A call of the browser's channel, over the connection.
  const leave = rooms.join(name, (message) => client.run('message', message));
  return createChannel(
    {
      send(text: string) {
        rooms.post(name, { user, text });
      },
      history(): Promise<Message[]> {
        return rooms.history(name);
      },
    },
    // The channel ends from either side, or with the connection.
    { onClose: leave },
  );
}
```

```brm
<script>
  import { $client, $signal } from 'brumate/signals';
  import { createChannel } from 'brumate/channel';
  import { prevent } from 'brumate/events';
  import { room } from './chat.server';

  let messages = $signal<Message[]>([]);
  let draft = $signal('');
  let chat = $signal<Awaited<ReturnType<typeof room>>>();

  $client(() => {
    const open = room(
      'general',
      createChannel({ message: (message: Message) => (messages = [...messages, message]) }),
    );
    void open.then(async (channel) => {
      chat = channel;
      messages = await channel.run('history');
    });
    return () => void open.then((channel) => channel.close());
  });
</script>

#for (message of messages by message.id) {
  <p><b>{message.user}</b> {message.text}</p>
}
<form onSubmit=(prevent(() => {
  void chat?.run('send', draft);
  draft = '';
}))>
  <input value=$bind(draft)>
</form>
```

#### Channels

`createChannel(functions)` from `brumate/channel` makes a channel of an object of functions, on the server, in the browser and in a worker. The side that makes it keeps the functions. The other side gets a `Channel` that calls them by name:

```ts
interface Channel<T extends Record<string, (...args: never[]) => unknown>> {
  /** Calls a function of the other side, and settles with its result. */
  run<K extends keyof T & string>(
    name: K,
    ...args: Parameters<T[K]>
  ): Promise<Awaited<ReturnType<T[K]>>>;
  /** Ends the channel for both of its ends. Calls in flight and later calls reject. */
  close(): void;
  /** Settles when the channel ends, from either side, or from the connection. */
  readonly closed: Promise<void>;
}
```

- The types come from the object that the other side passed to `createChannel`. A wrong name, a wrong argument or a missing one is a type error, and the result has the type of the function's result, in a promise.
- `run` and `close` are the methods of the channel, not of the object, so a function can be called `close` or `run` without a clash.
- A call sends its arguments over the connection, runs the function, and settles with its result. A call that throws rejects with the error's name and message, as a call of a server function does.
- Arguments and results go through the serializer of server functions: values, promises, and async iterables that stream. A channel in an argument or a result is a channel on the other side too, so a function can hand out another channel, such as one for each document that a user opens.
- A side can call only the functions of a channel that the other side gave it. A channel has an ID on its connection, which means nothing on another one, so there is no route to guess.
- Calls on one channel arrive in the order they were made.
- `createChannel` returns a `Channel` too, whose `run` calls the functions in place. Sent to the other side, it is a channel that calls them over the connection.

#### Ending a channel

A channel has two ends: the owner, which made it with `createChannel` and keeps the functions, and the holder, which calls them. Either end can close it:

- The holder closes it with `close()` when it is done, such as a browser that leaves a chat, or a server that stops sending to a browser.
- The owner closes it with `close()` of the channel that `createChannel` returned, to revoke it, such as a server that removes a user from a room.
- `createChannel(functions, { onClose })` tells the owner when the channel ends, from either end or with the connection. That is where it cleans up, such as leaving the room.
- On both ends, `closed` settles, and calls in flight and later calls reject.
- A channel that its holder drops, such as one that is garbage collected, closes as if the holder had closed it.

The channel that a socket or worker function returns is the root of its connection. Closing it, from either end, closes the connection, and with it every other channel on it. Closing another channel ends only that channel.

Both sides use the same `Channel`: the browser calls the server's with `chat.run('send', text)`, and the server calls the browser's with `client.run('message', message)`.

#### The connection

- The socket function runs with the event of the request that opened the connection, so it knows the user and the cookies, and middleware runs for it. `getSocket()` gives `onClose` and `close` of the connection.
- The browser opens the connection when client code calls the socket function, not with the page, so a page that never calls it loads nothing.
- The arguments of a call can have a schema, as the arguments of a server function can, and rate limits apply to each call.
- Closing the root channel, from either end, ends the connection, as does `getSocket().close()` on the server.
- When the connection drops, a `reconnect` option calls the socket function again with the same arguments, and the channels that the browser holds go on with the new connection. Calls go by name, so a channel needs nothing of the old connection, and a component keeps the channel it has. Calls in flight when it dropped reject.
- On the server, while a page renders, a call of a socket function calls it directly, with channels that call the functions in place. A component can render its first value without a connection.
- The transport is WebSocket, with a fallback to the stream that server functions already use and a `POST` for each call. With Nitro, the WebSocket side uses its crossws support, which runs on Node, Bun, Deno and Cloudflare. A server of the app's own passes the upgrade to a handler that brumate exports.

Prior art: Cap'n Web, from Cloudflare, passes functions by reference as stubs over WebSocket and HTTP. A channel calls by name instead, so it keeps its types without a proxy, and it survives a reconnection.

Cost: about 3 weeks. The serializer and the call protocol of server functions exist. Most of the work is the channels on both sides, their release, reconnection, the fallback and the WebSocket handler for Nitro and for a server of the app's own.

## Tooling

### Content mappers for TypeScript 7

TypeScript 7 does not load plugins, so `.brm` files get types only from TypeScript 6 and older, through `@brumate/tsc` and `@brumate/typescript-plugin`. TypeScript 7.1 adds an API for content mappers, which turn the files of other languages into TypeScript and map positions between them.

- A content mapper from `toTypeScript` would let `tsc` and the editor of TypeScript 7 check `.brm` files.
- It would replace `@brumate/tsc`, and the TypeScript plugin in the extension.
- This waits for the API to be stable, and for its documentation.

### Devtools

The panel has four tabs today: the scopes and their values, the graph of a component, a log of handlers, loads, writes and calls, and the report of a component. It shows the browser after the page resumed, and little of what makes a brumate page what it is: what the server sent, why code loaded, and the blocks that render later.

What it should show:

- **Elements.** Pick an element to see its scope, its anchor, its handlers with the size of each one's part and whether it loaded, and the values that its updates read. A link opens the `.brm` file at the line of the element in the editor, from the source maps, through the dev server, as Vite's `launch-editor` does.
- **Loading.** A timeline of every part that loaded, with why: an event, the idle preload, an element that came into view, a hover, or navigation. Each row has its size, its time and the event that waited for it. Preloads that nothing used are marked.
  - Note, 2026-10-25: the page's code now loads when it starts, in one bundle per root component. `prefetch` and the `preload` option were removed. The devtools have no Loading tab.
- **Page state.** The bytes of the first state record by component and by slot, and for each slot the client code that reads it, which is why it is sent. A value that is large, or sent but rarely read, stands out.
- **Blocks.** Every `#loading`, `#defer` and `#client` block of the page with its state: fallback, waiting, streaming or rendered, its trigger, and when its body arrived and how long it took. Buttons fire a trigger now, or show a block's fallback again, to test both sides.
- **Effects.** The `$effect`s and `$client` callbacks that are active, how often each ran, and when its cleanup ran last, so an effect that runs too often is easy to find.
- **Server.** For the request of the page: the render time, each memo load and server function call with its time, and each boundary, from the traces of [observability](#observability) in development.
- **Navigation.** For the last client navigation: the layouts that stayed, the routes that were replaced, and the IDs that moved.
- **Errors.** Errors of client code with their scope and component, from `onError` of the loader.
- **History.** The writes of the log can be undone one by one, and a session of writes can be exported and replayed, to share how a bug happens.

How it ships:

- The panel stays in the page in development, so it needs no extension, and loads only when opened.
- A browser extension can show the same panel in the browser's devtools later, so it does not cover the page, and so a production build can open it with an option.

Elements, loading, blocks with their fallbacks, errors, page state, effects, navigation and server are done, with a timeline and outlines of the elements that change: see [Devtools](../website/docs/inspect.md#devtools). History and a browser extension are left, about 2 weeks.

### Component workbench

A page in the dev server that lists the components of the app, renders each one on the server with props from controls, and resumes it, as Storybook and Ladle do for other frameworks.

A workbench helps with small components that depend only on their props, such as a `Button`, a `Badge` or a `Select`. A large component that reads the request, calls the server or needs a route fits an end-to-end test better, and a workbench shows it badly. So the workbench lists only the components that it can show, and the compiler decides which ones those are.

#### Which components it shows

The project analysis classifies each component by what it depends on, itself and through the components that it renders:

| Kind                  | What it depends on                                                                                                                                     | In the workbench                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Self-contained        | Its props, its own state, and the contexts it reads                                                                                                    | Listed, with controls for its props                             |
| Needs the environment | A server function, the request (`getEvent`, cookies, `locals`), the route, a `#defer`, a form action, or a dynamic tag with no element to fall back to | Listed only with a story file that gives what it needs          |
| Route or layout       | A file of `src/routes`                                                                                                                                 | Never. `visit` from `brumate/testing` and e2e tests cover these |

- The analyzer already sees each of these in a file, and the project analysis already knows which components each file renders. The classification combines the two.
- The line is what a component depends on, not where it is. An app has small components, such as in `src/components`, and a package can have components that call its own server functions.
- When the analysis cannot tell, such as for a dynamic tag (`<{as}>`) whose tag comes from a prop with no element as its default, the component counts as one that needs the environment. Every context has a default, so reading one needs no provider.

#### How it works

- `/__brumate/workbench` in the dev server lists the self-contained components of the app and of its `.brm` packages, by folder.
- The type checker knows the props of each component from `$props<T>()`, so the page makes the controls: text, numbers, booleans, choices for unions, and JSON for the rest.
- Each component renders on the server with the props of the controls and resumes in the browser, as a page does, so what it shows is what a page gets. The devtools panel and the report of what the component ships are beside it.
- A story file is optional: `Button.stories.ts` exports named sets of props. Later, a story can also give a component that needs the environment its server answers, its request, its route and its context providers, with the helpers of `brumate/testing`.

#### Order

1. The classification in the project analysis, with tests. Done.
2. The page in the dev server, for self-contained components, with controls from the props. Done: see [Workbench](../website/docs/inspect.md#workbench).
3. Story files with named props.
4. Stories with server answers, a request, a route and providers, if apps ask for them.

The first user is `@brumate/ui`, whose parts are almost all self-contained, so the workbench grows with the `Select` spike.

### Agent support

Coding agents write `.brm` files from what they know of Svelte, Vue and JSX, and brumate differs from each in small ways. An agent writes `minValue=minValue` where brumate has `{minValue}`, `} else {` where it needs `} #else {`, or an arrow in `let` where a value of the page state must be a function declaration. The compiler catches some of these, and the rest compile into code that works but reads badly. Agents also read the docs one page at a time, and the devtools show a problem to a person but give an agent nothing to read.

What brumate has today:

- Compile errors that say what to write instead, such as `Import $memo from 'brumate/signals'`.
- `brumate inspect`, with `--json`, which reports what each component ships and why.
- The search index of the website, which already turns the docs and the pages of `@brumate/ui` into plain text.
- No skill, no `llms.txt`, and no way to copy what the devtools show.

#### A skill for `.brm` files

A skill in the [Agent Skills](https://agentskills.io) format, `SKILL.md` with a name, a description and the instructions, that an agent loads when it works on `.brm` files.

- It ships in the `brumate` package as `skills/brumate/`, so an app has the version that matches its brumate. `npx brumate skill` copies it into `.claude/skills/brumate/`, or prints where it is for other agents.
- The repository links the same files from `.claude/skills/brumate/`, so work on brumate itself uses it too.
- `SKILL.md` stays short: the layout of a file, the rules below, and the checks to run. Longer references sit next to it, for an agent to read when it needs them:
  - `syntax.md`: markup, attributes, blocks and templates, one example each.
  - `state.md`: signals, memos, props, `$bind`, contexts and module functions.
  - `events.md`: handlers, the wrappers of `brumate/events`, and why handlers are passive.
  - `ui.md`: how the parts of `@brumate/ui` fit together, such as a Label, a field and a FieldError.
  - `errors.md`: each compile error, with what causes it and the fix.
- The rules are the mistakes that agents make, with the right form:
  - Attributes: `{name}` for `name=name`, and `{onClick}` for a handler.
  - Blocks: `} #else {`, `} #else if (…) {` and `} #catch (error) {`.
  - Handlers: `prevent(handler, 'Enter')` from `brumate/events` for `preventDefault`, because delegated handlers are passive and run after the event.
  - State: a function in the page state is a function declaration. Signals never leave the file, so a child gets a value and a function that writes it.
  - Props: `let` props for values that a parent binds with `$bind`, and `Bindable<T>` in their types.
  - Markup as a value: a `#template`, never markup in an expression.
  - Module functions: called at the top level and destructured. A plain helper of a `.brm.ts` file goes in a `.ts` file.
- It ends with the checks, in order: `brumate-tsc --noEmit`, the tests, and `brumate inspect` for what a component ships.

So the skill does not drift from the compiler:

- A test compiles every `brm` code block of the skill, and a block marked as wrong must fail with the error that the skill names.
- `errors.md` is generated from the messages of the compiler, so a new error gets an entry.
- A small set of tasks, such as a counter, a keyed list, a form with a server function and a Select, checks what an agent writes with the skill: each task must compile, pass `brumate-tsc`, and pass its test. It runs by hand before a release, not in CI.

#### Docs for agents on the website

- `/llms.txt` lists the pages of the docs and of `@brumate/ui`, each with its title, one line about it, and a link to its Markdown, as [llms.txt](https://llmstxt.org) describes.
- `/llms-full.txt` holds every page in one file, for an agent that reads the docs at once.
- Each page has its Markdown at the same path with `.md`, such as `/docs/components.md`, with the live examples as code blocks.
- A button on each page copies its Markdown, for a person who pastes it into a chat.
- A Vite plugin of the website builds all three from the same files as the search index, so they stay in step with the pages.

#### Copy for an agent in the devtools

A button copies what a part of the devtools shows, as Markdown that an agent can read:

- **An error:** the message, the component and its file and line, the source around the line, the scope with its values, and the versions of brumate and Vite.
- **A component:** its file, its props and the value of each slot by name, its contexts, and the report of `brumate inspect` for it.
- **A handler run of the timeline:** the event, the writes that it made, the updates that ran, and the server calls with their times.

Values are cut at a length, and the devtools copy nothing from cookies or headers. The devtools run only on the dev server, so a production page copies nothing.

#### A command for agents

- `brumate check` runs the compiler and the type checker on the project, and prints each problem as JSON with its file, its range, its message and a link to the docs. An agent runs one command and reads one answer, instead of parsing the output of two tools.
- Each compile error gets a code, such as `BRM012`, and a link to the section of the docs that explains it. The link is in the message, so a person sees it too.

#### Later

- A server of the [Model Context Protocol](https://modelcontextprotocol.io) in the dev server, with tools that search the docs, inspect a component, check a file, and read the state of the open page. It waits until the pieces above show which tools agents use.

#### Order

1. The skill, its references, and the test of its code blocks. About 3 days.
2. `llms.txt`, `llms-full.txt`, the Markdown of each page, and the copy button. About 2 days.
3. Copy for an agent in the devtools. About 3 days.
4. `brumate check` with JSON, codes for compile errors, and links to the docs. About 4 days.
5. The tasks that check the skill, run by hand.

Each step is its own pull request.

### Embedding in other sites

A brumate component cannot go into a page that brumate did not render, such as a widget on a marketing site or a component in an app of another framework.

- A build target writes a component as a custom element, `<brumate-widget src="…">`, or as a script that renders it into an element.
- The element asks the server for its markup and state, as a `#defer` body does, and resumes it. The page around it needs no brumate code, only the loader, which stays under 3 kB gzip.
- Without a server, the element renders in the browser from the render module, with props from its attributes.
- Styles are scoped already. In a shadow root they stay apart from the page around them.
- Server functions answer from the brumate server, so the element works across origins with the `origins` option and CORS.

Cost: about 2 weeks. The request for markup reuses `#defer`, and most of the work is the build target and the cross-origin rules.

## Compiler

### A smaller and faster client

The page code loads at the start since #113, so speed is close to Marko's and size is the gap. A run of `pnpm bench` on 2026-10-25, at the tip of the stack of the UI components:

| Metric                  | brumate                | Marko 6              |
| ----------------------- | ---------------------- | -------------------- |
| Create 1,000 rows       | 35 ms                  | 33 ms                |
| Replace 1,000 rows      | 31 ms                  | 26 ms                |
| Append 1,000 rows       | 32 ms                  | 40 ms                |
| JS before `load`, todos | 30.6 kB / 13.0 kB gzip | 9.1 kB / 4.4 kB gzip |

Of the 13.0 kB, the core is 9.2 kB, the loader 2.9 kB and the app 0.9 kB. The bytes of the core are spread over many functions. Part of them is code for features that a page does not use, which the bundler keeps because the core reaches it through runtime branches.

What Marko's compiler does that brumate's core does at runtime:

| Work                            | Marko 6                                                                         | Brumate now                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Markup that the browser renders | A template that it clones, and a walk string that picks the nodes to update     | An HTML string, inserted and then scanned for its markers                                       |
| The nodes that an update writes | Kept on the scope when the markup is cloned or resumed                          | Found by a marker or a `b-b` anchor, through an index that a MutationObserver keeps, or a query |
| What a change runs              | A function for each value, which calls the functions of the values that read it | Tables of updates by slot (`g`), which `run` reads, with the order of the graph at runtime      |

#### Steps

Each step is a PR of its own, measured with `pnpm bench` before and after: the gzip size of the JS before `load`, the rows scenario, and the first click. Size comes first.

1. **Features of the build.** The Vite plugin reads which features of the core the components of a build use, and the client build leaves out the code of the others, such as children that the browser renders, templates, titles and bindings. Done in #147: the core of todos goes from 9.2 kB to 8.3 kB gzip.
2. **More features of the build**, with the same switches: what a page without `#loading`, `#defer` or client navigation never needs, such as the index of markup that arrives later.
3. **Nodes on the scope, and cloned templates.** The resume scan and each client render store the nodes that updates write on their scope. A body that the browser renders compiles to a `<template>` and a walk string. The index, its MutationObserver, the HTML strings and their scans go.
4. **Functions for values.** The compiler emits a function for each value that changes, which writes its nodes and calls the functions of the values that read it. The update tables and the code that reads them go.

#### Later: fixed walks

A clone finds the elements that its render writes with a walk of paths at runtime, which the browser reads from `b-x` marks in the parsed template. Solid and Svelte emit the walk as code instead, each node into a variable. The branch `exp/fixed-walk` tries it on the rows of the benchmark, on 2026-10-25:

| Script of each operation |  Runtime walk |    Fixed walk | Marko 6 |
| ------------------------ | ------------: | ------------: | ------: |
| Create 1,000 rows        |  about 6.1 ms |  about 5.2 ms |  5.0 ms |
| Replace 1,000 rows       | about 11.6 ms | about 11.4 ms | 10.8 ms |

Creating rows takes about 0.9 ms less, and replacing them about the same. Both take about 28 ms from the click to the paint, so the gain is 2 to 3% of it. The walk is a line of code for each node on the path to an element, in each component, and the compiler must know that the parser keeps the markup as it is written, as Solid checks the nesting of elements. It waits until speed matters more than size.

#### Risks

- Streaming. Markup and state that arrive later, out of order, need the scan of step 1 to run on each chunk, as the index does now.
- `#offscreen` and `#defer` rely on the markers of a body as they are now. Each step keeps their tests passing.
- The devtools read the update tables and the index. They need the same facts from the new places.
- A feature that the build turns off must never be needed. The plugin reads it from the compiled code, and a page state that holds a value of it throws an error that says so.

## Library

### Headless UI components

A package of accessible, unstyled components, `@brumate/ui`. It takes its behaviour and its way of composing parts from [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html), and its API features from [Terracotta](https://github.com/lxsmnsyc/terracotta). It is written in brumate. No React code runs.

#### What it takes from each

From React Aria Components:

- The behaviour: press handling, focus and keyboard rules, typeahead, selection in collections, overlay dismissal, and the WAI-ARIA patterns. React Aria's tests and docs are the specification. Its code is Apache-2.0, so ported parts keep its notice.
- Composition from generic parts. A `Select` is not one closed component. It is built from the same `Label`, `Button`, `Popover` and `ListBox` that work on their own:

  ```html
  <Select>
    <Label>Animal</Label>
    <Button><SelectValue /></Button>
    <Popover>
      <ListBox items=animals item=animal />
    </Popover>
  </Select>
  ```

  `Select` provides a context for each part type. Each generic part reads its context, if there is one, and merges it with its own props. Handlers are chained, and the part's own props win. A `slot` prop picks between several parts of one type, as in `<Button slot="increment">`.

From Terracotta:

- An `as` prop on every part, so it can render another element or component. It compiles to a dynamic tag, `<{as ?? 'button'} …>`.
- Render props, so the caller's markup can read the state of a part. A part calls a `#template` prop with its state, such as `{content({ open, close })}`.
- State as `data-*` attributes, such as `data-open` and `data-selected`, for styling with CSS or class objects.
- The split between controlled and uncontrolled state, below.

#### Decisions

Settled on 2026-10-24:

- **Browser support.** A part uses a feature of the platform only when at least 95% of global usage supports it. The share is the global usage of each browser version, from caniuse, summed over the versions that MDN's compatibility data marks as supporting the feature. The client of brumate will be checked against the same rule.
- **No native popover or dialog.** Overlays follow React Aria and Terracotta, which use neither: they render with `#portal`, and the shared modules place them, keep focus in them and give it back, close them on Escape or a click outside, and hide the rest of the page from assistive technology.
- **React Aria and Terracotta are the reference.** Where a part has a choice of how to behave, it does what they do, and their tests and docs are the specification.
- **Nested layers.** An overlay mounts in the layer of the nearest floating part above it, such as the `Dialog` or `Popover` that it opens from, and not at the end of `<body>`. React Aria and Terracotta mount every overlay at the end of `<body>`, so this is where the parts differ from them.
- **Unstyled.** The parts render markup, ARIA attributes and `data-*` state, and no CSS. The website shows them styled in its own style, as an example.
- **Docs of their own.** The docs of `@brumate/ui` are on the website, at `/ui`, apart from the docs of brumate. The section has its own navigation, sidebar and search, and shows only the parts. It links to the docs of brumate for the features that the parts use, and the docs of brumate link to it once.
- **Bindable state.** A part has one prop for each state, such as `open`, `value` and `checked`, and no `defaultOpen`. A value starts the part's own copy, and `open=$bind(settingsOpen)` controls it. See [Controlled and uncontrolled](#controlled-and-uncontrolled).

#### Layers

Each floating part renders a layer: an element that the part owns, and that holds the panel that the caller styles. An overlay that opens from inside a floating part mounts at the end of that part's layer, so the layers form a tree that follows the nesting of the parts.

- The overlay paints above its parent, because it comes last in the parent's layer, and the parent is above the page. Only the root layer needs a `z-index`.
- The page sees the nesting. A click in a popover of a dialog is a click inside the dialog, focus that stays in the dialog can go to its popovers, the `aria-hidden` that hides the page behind the dialog does not hide them, and closing the dialog removes them. CSS custom properties of the dialog reach them too.
- The server renders an overlay in its place, after its parent's panel, so the browser moves nothing when the page resumes.

Rules:

1. An overlay mounts in its parent's layer, not in the panel. The layer has no `overflow`, `transform` or `contain`, so a panel that scrolls or animates with a transform does not clip its overlays or change where they are placed.
2. Overlays are placed with `top` and `left`, never with `transform`, so a layer is never the containing block of the overlays in it.
3. An overlay that is not inside a floating part mounts in the root layer, at the end of `<body>`. Toasts always do.
4. A `container` prop overrides this: an element, a selector, or `false` to render in place.
5. Overlays of the same layer stack in the order that they opened.

A `LAYER` context holds the layer of each floating part, and its default is the root layer, so an overlay finds its layer with `$getContext(LAYER)`.

What the 95% rule allows, measured on 2026-10-24:

| Feature                               | Global support | Use                                                                 |
| ------------------------------------- | -------------: | ------------------------------------------------------------------- |
| `inert`                               |          96.4% | Yes, for the page behind a modal                                    |
| `:focus-visible`                      |          96.5% | Yes, in place of focus-visible tracking                             |
| `Element.checkVisibility()`           |          95.2% | Yes, for focus order                                                |
| Popover API                           |          93.6% | No                                                                  |
| `@starting-style`                     |          93.0% | No. Overlays animate with `Transition`.                             |
| `transition-behavior: allow-discrete` |          91.0% | No                                                                  |
| CSS anchor positioning                |          87.3% | No. A shared module places overlays.                                |
| `commandfor` and `command`            |          86.2% | No                                                                  |
| View transitions                      |          92.9% | Only where a browser without them still works, as `transition` does |

#### Controlled and uncontrolled

A part with state has one prop for it, such as `open`, and the way the caller passes it picks the shape. There is no `defaultOpen`. This is where the parts differ from React Aria and Terracotta, which have both props.

| Prop      | Parts                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| `open`    | `Disclosure`, `Dialog`, `Modal`, `Sheet`, `Popover`, `Tooltip`, `Menu`, `Select`, `ComboBox`    |
| `value`   | `Select`, `ComboBox`, `ListBox`, `RadioGroup`, `Tabs`, `Slider`, `NumberField`, the date fields |
| `checked` | `Checkbox`, `Switch`                                                                            |
| `pressed` | `ToggleButton`                                                                                  |

```html
<!-- Uncontrolled: the dialog keeps its own state, which starts closed. -->
<Dialog onChange=((open) => log(open))>…</Dialog>

<!-- Uncontrolled, from a value: the dialog starts open and keeps its own copy. -->
<Dialog open=(true)>…</Dialog>

<!-- Controlled: the dialog writes the caller's signal. -->
<Dialog open=$bind(settingsOpen)>…</Dialog>

<!-- Controlled, with a setter: the caller decides, and the dialog shows what it keeps. -->
<Dialog open=$bind(settingsOpen, (next) => { if (!dirty) settingsOpen = next; })>…</Dialog>
```

- **A value**, such as `open=(true)` or `open=settingsOpen`, starts the part's own copy, and the part writes the copy. A new value from the caller replaces it, so the caller can still close the dialog.
- **A binding**, `open=$bind(settingsOpen)`, makes the part write the caller's signal.
- **A binding with a setter** calls the setter in place of the write. It can refuse or change the value, and the part shows what the caller keeps, as a controlled part of React Aria does.
- `onChange` reports each new value in every shape.
- This is how a `let` prop of brumate works, so a part needs no helper for it: `let { open = false } = $props<{ open?: Bindable<boolean> }>()`, and a write of `open` goes where the caller said.
- A value of `null` or `undefined` is a value like any other, such as the `value` of a `Select` with nothing selected.
- `$isPassed(open)` and `$isBound(open)` tell a part how the caller passed the prop, for a part that needs to know.

What brumate adds to the split:

- The state of an uncontrolled part is a slot of the part's own scope, which the page state sends. A bound part's state is a slot of the caller, so the part sends nothing of its own.
- On the server, nothing writes, so every shape renders the value that it starts with.

#### How it maps to brumate

| React Aria Components or Terracotta | brumate                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Context provider in `Select`        | `$setContext(POPOVER, { … })` in `Select.brm`                                                                                         |
| `useContextProps` in a part         | `$getContext(POPOVER)` merged with the part's props                                                                                   |
| `slot` prop                         | A context value keyed by slot, read as `ctx[slot]`                                                                                    |
| `triggerRef` for positioning        | A function of a shared `.brm.ts` module that places the overlay next to its trigger, when it opens and as the page scrolls or resizes |
| Behaviour hooks                     | Functions in a `.brm.ts` module that the parts share                                                                                  |
| Children as a render function       | A named `#template` prop, because `children` is markup that the server renders                                                        |
| `defaultOpen` and `isOpen`          | `open`, as a value or `open=$bind(…)`                                                                                                 |
| Collections from JSX children       | An `items` prop and an item `#template`, because brumate cannot read the structure of markup                                          |
| Global listeners at startup         | CSS `:focus-visible` in place of focus-visible tracking. Listeners for a click outside are added when an overlay opens.               |
| `@internationalized/date`, `number` | Used as they are                                                                                                                      |

The parts do not use `<dialog>`, the Popover API, `commandfor` or CSS anchor positioning. See [Decisions](#decisions).

#### What the compiler needs first

1. Conditional `preventDefault`. Done as `prevent(handler, 'ArrowDown', 'Enter')` from `brumate/events`, which the loader applies by key. See [Markup](../website/docs/markup.md#before-the-handler-loads).
2. Handlers in spreads. Done for the handlers that a caller passes on, which a spread writes into `b-on` with the scope of their owner and their wrappers. A part that makes its own handlers gives them with [`$handler`](../website/docs/components.md#handlers-that-a-script-makes), and markup that the browser renders gets the handlers of its spreads. See [Components](../website/docs/components.md#handlers-in-a-spread).
3. Components from packages. The Vite plugin finds `.brm` files only under the app root and skips `node_modules`, and component IDs come from the path under the root. A published package needs discovery from dependencies, and IDs that include the package name.

#### Questions to answer with a spike

Build `Select` from `Label`, `Button`, `SelectValue`, `Popover` and `ListBox` with context composition, slots, `as` and render props. It answers:

- Do parts that the caller passes as `children` read the contexts of `Select`? Children are rendered in the caller's scope and placed inside `Select`.
- What does `$getContext` return when no provider is above a part?
- Does markup that a `#template` prop rendered update when the state that the part passed to it changes?
- Can the `as` element get the part's handlers, ARIA attributes and focus, when `as` names a component?

Answers, from the spike in `packages/brumate/test/render/Spike*.brm` and the `Select spike` tests of `resume.test.ts`, where `it.fails` marks each gap:

- **Children read the contexts of the component they are passed to.** Done: the compiler renders `children` where the component inserts them, as layout routes render theirs. Their scopes keep the caller's for their values, and find contexts from the insert, which the page state sends as `t`.
- **Without a provider, `$getContext` gives the default value of the context,** on the server and in the browser, so a part on its own works. A default of `null` lets a part tell that it is alone.
- **A `#template` prop renders in the browser.** Done: the server sends it as a reference, `Page#t3`, to an export with its code, and the core calls it at once. The code starts to load when the page state is read, and updates wait for it.
- **An `as` component gets the handlers of the part and of the caller,** once handlers pass through spreads and dynamic tags (#31). ARIA attributes pass as attributes, and the `class` of a spread adds to the `class` of the element. Focus through `as` was not checked, since it needs a ref to the element of another component.

#### Plan

1. **Groundwork**, about a week:
   - `packages/ui` as `@brumate/ui`, a package of `.brm` components, as `examples/ui-kit` is.
   - The workbench counts a context with a default and a dynamic tag with a default element as self-contained, since every part reads the context of its parent and renders `as`.
   - Story files for the workbench, with named sets of props, so each part shows its states.
   - Helpers for keyboard and focus in tests, and `examples/ui`, a page of every part that `pnpm e2e` covers with axe-core.
2. **Phase 0**, the foundations, 3 to 4 weeks. The shared modules: the merge of a context with props, with chained handlers and `slot`, and press, hover and focus with their `data-*` state. `VisuallyHidden`, `Keyboard` and `I18nProvider`. It ends with `Button` on all of these, with the press tests of React Aria, in the workbench, and a guide to writing a part. It also answers whether focus passes through `as` when `as` names a component.
3. **Phases 1, 2 and 3**, the controls and fields, the overlays, and the collections with `Select`, in that order, as the roadmap below says.
4. **Phases 4 to 7**, as users ask for them.

Each phase ships with tests that follow the behaviour of React Aria, an accessibility check, docs in the `/ui` section of the website with live samples in the style of the site, stories in the workbench, and a check that a part that is closed or unused ships close to nothing.

`packages/ui` stays in this repository while the page format, IDs and spread rules still change. It moves to its own repository after 1.0 if its release pace differs from the compiler's.

#### Roadmap

The parts come from `react-aria-components` 1.22.1 (2026-10-09). Each phase ships when its parts have tests that follow React Aria's behaviour, an accessibility check, docs and live samples. A phase builds on the ones before it.

| Phase                      | Parts                                                                                                                                                                                                                                                                                                | Needs                                                                                                | Cost                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 0. Foundations             | Press, focus and hover handling (`Pressable`, `Focusable`), `VisuallyHidden`, `Keyboard`, `I18nProvider` (locale and direction), context composition with `slot`, `as`, render props and `data-*` state                                                                                              | The `Select` spike, conditional `preventDefault`, handlers in spreads                                | 3 to 4 weeks, with the compiler work |
| 1. Controls and fields     | `Button`, `ToggleButton`, `ToggleButtonGroup`, `Link`, `Label`, `Text`, `Input`, `TextArea`, `TextField`, `SearchField`, `Checkbox`, `CheckboxGroup`, `RadioGroup`, `Switch`, `FieldError`, `Form`, `Group`, `Separator`, `Heading`, `Toolbar`, `Breadcrumbs`, `Meter`, `ProgressBar`, `FileTrigger` | Phase 0. `Form` and `FieldError` use [`createForm`](../website/docs/forms.md#forms-with-createform). | 3 to 4 weeks                         |
| 2. Disclosure and overlays | `Disclosure`, `DisclosureGroup`, `Popover`, `OverlayArrow`, `Dialog`, `Modal`, `Sheet`, `Tooltip`, `PreviewTrigger`, `Toast`, and `Transition` from Terracotta                                                                                                                                       | Phase 1. `#portal`, and shared modules that place overlays, trap focus and close them.               | 5 to 6 weeks                         |
| 3. Collections             | The collection model (keys, sections with `Header`, disabled keys, single and multiple selection, typeahead, focus within a list), `ListBox`, `Menu` with submenus, `Select`, `ComboBox`, `Autocomplete`, `Tabs`, `TagGroup`, `GridList`, `SelectionIndicator`                                       | Phase 2 for the popovers of menus and selects                                                        | 6 to 8 weeks                         |
| 4. Numbers                 | `NumberField`, `Slider` with several thumbs                                                                                                                                                                                                                                                          | Phase 1, and `@internationalized/number`                                                             | 2 weeks                              |
| 5. Dates and times         | `Calendar`, `RangeCalendar`, `DateField`, `TimeField`, `DatePicker`, `DateRangePicker`                                                                                                                                                                                                               | Phases 2 and 3, and `@internationalized/date`                                                        | 4 to 6 weeks                         |
| 6. Data                    | `Table` with sorting, selection and column resizing, `Tree`, `NavigationTree`, `TokenField`, `Virtualizer`, drag and drop with `DropZone`, and list and tree data helpers                                                                                                                            | Phase 3                                                                                              | 6 to 8 weeks                         |
| 7. Color                   | `ColorPicker`, `ColorArea`, `ColorSlider`, `ColorWheel`, `ColorThumb`, `ColorField`, `ColorSwatch`, `ColorSwatchPicker`                                                                                                                                                                              | Phases 1 and 4                                                                                       | 3 to 4 weeks                         |

Notes for each phase:

- Phase 0 is most of the risk. It settles how a part merges its context with its props, how state reaches the caller's markup, and how `as` passes handlers and focus to a component. Every later part depends on it.
- Phase 1 parts are mostly markup and attributes, and many need no client code until they are used. A `Checkbox` is a native `<input type="checkbox">` with labels and states.
- Phase 2 renders every overlay with `#portal`, so it is above the page without the top layer of the browser. Shared modules do the rest:
  - placing a `Popover` or `Tooltip` next to its trigger, flipping it when it does not fit, when it opens and as the page scrolls or resizes;
  - moving focus into a `Dialog` or `Modal`, keeping it there, and giving it back to the trigger when it closes, as React Aria's `FocusScope` does;
  - closing on Escape and on a click outside, with listeners that are added when the overlay opens, as React Aria's `useInteractOutside` does;
  - hiding the rest of the page behind a `Modal` with `aria-hidden`, as React Aria's `ariaHideOutside` does, and locking its scroll, as its `usePreventScroll` does.
- Phase 2 animates with `Transition`, for overlays and for other content that is removed. `Transition` animates content that is removed, such as an `#if` body or a toast, which CSS cannot do because the node is gone. It follows [Terracotta](https://github.com/lxsmnsyc/terracotta)'s `Transition`: it keeps the content until its leave transition ends, then removes it. It takes Terracotta's `enter`, `enterFrom`, `enterTo`, `leave`, `leaveFrom` and `leaveTo` class props, and sets `data-closed`, `data-enter` and `data-leave` for CSS without class lists, as Headless UI does. It needs no compiler or runtime change: a signal of its own keeps the content mounted, and an `#if` removes it after `transitionend` or `animationend`, with a timeout when neither fires. The server renders the content as `show` says, with no animation on load. `prefers-reduced-motion` skips the wait. Nested `TransitionChild` coordination, and leave animations for `#for` items, which need a hook in the list code of the runtime, come later.
- Phase 3 is the largest. Brumate cannot read the structure of markup the way React Aria reads its children, so a collection reads its items from the page: each item writes its key in `data-key`, and the order of the items is the order of their elements. Items can then come from any markup, such as a `#for` or sections, with no `items` prop. Keyboard movement, ranges and typeahead go in `collection.ts`, which every collection shares. `Select` and `ComboBox` keep a native `<select>` or `<input>` where they can, so forms post without scripts.
- Phase 4 parses and formats numbers by locale on the server and in the browser with the same code.
- Phase 5 keeps dates in signals as ISO strings, because the page state cannot hold `CalendarDate` class instances.
- Phase 6 renders rows on the server. `Virtualizer` and drag and drop run only in the browser, from `$client` and handlers, so they load when used.
- Phase 7 is the least common need, so it comes last.

Not ported:

- `SharedElementTransition`, because view transitions cover it.
- `CollectionBuilder` and the other internals, because brumate builds collections from `items` and templates.
- `RouterProvider`, because brumate's links already navigate on the client.

Order of value: phases 0 to 3 cover most of what apps use, in about 4 to 5 months. Phases 4 to 7 can follow what users ask for.

Not planned: running React Aria, Radix or Headless UI, which need React; an adapter for Zag.js state machines, whose state does not resume and which costs 14 to 27 kB gzip per widget; and wrappers for TanStack Query or TanStack Form, which overlap with `$memo`, `refresh`, `$action` and `parseForm`.

### Internationalization

Brumate has nothing to translate the text of a page. `I18nProvider` of `@brumate/ui` sets the locale and the direction of the parts, not their text. Resuming makes a design possible that ships almost no messages: markup that the browser never renders again stays on the server with its text.

#### Messages

Messages live in a catalog for each locale, such as `messages/en.json` and `messages/fr.json`, with ICU message syntax:

```json
{
  "greeting": "Hello, {name}!",
  "cart": "{count, plural, =0 {Your cart is empty} one {# item} other {# items}}",
  "docs": "Read the <link>docs</link>."
}
```

The Vite plugin compiles each catalog into functions, as Paraglide does, and a component imports them:

```brm
<script>
  import { m } from 'brumate/messages';
  import { $props } from 'brumate/signals';

  const { name, count } = $props<{ name: string; count: number }>();
</script>

<h1>{m.greeting({ name })}</h1>
<p>{m.cart({ count })}</p>
```

- `m.greeting` is a function with the types of its parameters, from a declaration file that the plugin writes. A missing message or a missing parameter is a type error.
- Plurals and selects use `Intl.PluralRules`, with the same code on the server and in the browser.
- A message missing in a locale falls back along a chain, such as `fr-CA`, `fr`, `en`. The dev server warns about it.

#### What ships

- Markup that the browser never renders again calls its messages on the server. Its text is in the HTML, and neither the message nor the catalog reaches the browser.
- Markup that the browser renders or updates, a handler or a `$client` callback, calls `m.greeting` in the browser. Only those messages ship, since each is an export of its own, and the bundler leaves the others out.
- A message that ships holds the text of each locale, as in Paraglide 2, or a module for each locale loads with the code of the page, as the locale of `<html lang>` says. The choice is for the spike: one module for all is simpler, one for each locale is smaller when there are many.
- A translated string that a memo holds is in the page state like any value. The catalog is not.

#### The locale

- The middleware picks the locale for each request: from a segment of the route, such as `/fr/docs`, from a cookie, or from `Accept-Language`, with a strategy that the app sets.
- `$locale()` from `brumate/signals` reads it, as `$route()` reads the route, on the server and in the browser.
- The server writes `<html lang dir>`, and `I18nProvider` of `@brumate/ui` reads the same locale.
- A change of locale is a navigation, such as to `/fr/...` or after a cookie changes, so the server renders the page with its text. Text is on the server, so nothing else is needed.
- With routes by locale, `#head` gets the `hreflang` links, and prerendering writes each page for each locale.

#### Formatting

`brumate/i18n` gives functions over `Intl`: numbers, currency, dates, relative times and lists, which read the locale. The number parsing of NumberField in `@brumate/ui` moves into it.

#### To decide

- Markup in messages, such as `<link>` above. A message could take a `#template` for each tag, which gets the text inside the tag. Or the message returns its parts, and markup renders them.
- How a `.brm.ts` module function reads messages and the locale.
- Whether the catalogs follow the format of inlang, so its editors and machine translation work with them.

Cost: about two weeks: the catalogs and their compile, the locale in middleware and in the core, formatting, and the docs. Then a spike for the open questions.

### Images

Brumate leaves images to the app. A Vite plugin and an `Image` part, after `@solidjs/image`, can make them responsive at build time. Resuming means that most of it needs no code in the browser.

#### Importing an image

```brm
<script>
  import { Image } from 'brumate/image';
  import hero from './hero.jpg?image';
</script>

<Image {...hero} alt="The harbor at dawn" sizes="(max-width: 800px) 100vw, 800px" />
```

The plugin handles imports that end in `?image`:

- It reads the file with sharp and writes a file for each output format and each width, such as `webp` and `jpeg` at 480, 800 and 1200 pixels. Widths larger than the source are dropped, so an image is never enlarged.
- Formats are offered smallest first: AVIF, WebP, then JPEG, or PNG for an image with transparency. The last format is the fallback of the `<img>`.
- The import gives the `src` with the intrinsic width and height, the variants, and a preview.
- Photos are turned upright with their EXIF orientation. Animated GIFs stay animated as WebP.
- Each file is named by a hash of the content of the source, the format, the width and the quality. A build reuses a file from the cache when nothing changed, also on a fresh checkout in CI.
- In a build the files are assets of the bundle, so `base` and the manifest apply. The dev server writes them to a cache directory and serves them from there.
- `?image-url`, with `width` and `format`, gives the URL of one file, for an `og:image`, a CSS background or a canvas.
- `image:` followed by any string goes through `transformURL` of the options, which returns the source and variants of a CDN.

#### The `Image` part

It renders a `<picture>` with a `<source>` for each format and an `<img>`, inside a box with the aspect ratio of the image, so the page does not shift while it loads.

- A lazy image uses the browser: `loading="lazy"` and `decoding="async"`. `@solidjs/image` needs an IntersectionObserver and JavaScript for this. Here the image needs no code, and works without scripts with no `<noscript>` copy.
- `eager` loads the image at once, with `fetchpriority="high"`, and the server adds a `<link rel="preload">` to `#head` with `imagesrcset` and `imagesizes`. One image of a page, the largest one above the fold, should be eager.
- `sizes` passes on to each `<source>`. It defaults to `100vw`, which is right only for a full-width image, so the docs say to set it.
- `crossOrigin`, `fetchPriority`, `decoding` and the other attributes of `<img>` pass on.
- Each element has `data-image` with its role (`box`, `picture`, `img`, `preview`), and `data-loaded` once the image loads, for styles, as the parts of `@brumate/ui` do.

#### Previews

The default preview is an image about 20 pixels wide, inlined as a data URL, and the main color of the image. The box paints them behind the image, scaled up, which blurs them. That needs no code: the image covers the preview once it loads.

- A fade-in on load is an `onLoad` handler. The loader listens to `load` in the capture phase, since it does not bubble, so its code loads only when an image loads, and a page without the fade loads none.
- BlurHash and ThumbHash previews need code to decode in the browser. A `$client(…, 'visible')` callback decodes one when the box comes into view, and the server paints the average color until then. Only an app that turns them on ships the decoder.
- With `prefers-reduced-motion`, there is no fade.

#### Errors

- `onError` runs when the image fails.
- An `error` prop, a `#template`, renders in place of the image, over the preview, in the browser.

#### Options

| Option        | Default                        | What it does                                     |
| ------------- | ------------------------------ | ------------------------------------------------ |
| `sizes`       | required                       | The widths to write                              |
| `input`       | `png`, `jpeg`, `webp`, `gif`   | The formats of files that the plugin handles     |
| `output`      | `webp`, `jpeg`                 | The formats to write                             |
| `quality`     | 50 for AVIF, 80 for the others | The quality of sharp, for all or for each format |
| `placeholder` | an image of 20 pixels          | `false`, a size, `blurhash` or `thumbhash`       |
| `remote`      | none                           | `transformURL` for `image:` imports              |
| `concurrency` | the number of cores            | The most images that sharp handles at once       |

#### To decide

- Whether the plugin is part of `brumate/vite` or a package of its own, since sharp is a large dependency. A package of its own, `@brumate/image`, keeps it out of apps that do not use it.
- Whether `Image` is a part of `@brumate/ui` or of the image package.
- Art direction, with a `<source media>` for each crop.

Cost: about a week, with most of the plugin taken from `@solidjs/image`.

### Markdown with components

Markdown pages that can use brumate components and expressions, as mdsvex does for Svelte and MDX does for React. Content sites are mostly static, which is where resuming pays off most: a docs page ships no code unless a component on it has handlers.

- A `.md` page compiles to a `.brm` component. Front matter becomes its props or page metadata. Fenced code is highlighted at build time.
- The website already has a markdown plugin and live samples. They would become a general plugin that apps can use.

Cost: about 1 to 2 weeks, most of it for the parser integration, source maps and editor support.

## Website

### The home link

The home link in the header, on the docs and on `/ui`, is missing its icon. The placeholder circle was removed and nothing shows in its place, though `website/src/components/BrandMark.brm` has an SVG mark. Find why the mark does not show, then use it in the header, as the favicon, and on the home page.

### The shop demo on the home page

The list of bundles next to the shop demo shows every script the page loaded, including the site's own. `NETWORK_SCRIPT` in `website/src/scripts.ts` keeps each resource entry whose name looks like a script. It should show only the bundles that the shop needs, so the size it shows is the size of the shop.

### Syntax highlighting

`BLOCK_KEYWORDS` in `packages/brumate/src/highlight.ts` lacks `reveal` and `defer`, so `#reveal` and `#defer` are not highlighted. The list of the parser, in `packages/brumate/src/parser.ts`, has both.

- Take the list from one place, so the highlighter and the parser cannot differ.
- Check the rest of the grammar against the parser the same way.

### The error section on the home page

`.type-error` in `website/src/routes/index.brm` has a colored left border. The devtools dropped that style, and the home page should drop it too.

### The docs of @brumate/ui

The pages of the parts are bare next to Terracotta, React Aria and Headless UI. Each page needs:

- A table of the props, with their types, defaults and what they do.
- Examples of common uses.
- Controlled and uncontrolled use, side by side.
- Styling from the `data-*` attributes, with an example of each.
- The keyboard keys it handles, and what it does for accessibility.

Compare the pages of each part with those of the three libraries before writing them.

### A guide to props types

Other files need the props type of a component, such as a wrapper that passes props on, a story, or a test. A component can export it from `<script module>`, and its instance script uses it:

```brm
<script module>
  export interface ButtonProps {
    label: string;
    isDisabled?: boolean;
  }
</script>

<script>
  import { $props } from 'brumate/signals';

  const { label, isDisabled } = $props<ButtonProps>();
</script>
```

Another file then imports it with `import type { ButtonProps } from './Button.brm'`. Nothing documents this yet. A guide in `website/docs/typescript.md` should cover:

- Exporting the props type, and importing it in a `.brm`, a `.ts` and a test.
- That it works where the TypeScript plugin of brumate runs, in the editor and `brumate-tsc`. Plain `tsc` reads `.brm` imports through `declare module '*.brm'` and sees `any`.
- Extending the props of another component, such as a part that adds to the props of a `Button`.
- A generic component, whose props type takes its type parameter.

The parts of `@brumate/ui` export their props types the same way, so apps can use them, and the props tables of their pages can come from them.

### `$client` in markup that the browser renders

The docs of `$client` describe the triggers for a page that loads. They do not say when the callback runs for a component that the browser renders, such as in an `#if` that opens. Add a section to `website/docs/effects.md`:

- The callback runs after the markup is in the page, never during the render. The loader finds its template before the insert and starts it after, and the call goes through a promise, so it is not synchronous with the render.
- `'load'` runs right after the insert, usually before the next paint, or when its code loads if it has not.
- `'visible'` runs when its element enters the viewport, on the next frame at the soonest.
- `'idle'` runs when the browser is next idle.
- An element that it reads through `ref` is in the page when it runs.
- Each mount runs it again. Closing the block runs its cleanup, and opening it makes a new instance, whose callback runs once.
- A handler that opens the block cannot see what the callback set up, in the same run.

A test pins the order: the markup is in the page, then the callback runs, for each trigger.

### The code examples

The examples of the docs and of `@brumate/ui` need another pass:

- Use the features of the markup where they fit, such as the `{name}` and `{onClick}` shorthands, blocks, and `class={}` objects.
- Format the examples of `@brumate/ui`. Some are one long line, such as the `<Tree>` in `website/ui/tree.md`.
- Check that each example still works.

### A landing page for @brumate/ui

`/ui` opens on the introduction and the grid of cards. It needs a landing page of its own, as the home page of brumate has:

- What the parts are, and what makes them different: they resume, ship no code until used, and work without scripts where the platform allows.
- A few parts that people can use on the page.
- The links to start, to the parts, and to the design influences.

The introduction and the grid move to pages of their own.

## Order

Each step lists what it holds and why it comes there. A step can start before the one above it ends, when they touch different code.

1. **Caching**: done. Keys for calls that the browser sends again wait for the offline queue, and one render for all the holes of a prerendered page waits for a page with many.
2. **Streaming and tools**: reveal order, lists that grow in the browser and the devtools are done, except the history and a browser extension of the devtools, which wait for someone who needs them.
3. **The component workbench and the UI components**, together. The workbench shows only self-contained components, and `@brumate/ui` is its first user, starting with the `Select` spike. The UI components are the biggest project here.
4. **The website**: the fixes of the home link, the shop demo, the highlighting and the error section first, since they are small. Then the guide to props types, the docs and examples of `@brumate/ui`, and a landing page for it, before the parts are published.
5. **A smaller and faster client**, in the order of its steps, once the UI components of the phases that the website needs are in.
6. **Server components**: a spike that measures them against server functions, memos and `refresh`, with two cases of the website. Then the design of server components, `#server`, the render again, and children that keep their state.
7. **When an app or the website needs them**: named view transitions, Markdown with components, two-way realtime, worker functions, offline pages, embedding, long lists, observability. Persisted signals are a cookie and an effect.

Content mappers for TypeScript 7 are in #3, which is open, so they are in no step.

Ordered updates come before other work on the core. The tests show the cases.
