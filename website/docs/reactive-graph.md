# Reactive graph

The compiler decides what ships to the browser from a graph of what reads what, which it builds once, when it compiles. This page first follows one component from its source to a click that updates the page. The sections after it describe each part in detail.

## Step by step

This section follows one component from its source to a click that updates the page:

```brm
<script>
  import { $memo, $signal } from 'brumate/signals';

  const label = 'Clicks';
  let count = $signal(0);
  const double = $memo(count * 2);
</script>

<h1>{label}</h1>
<button onClick=(() => count++)>+</button>
<p>{count} / {double}</p>
```

### 1. The compiler builds the graph

Each declaration and each read in the markup is a node. An edge goes from a value to each node that reads it:

```text
onClick (client root) --writes--> count
count  --> double
count  --> {count}
double --> {double}
label  --> {label}
```

The graph is built once, when the file compiles. The browser never builds it.

### 2. The compiler finds what can change

It starts at each client root and follows the edges:

- The click handler writes `count`, so `count` can change in the browser.
- `double` and `{count}` read `count`, so they can change too. `{double}` reads `double`, so it can change.
- Nothing writes `label`, and no root reaches it. It is a constant, so `<h1>Clicks</h1>` ships as HTML only.

Only the nodes that a root reaches get a slot in the page state and code in the browser.

### 3. The server renders HTML with markers

The server module renders the component as strings. Live values get slots, and the markup around them gets markers:

```ts
const $$s1 = $$ctx.scope(1, undefined, "Counter_24o7ge");
const label = 'Clicks';
let count = (0);
const double = (count * 2);
$$html += "<h1>" + … + "</h1><button b-b=\"" + $$s1 + ":0\" b-on=\"click=Counter_24o7ge#h4\">+</button><p><!--t" + $$s1 + ":1-->" + $$b.insert((count)) + "<!--/t--> / <!--t" + $$s1 + ":2-->" + $$b.insert((double)) + "<!--/t--></p>";
$$ctx.slots($$s1, [count, double], ["count", "double"]);
```

- `$$ctx.scope(1, …)` makes a scope for this instance. `1` is its kind, and the page numbers the instance.
- `count` is slot 0 and `double` is slot 1. `label` has no slot.
- On the server, the memo is plain code that runs once. It does not track anything.

The HTML of the page:

```html
<h1>Clicks</h1>
<button b-b="0:0" b-on="click=Counter_24o7ge#h4">+</button>
<p><!--t0:1-->0<!--/t--> / <!--t0:2-->0<!--/t--></p>
```

- `b-b="0:0"` is element 0 of scope 0. `b-on` names the event and the handler that answers it: export `h4` of the component `Counter_24o7ge`.
- `<!--t0:1-->` and `<!--t0:2-->` mark text 1 and text 2 of scope 0, so the browser can find them without rendering again.

### 4. The server writes the state

The slots go into the page as a script:

```html
<script b-state b-scopes b-next="1">…$bR(($R,$b)=>(({0:{k:1,m:"Counter_24o7ge",s:[0,0]}})))</script>
```

