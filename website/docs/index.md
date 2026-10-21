# Introduction

brumate is a component language and a compiler for web apps that resume instead of hydrating.

A brumate page arrives as HTML with its state written into it. The browser loads a small loader and nothing else. When an event fires, the loader loads the code for that event, and the code picks up from the state in the page. No component runs again in the browser to rebuild what the server already rendered.

The name comes from brumation: reptiles stay still through the cold, and move again where they stopped when it warms.

## A component

Components are `.brm` files. A script declares state, and the markup reads it.

```html
<script>
  import { $memo, $signal } from 'brumate/signals';

  let count = $signal(0);
  const double = $memo(count * 2);
</script>

<button onClick=(() => count++)>Clicked {count} times</button>
<p>Double: {double}</p>
```

- The server renders the button and the paragraph with `count` and `double`, and writes both values into the page.
- The browser loads the loader only. A click on the button loads the handler and the code that updates the two texts, and nothing else.
- Markup that never changes ships as HTML only.

## What the compiler decides

The compiler builds the graph of what reads what, once, when it compiles. From the graph it knows which values can change in the browser, which markup reads them, and which code an event can reach.

- A value that only the server reads is not sent to the browser.
- A handler is its own module, loaded when its event fires, or earlier when the pointer is over its element.
- A function that runs on the server, marked with `'use server'`, becomes a call to the server in the browser.

## Next

- [Getting started](./getting-started.md) sets up a project.
- [Syntax](./syntax.md) describes the file format, the markup and control flow.
- [Execution model](./model.md) explains what runs where.
