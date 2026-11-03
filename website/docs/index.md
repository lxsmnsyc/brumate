# Introduction

brumate is a component language and a compiler for web apps that resume instead of hydrating. Pages arrive as HTML with their state in them, and the browser loads the code of the page without running the components again.

## A component

Components are `.brm` files. A `<script>` declares state, and the markup reads it. This one runs in the page. Click the button, then edit the code:

```brm live
<script>
  import { $memo, $signal } from 'brumate/signals';

  let count = $signal(0);
  const double = $memo(count * 2);
</script>

<button onClick=(() => count++)>Clicked {count} times</button>
<p>Double: {double}</p>
```

- `$signal` declares a value that can change. Assigning to `count` updates every place that reads it.
- `$memo` declares a value computed from other values. `double` follows `count`.
- `{count}` inserts a value into the markup. `onClick` runs code when the button is clicked.

## Resuming instead of hydrating

Most frameworks hydrate. The server renders HTML, then the browser downloads the code of every component and runs it again to rebuild the state and attach event listeners. The page cannot respond until that is done, and all component code ships, even code that only ever renders once.

brumate resumes:

- The server renders the page and writes its state into the HTML.
- The browser loads a small loader, which loads the core and the code of the components on the page.
- The core reads the state from the page and continues from there. An event that comes before the code has loaded waits for it.
- No component runs again in the browser to rebuild what the server rendered.

## What happens on a click

For the counter above:

1. The server renders the button and the paragraph, and writes `count` and `double` into the page.
2. The page is ready. The browser loads the core and the client code of the page at start, in one bundle: the click handler and the updates of the two texts.
3. The click runs the handler. A click that comes before the code has loaded waits for it.
4. The handler adds one to `count`. The texts that read `count` and `double` update.

The compiler decides what each event needs when it compiles the component:

- A value that only the server reads is never sent to the browser.
- Markup that never changes ships as HTML only.
- Only the code that runs in the browser ships: event handlers, effects and the updates of markup that changes.
- A function marked `'use server'` runs on the server. In the browser it becomes a call to the server.

[What runs where](./what-runs-where.md) explains these rules in detail.

## Next

- [Getting started](./getting-started.md) sets up a project.
- [Your first app](./tutorial.md) builds a todo app step by step.
- [Components](./components.md) describes the parts of a `.brm` file.