- Scope `0` has kind `k: 1`, the module `m` of its component, and its slots `s`: `count` and `double`.
- [seroval](https://github.com/lxsmnsyc/seroval) writes the values as code, so dates, maps, sets, shared references and promises keep their types. A promise that has not settled streams in a later script. See [Serialization](./reference-serialization.md).
- The value of `double` is in the state, so the browser does not compute it again to resume.
- A page with many scopes of the same shape, such as the items of a list, packs them into groups. See [Page format](./page-format.md).

### 5. The browser waits

The page shows before any component code runs. The loader listens on `document` for the events that `b-on` names, and imports the core and the client entry of `Counter_24o7ge` at once. See [Client modules](./client-modules.md).

### 6. A click runs the handler

The client entry exports the exports of each part:

```ts
export * from "./Counter.brm?brumate-client&part=h4";
export * from "./Counter.brm?brumate-client&part=update";
export const g = { 1: { 0: [[1, "m2"], [1, "u5"]], 1: [[1, "u6"]] } };
```

- `g` is the graph of step 1, kept for the browser. For scopes of kind 1, a write to slot 0 runs `m2` and `u5`, and a write to slot 1 runs `u6`.

The core reads the state script and makes scope 0, with its slots `[0, 0]`. On the click, the loader walks from the target to the element with `b-on`, and reads `b-b="0:0"`. The core calls the handler with that scope:

```ts
export const h4 = ($$s) => $$b.update($$s, 0, 1, false);
```

`count++` became `update(scope, slot 0, +1)`. Reads of slots become `get(scope, slot)` and writes become `set(scope, slot, value)`.

### 7. The write runs the code that reads it

`set` stores the new value in slot 0, and queues each entry of `g[1][0]`. A queued update waits once, however many slots it reads change. Then the write runs what waits:

```ts
export function m2($$s) {
  $$b.memo($$s, 1, () => $$b.get($$s, 0) * 2);
}
export function u5($$s) {
  $$b.text($$s, 1, $$b.get($$s, 0));
}
export function u6($$s) {
  $$b.text($$s, 2, $$b.get($$s, 1));
}
```

1. The memos first, in the order they are declared, each once. `m2` computes `double` and writes it to slot 1. That write queues `g[1][1]`, which is `u6`.
2. Then the bindings, each once, in the order they were queued: `u5` sets text 1 to `1`, and `u6` sets text 2 to `2`.
3. Then the effects, if any read the slots.

The memos and bindings of a component run before those of the components inside it, so a child gets every new prop and context value before its memos compute. The effects of a child run before those of its parent. All of it runs before `set` returns, so code that writes `count` and then reads `double` reads the new value.

The page shows `1 / 2`. Nothing else ran: the heading, the button and the rest of the page were not touched.

- A write runs only the entries of the slots it changes, so its cost does not grow with the size of the component.
- An entry for another kind, such as the items of a list that read a slot of the list's scope, runs on each scope of that kind inside the one that was written.
- A write of the same value, by `Object.is`, runs nothing.
- Effects wait until the other updates of a write have run, and run once each.

### Names of the exports

- `h<n>` are event handlers and function props, and `c<n>` are `$client` callbacks.
- `m<n>` compute memos, `u<n>` update text, attributes and props, `e<n>` run effects, and `b<n>` update blocks.
- `r<n>` render the body of a block, `a<n>` write a new list item into its scope, and `k<n>` render a `#client` block.
- Local functions become module functions that take the scope as their first argument. Server functions become stubs that call the server.
- A value of an outer scope is read through the parent of the scope, `.p`.

## Pipeline

1. **Parse.** Read the file into its scripts, styles and a markup tree with blocks.
2. **Scopes.** Find the declarations of each scope: props, signals, memos, functions and block variables.
3. **Graph.** Build the edges from the reads of each node, following local functions.
4. **Reachability.** Start at each client root, and mark every node, function and template that it reaches.
5. **Checks.** Report writes outside client roots, server functions that capture component values, and misused compile-time functions.
6. **Server code.** Write a function that renders HTML strings with markers, and records the state of the reachable scopes.
7. **Client code.** Write one part per client root, and the update code that the reachable nodes need.
8. **Render module.** Write a render function for the browser, for parents whose blocks render the component again.

## Nodes and edges

The graph is static. The runtime records no subscriptions.

- A node is a `$signal`, a `$memo`, a prop, a binding in the markup, a block condition or list, an attribute, a `<title>`, a `$setContext` value, or a `$effect`.
- An edge goes from a node to every node that reads it by name.
- A read inside a local function counts for every site that calls the function, and for the functions that it calls in turn.
- `$untrack(expression)` reads without an edge. A call inside it, such as `$untrack(save())`, adds no edges for what the function reads either.
- A memo or binding is live when something upstream of it can change in the browser. Only live nodes get client code.

When a client root writes a signal, the runtime looks up the nodes that read that slot and runs their updates in order. It needs the edges of that signal only, not the whole component.

## What ships for each node

| Node                                                     | Ships when                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `$signal`                                                | A client root writes it. Its value is in the page state.                                                              |
| `$memo`                                                  | Something upstream can change in the browser. Its value is in the page state, so it does not compute again on resume. |
| `$memo` of a promise                                     | Something upstream can change. It runs again in the browser, and keeps its old value until the promise settles.       |
| A memo that calls a server function that `refresh` names | Always, so it can load again after a call.                                                                            |
| Markup binding, such as `{count}`                        | Its source can change in the browser.                                                                                 |
| `#if`, `#switch`, `#key`                                 | Its condition can change. Then the bodies of its branches ship.                                                       |
| `#for`, `#repeat`                                        | Its list or count can change. Then the body of an item ships.                                                         |
| Static text and elements                                 | Never. They are HTML only.                                                                                            |

A signal that no client root writes is a constant after the server renders it, and is not sent.

## Client roots

The compiler starts at each client root and follows what it reads, writes and calls:

- Event handlers on elements, and `<window>` and `<document>` listeners.
- `$effect` and `$client` callbacks.
- Functions passed as props to components.
- The code that renders a block that the browser must render again.

Everything a root reaches ships. Everything else stays on the server.

## Props across files

Compiled alone, a component treats every prop as live. `analyzeProject` finds the props that can actually change, across every `.brm` file of a project:

1. Every prop starts out unchanged. Code outside `.brm` files renders components only on the server, so the props it passes are constants.
2. Each file's graph is built with the props found so far. Its summary lists the components it renders, and the props it passes values that can change. A spread or computed prop that can change counts as every prop.
3. Those props become live in the child. The steps repeat until nothing changes, because a parent's values can depend on its own props.

A prop that never changes needs no slot and no update code. A function passed as a prop never changes: it calls the parent's handler, which reads the current values. The Vite plugin runs the analysis when the build starts and when a `.brm` file changes.

## Scopes

A scope holds the state of one instance:

- Each component instance is a scope.
- Each body of a block with its own `<script>` or with live values is a scope, such as each item of a `#for`.
- A `#template` call is a scope when its body has live values.

Each scope that client code needs gets a number at render time, unique in the page. Elements with handlers name their scope in an attribute, so a handler finds its state. [Page format](./page-format.md) describes the numbers and markers.

A scope also has a kind: its number in the compiled component, which selects the update code that applies to it. The page state records it as `k`.

## Render modules

A component that a parent renders inside a block that changes needs its render function in the browser. The compiler writes it into a third module, `App.brm?brumate-render`.

- It is the server render function without `async`. The result is an HTML string with the same markers.
- The component's root scope gets its component ID, so its client module loads when its scope is made, as it does for a component that the server rendered.
- A function passed as a prop calls the parent's handler, so it writes the parent's slots.
- A parent imports a child's render module only when one of its changing blocks renders the child.
- `#template`s that a changing block calls are copied into its render function.
