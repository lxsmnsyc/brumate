# Effects and browser code

A component renders on the server, so its script never runs in the browser. To run code in the browser, use a handler, `$effect`, `$client` or a `#client` block. Each one starts at a different time.

## `$effect`

`$effect(callback)` runs the callback in the browser when a value that it reads changes:

```brm live
<script>
  import { $effect, $signal } from 'brumate/signals';

  let count = $signal(0);
  let message = $signal('The effect has not run yet.');

  $effect(() => {
    message = `The effect ran when count became ${count}.`;
  });
</script>

<button onClick=(() => count++)>Clicked {count} times</button>
<p>{message}</p>
```

- An effect never runs when the page loads. Its first run is after the first change of a value it reads. The server already rendered the page with the current values, so there is nothing to catch up on.
- It never runs on the server.
- It can write signals. After a change, effects run after the page has updated, once each.
- In a hidden [`#offscreen`](./control-flow.md#offscreen) body, it does not run. Its cleanup runs when the body hides, and it runs again when the body shows.

For code that must run when the page loads, use [`$client`](#client).

### Cleanup

The callback can return a function. It runs before the next run of the effect, and when the component is removed from the page:

```brm live
<script>
  import { $effect, $signal, $untrack } from 'brumate/signals';

  let running = $signal(false);
  let seconds = $signal(0);

  $effect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(() => {
      $untrack(seconds++);
    }, 1000);
    return () => clearInterval(timer);
  });
</script>

<button onClick=(() => (running = !running))>{running ? 'Stop' : 'Start'}</button>
<p>{seconds} seconds</p>
```

Stopping writes `running`, so the effect runs again. Its cleanup clears the timer of the last run first.

### Effects depend on the functions they call

An effect depends on every value that it reads. That includes values read in the functions that it calls, and in callbacks that it creates, such as the timer above. This is why the timer uses `$untrack(seconds++)`: without it, the effect would depend on `seconds` and restart the timer every second.

A function that writes a signal it also reads is the common mistake:

```brm
<script>
  import { $effect, $signal } from 'brumate/signals';

  let query = $signal('');
  let saves = $signal(0);

  function save() {
    // Reads and writes `saves`.
    saves++;
  }

  // Depends on `query`, and on `saves` through `save`.
  $effect(() => {
    void query;
    save();
  });
</script>
```

The effect depends on `saves`, so each save runs the effect again. Call such functions inside `$untrack`, which reads without depending on anything inside:

```brm live
<script>
  import { $effect, $signal, $untrack } from 'brumate/signals';

  let query = $signal('');
  let saves = $signal(0);

  function save() {
    saves++;
  }

  $effect(() => {
    void query;
    $untrack(save());
  });
</script>

<label>
  Query
  <input value=query onInput=((event) => (query = event.currentTarget.value))>
</label>
<p>Saved {saves} times</p>
```

[`brumate inspect`](./inspect.md) shows what each effect depends on, as `reads signal query`.

## Values that stay across visits

A preference such as the theme, a dismissed banner or the width of a panel belongs in a cookie. The server reads it, so the first render has the right value, and an `$effect` writes it when the value changes:

```brm
<script>
  import { getEvent } from 'brumate/server';
  import { $effect, $signal } from 'brumate/signals';

  let theme = $signal(getEvent().getCookie('theme') ?? 'light');

  $effect(() => {
    document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  });
</script>

<div class="page" data-theme=theme>
  <button onClick=(() => (theme = theme === 'dark' ? 'light' : 'dark'))>Theme</button>
</div>
```

- The page renders with the stored value, so nothing changes after it loads.
- The effect never runs on load. It runs on the first change.
- Encode a value that can hold `;`, `,` or spaces with `encodeURIComponent`, and decode it where you read it.
- A server function can set the cookie too, with `event.setCookie`, when the server should check the value. See [Cookies and sessions](./server-functions.md#cookies-and-sessions).

`localStorage` and `sessionStorage` work, but the server cannot read them. The page renders the default first, and the browser has to run code on load to read the stored value, so the page changes after it shows, and every page that does it loads code before anyone interacts. Keep them for values that the first render does not show.

## Element references

`ref=$bind(name)` on an element writes the element into the signal `name`, so browser code can use it:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let input = $signal<HTMLInputElement>();
</script>

<label>
  Email
  <input ref=$bind(input) type="email">
</label>
<button onClick=(() => input!.focus())>Focus the field</button>
```

- `ref` always takes `$bind`. A bare name, as in `ref=input`, is a compile error.
- The name must be a `$signal` declared in the same file, or a prop that the component destructures with `let` and types as `Bindable`. The prop forwards the element to the caller.
- A dynamic tag takes `ref` too, such as `<{as} ref=$bind(panel)>`. The signal gets the element that the tag renders. When the tag names a component, the component gets the binding as its `ref` prop, and writes the element if it forwards it.
- A component forwards `ref` by declaring it as a `Bindable` prop and writing `ref=$bind(ref)` on an element. See [Forwarding a ref](./components.md#forwarding-a-ref).
- On the server, the signal is `undefined`. Read it in handlers, effects and `$client` callbacks.
- An element that the browser creates later, such as a new item of a `#for`, writes the signal when it is created.

## `$client`

`$client(callback, trigger)` runs the callback in the browser once, when the trigger fires. It does not wait for a change:

```brm live
<script>
  import { $client, $signal } from 'brumate/signals';

  let width = $signal<number>();

  $client(() => {
    const measure = () => {
      width = window.innerWidth;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });
</script>

<p>The window is {width ?? 'not measured yet'} pixels wide.</p>
```

| Trigger     | Runs when                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `'visible'` | The element that the callback reads through `ref` enters the viewport, or else the first element of the component. This is the default. |
| `'idle'`    | The browser is idle after the page loads.                                                                                               |
| `'load'`    | The page loads.                                                                                                                         |

- The callback can return a cleanup function. It runs when the component is removed from the page.
- `'load'` runs the callback as soon as the page loads, before anyone interacts with it. The compiler warns about it: prefer `'visible'` or `'idle'`.
- Use `$client` for browser APIs that the server does not have, such as `window`, `localStorage` or a chart library.
- With `'visible'`, a callback that reads an element of the same markup through `ref` waits for that element, so a chart low on the page renders when the chart comes into view. See [Behaviors of an element](#behaviors-of-an-element).

## `#client` blocks

A `#client` block skips its body on the server. The browser renders it when the trigger fires, with the same triggers as `$client`:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let clicks = $signal(0);
</script>

<p>Rendered on the server.</p>
#client ('idle') {
  <p>Rendered in the browser, with a time zone of {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
  <button onClick=(() => clicks++)>Clicked {clicks} times</button>
}
```

Use it for markup that needs the browser, such as a map or a value from `localStorage`. The page shows nothing in its place until the block renders.

An `#else` body renders on the server in place of the body, until the body renders:

```brm live
#client ('idle') {
  <p>Your time zone is {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
} #else {
  <p>Finding your time zone…</p>
}
```

- The fallback can keep the space of the body, so the page does not move when the body renders.
- With `'visible'`, the block renders when the fallback comes into view.
- Without scripts, the fallback stays.

## Behaviors of an element

A behavior that belongs to an element, such as a click outside, a field that grows with its text, or a chart, is a plain function that takes the element and returns its cleanup. A component gives it the element with `ref` and runs it with `$client`:

```ts
// behaviors.ts
export function clickOutside(element: HTMLElement, onOutside: () => void): () => void {
  const listener = (event: PointerEvent) => {
    if (!element.contains(event.target as Node)) {
      onOutside();
    }
  };
  document.addEventListener('pointerdown', listener);
  return () => document.removeEventListener('pointerdown', listener);
}
```

```brm
<script>
  import { $client, $signal } from 'brumate/signals';
  import { autosize, clickOutside } from './behaviors.ts';

  let open = $signal(true);
  let menu = $signal<HTMLElement>();
  let field = $signal<HTMLTextAreaElement>();

  $client(() => clickOutside(menu!, () => (open = false)));
  $client(() => autosize(field!));
</script>

<div class="menu" ref=$bind(menu) hidden=(!open)>…</div>
<textarea ref=$bind(field)></textarea>
```

- Each `$client` is a client root of its own, so each behavior runs when its element comes into view.
- The cleanup runs when the component leaves the page.
- An element of each item of a `#for` gets its own behavior from a script in the body of the `#for`.
- The server renders the element, so a behavior only adds to it, and the element works as plain HTML without scripts.

## Which one to use

| You want to                                              | Use                             |
| -------------------------------------------------------- | ------------------------------- |
| Respond to something the user does                       | A handler, such as `onClick`    |
| Run code when a value changes                            | `$effect`                       |
| Run code when the page loads, or when it comes into view | `$client`                       |
| Render markup that needs the browser                     | `#client`                       |
| Reach an element from browser code                       | `ref=$bind(name)`               |
| Add a behavior to an element                             | `ref=$bind(name)` and `$client` |

Handlers are often enough. A value that a handler writes updates the page by itself, so an effect is only needed for work outside the page, such as saving to `localStorage` or talking to a library.

## Errors in the browser

Code that runs in the browser can throw: a handler, the promise that an async handler returns, an effect, a `$client` callback, or a memo whose load rejects. The error goes to the nearest `#try` around the scope that the code belongs to, which renders its `#catch` body with the error and `reset`:

```brm
#try {
  <button onClick=(async () => { await save(); })>Save</button>
} #catch (error, reset) {
  <p>{String(error)}</p>
  <button onClick=reset>Try again</button>
}
```

- Without a `#try` around it, the page gets a `brumate:error` event on `window`, with `error` and the `scope` of the code in `detail`, and the error is logged. An app can report it from there.
- `onError(error, info)` of the loader receives every error first, such as for a reporting service, also the ones that a `#try` catches. `info.scope` is the ID of the scope of the code.
- A memo that fails keeps its old value, as before. A handler that throws stops there.
