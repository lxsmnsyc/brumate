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

| Trigger     | Runs when                                                                    |
| ----------- | ---------------------------------------------------------------------------- |
| `'visible'` | The first element of the component enters the viewport. This is the default. |
| `'idle'`    | The browser is idle after the page loads.                                    |
| `'load'`    | The page loads.                                                              |

- The callback can return a cleanup function. It runs when the component is removed from the page.
- `'load'` makes the browser load the code with the page, before anyone interacts with it. The compiler warns about it: prefer `'visible'` or `'idle'`.
- Use `$client` for browser APIs that the server does not have, such as `window`, `localStorage` or a chart library.

## `#client`

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

## Element references

`ref=name` on an element writes the element into the signal `name`, so browser code can use it:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let input = $signal<HTMLInputElement>();
</script>

<label>
  Email
  <input ref=input type="email">
</label>
<button onClick=(() => input!.focus())>Focus the field</button>
```

- The signal must be a `$signal` declared in the same file.
- On the server, the signal is `undefined`. Read it in handlers, effects and `$client` callbacks.
- An element that the browser creates later, such as a new item of a `#for`, writes the signal when it is created.

## Which one to use

| You want to                                              | Use                          |
| -------------------------------------------------------- | ---------------------------- |
| Respond to something the user does                       | A handler, such as `onClick` |
| Run code when a value changes                            | `$effect`                    |
| Run code when the page loads, or when it comes into view | `$client`                    |
| Render markup that needs the browser                     | `#client`                    |
| Reach an element from browser code                       | `ref=name`                   |

Handlers are often enough. A value that a handler writes updates the page by itself, so an effect is only needed for work outside the page, such as saving to `localStorage` or talking to a library.
