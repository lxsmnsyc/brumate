# What runs where

A component runs once, on the server. The browser gets the HTML and the values that its code needs, and runs only the code of what the user does. This page explains which code that is, and what that means for the values you use.

## The server renders, the browser resumes

- The server runs the script of each component once, and renders the page with the values it computed.
- The page arrives as HTML, with the values that browser code needs written into it.
- The browser loads a small loader and nothing else. No component runs again in the browser to rebuild what the server rendered.
- When the user does something, such as a click, the loader loads the code for that event and runs it with the values in the page.

So the script of a component is server code. A `console.log` at the top of a script prints in the terminal of the server, not in the browser.

## Client roots

Code runs in the browser only when it starts from one of these:

- An event handler, such as `onClick`, and `<window>` or `<document>` listeners.
- An `$effect` callback.
- A `$client` callback, and the body of a `#client` block.
- A function passed as a prop to a component, such as `onChange=((value) => (count = value))`.
- Markup that the browser must render again, such as the body of an `#if` whose condition can change, or a new item of a `#for`.

The compiler starts at each of these and follows what it reads, writes and calls. What it reaches goes to the browser. Everything else stays on the server.

```brm live
<script>
  import { $memo, $signal } from 'brumate/signals';

  // Server only: no browser code reads these.
  const items = ['apple', 'banana', 'cherry'];
  const heading = `${items.length} fruits`;

  // Sent to the browser: the handler writes `count`, and `label` reads it.
  let count = $signal(0);
  const label = $memo(`Picked ${count} times`);
</script>

<h2>{heading}</h2>
<ul>
  #for (item of items by item) {
    <li>{item}</li>
  }
</ul>
<button onClick=(() => count++)>{label}</button>
```

Open the Compiled tab of the sample: the browser code updates `label`, and has nothing for the list.

## What goes to the browser

| In the component                  | Goes to the browser when                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A `$signal`                       | Browser code writes it. Its value is sent with the page.                                             |
| A `$memo`                         | A value it reads can change in the browser. Its value is sent, so it does not compute again on load. |
| A `$memo` of a promise            | A value it reads can change in the browser. It runs again in the browser then.                       |
| `{value}` in markup, an attribute | Its value can change in the browser. The code that updates it is sent.                               |
| `#if`, `#switch`, `#key`          | Its condition can change in the browser. The markup of its branches is sent.                         |
| `#for`, `#repeat`                 | Its list or count can change in the browser. The markup of an item is sent.                          |
| Other text and elements           | Never. They stay HTML.                                                                               |
| A server function                 | Never. The browser gets a function that calls the server.                                            |

A signal that no browser code writes keeps its server value. The page shows it as HTML, and the browser never gets it.

Code also loads in small pieces. Each handler loads when its event first fires, or a little earlier when the pointer moves over its element. See [Client modules](./client-modules.md) for how the code is split.

## Values that browser code reads

Browser code can read values of the script, such as a constant that a handler uses. Those values are sent with the page, so they must be values that brumate can send:

- Primitives, plain objects and arrays, `Date`, `Map`, `Set`, `URL` and typed arrays. Shared and cyclic references are kept.
- Promises, which can settle after the page arrives.
- Elements of the page, such as a `ref`, and browser functions, such as handlers and functions passed as props.

[Serializable values](./reference-serialization.md) has the full list. Functions, class instances and regular expressions cannot be sent.

`brumate-tsc` checks the signals and memos that are sent, and reports a value that cannot be:

```
Argument of type '(value: number) => string' is not assignable to parameter of type '… & { 'A function cannot be sent to the client. Keep it out of the signal or memo': never; }'.
```

Other values, such as a constant that a handler reads, are not checked yet. One that cannot be sent makes the page fail when it renders, with a serialization error.

## Keeping code on the server

- Do the work in a [server function](./server-functions.md), and call it from the browser. Its body, and what it imports, never goes to the browser.
- Read server data while the component renders, such as `const user = $memo(getUser(id))`, and let the browser receive only the result.
- Keep secrets and server clients, such as a database, in modules that only server functions import.
- A value in `<script module>` is shared by every instance of the component, and browser code that reads it imports it as code. Do not put server-only values there.
- An imported function that browser code calls goes to the browser with its module. Import server-only modules only from server functions and the setup of the script.

[The reactive graph](./reactive-graph.md) describes the full model that the compiler uses to decide.
