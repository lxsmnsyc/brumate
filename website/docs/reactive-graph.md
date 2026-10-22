# Reactive graph

The compiler decides what ships to the browser from a graph of what reads what, which it builds once, when it compiles. This page describes the graph, how the compiler walks it, and the code that comes out.

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

## The code that comes out

For this component:

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

The server module renders strings, and records the slots of the scope:

```ts
export default async function Counter($$props: Record<string, never>, $$ctx: $$b.Context): Promise<string> {
  let $$html = '';
  const $$s1 = $$ctx.scope(1, undefined, "Counter_24o7ge");
  const label = 'Clicks';
  let count = (0);
  const $$p_double = $$b.memo(() => (count * 2));
  const double = await $$b.wait($$p_double);
  $$html += "<h1>" + await $$b.insert((label), $$ctx, $$s1) + "</h1><button b-b=\"" + $$s1 + ":0\" b-on=\"click=Counter_24o7ge#h4\">+</button><p><!--t" + $$s1 + ":1-->" + await $$b.insert((count), $$ctx, $$s1) + "<!--/t--> / <!--t" + $$s1 + ":2-->" + await $$b.insert((double), $$ctx, $$s1) + "<!--/t--></p>";
  $$ctx.slots($$s1, [count, double]);
  return $$html;
}
```

- `label` is a constant, so it is plain HTML, and it is not sent.
- `count` and `double` are slots 0 and 1 of the scope. Their inserts have markers.

The client entry maps each slot to the code that reads it, and loads the parts on demand:

```ts
export const id = "Counter_24o7ge";
export const props = {  };
export const g = { 1: { 0: [[1, "m2"], [1, "u5"]], 1: [[1, "u6"]] } };
const parts = {
  "h4": () => import("./Counter.brm?brumate-client&part=h4"),
  "update": () => import("./Counter.brm?brumate-client&part=update"),
};
export function load(part) {
  return parts[part]();
}
```

The handler part and the update part:

```ts
// h4
export const h4 = ($$s) => $$b.update($$s, 0, 1, false);

// update
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

- Reads of slots become `$$b.get(scope, slot)`, and writes become `$$b.set(scope, slot, value)`. A value of an outer scope is read through `.p`.
- `g` maps a scope kind and a slot to the exports that read it. Writing slot 0 runs `m2` and `u5`, and `m2` writing slot 1 runs `u6`.
- `h<n>` exports are event handlers and function props. `c<n>` are `$client` callbacks. `m<n>` compute memos, `u<n>` update text, attributes and props, `e<n>` run effects, and `b<n>` update blocks. `r<n>` render the body of a block, `a<n>` write a new list item into its scope, and `k<n>` render a `#client` block.
- Local functions become module functions that take the scope as their first argument. Server functions become stubs that call the server.

[Client modules](./client-modules.md) describes how the parts load.

## Render modules

A component that a parent renders inside a block that changes needs its render function in the browser. The compiler writes it into a third module, `App.brm?brumate-render`.

- It is the server render function without `async`. The result is an HTML string with the same markers.
- The component's root scope gets its component ID, so its client module loads on its first event, as it does for a component that the server rendered.
- A function passed as a prop calls the parent's handler, so it writes the parent's slots.
- A parent imports a child's render module only when one of its changing blocks renders the child.
- `#template`s that a changing block calls are copied into its render function.
