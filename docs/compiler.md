# Compiler

The compiler reads a `.brm` file and writes three things:

- A server module that renders the component to HTML with markers and state.
- Client chunks for the code that client roots reach.
- A render module that renders the component on the client, for parents whose blocks change.

## Pipeline

1. **Parse.** Read the file into its scripts, styles and a markup tree with blocks. The scanner and the template and control flow parsers of solid-sfc can be reused here.
2. **Scope analysis.** Find the declarations in each scope: props, signals, memos, functions and block variables.
3. **Graph.** Build the dependency graph from the reads of each node. Follow local functions. Props are live only if a parent can change them. See [Props across files](#props-across-files).
4. **Reachability.** Start at each client root. Mark every node, function and template that it reaches.
5. **Checks.** Report captures that cannot be serialized, writes outside client roots, and server function captures.
6. **Server codegen.** Write a render function that outputs HTML strings, markers and the state of the reachable scopes.
7. **Client codegen.** Write one chunk per handler, plus the update code and templates that the reachable nodes need.
8. **Render module.** Write the render function for the client. See [Render modules](#render-modules).

solid-sfc compiles markup to TSX as text. This compiler needs a tree for the markup and a graph for the scripts, so steps 3 to 8 are new.

## Output sketch

The server module is TypeScript. For the counter example in [Intermediate representation](./ir.md#example), it is:

```ts
import * as $$b from 'brumate/server';

export default async function Counter($$props: Record<string, never>, $$ctx: $$b.Context): Promise<string> {
  let $$html = '';
  const $$s1 = $$ctx.scope();
  const label = 'Clicks';
  let count = (0);
  const double = (count * 2);
  $$html += "<h1>" + await $$b.insert((label)) + "</h1><button data-b=\"" + $$s1 + ":0\" data-on=\"click=Counter_m86gta#h4\">+</button><p><!--t" + $$s1 + ":1-->" + await $$b.insert((count)) + "<!--/t--> / <!--t" + $$s1 + ":2-->" + await $$b.insert((double)) + "<!--/t--></p>";
  $$ctx.slots($$s1, [count, double]);
  return $$html;
}
```

- Compile-time functions become plain values. `$signal(0)` is `(0)`, and `$effect` and `$client` calls are removed.
- Static markup becomes string literals. Only live values get markers.
- The slots of a scope are recorded after its markup, so `ref` signals hold their elements.

`renderToString` from `brumate/server` runs the module and serializes the state. [Page format](./page-format.md) describes the markers and the state.

The client module for the same component:

```ts
import * as $$b from 'brumate/client';

const $$ctx = $$b.context;

export const id = "Counter_m86gta";
export const props = {  };
export const g = { 1: { 0: [[1, "m2"], [1, "u5"]], 1: [[1, "u6"]] } };

export const h4 = ($$s, ...$$a) => (() => $$b.update($$s, 0, 1, false))(...$$a);
export function m2($$s) {
  $$b.set($$s, 1, $$b.get($$s, 0) * 2);
}
export function u5($$s) {
  $$b.text($$s, 1, $$b.get($$s, 0));
}
export function u6($$s) {
  $$b.text($$s, 2, $$b.get($$s, 1));
}
```

- Reads of slots become `$$b.get(scope, slot)`, and writes become `$$b.set(scope, slot, value)`. A value in an outer scope is read through `.p`, such as `$$b.get($$s.p, 0)`.
- `h<n>` exports are event handlers and functions passed as props. `c<n>` exports are `$client` callbacks.
- `m<n>` exports compute memos, `u<n>` exports update text, attributes and props, `e<n>` exports run effects, and `b<n>` exports update blocks.
- `g` maps a scope kind and a slot to the exports that read it. The runtime calls them when the slot is written.
- `r<n>` exports render the body of a block on the client, with the same markers as the server. `a<n>` exports write a new item into a list item's scope, and `k<n>` exports render a `#client` block.
- Local functions become module functions that take the scope as their first argument. Server functions become `$$b.rpc` stubs.
- Only the imports that client code reads are kept.

## Render modules

A component that a parent renders inside a block that changes needs its render function on the client. The compiler writes it into a third module, the render module, which a bundler loads as `App.brm?brumate-render`.

- It is the server render function without `async`. The component's script runs, and the result is an HTML string with the same markers.
- The component's root scope gets its component ID, so the child's client module loads on its first event, as it does for a child that the server rendered.
- A function passed as a prop calls the parent's exported handler, so it writes the parent's slots.
- A parent's client module imports a child's render module only when one of its changing blocks renders the child. Other parents never load it.
- `#template`s that a changing block calls are copied into its render function.

## Props across files

Compiled alone, a component treats every prop as live. `analyzeProject` finds the props that can actually change, across every `.brm` file of a project:

1. Every prop starts out unchanged. Code outside `.brm` files renders components only on the server, so the props it passes are constants.
2. For each file, the graph is built with the props found so far. Its summary lists each component it renders and the props it passes values that can change. A spread or computed prop that can change counts as every prop.
3. Those props become live in the child. The steps repeat until nothing changes, because a parent's values can depend on its own props.

`compile` takes the result as `liveProps`. A prop that never changes needs no slot and no update code. A function passed as a prop never changes: it calls the parent's handler, which reads the current values.

The [Vite plugin](./vite.md) runs the analysis when the build starts and when a `.brm` file changes.

## Code splitting

The compiler splits each component's client code itself. It does not depend on another splitter or on the bundler.

| Part             | Holds                                                                      | Loads                                         |
| ---------------- | -------------------------------------------------------------------------- | --------------------------------------------- |
| Entry, `App.brm` | The component ID, the props map, the update table `g`, and `load(part)`    | On the first use of the component             |
| `h<n>`, `c<n>`   | One client root: an event handler, a function prop or a `$client` callback | On its event or trigger                       |
| `update`         | Memos, bindings, block updates, effects, list helpers and render functions | On the first write that reaches the component |
| `shared`         | Functions that more than one part calls, and the module script             | With the parts that import it                 |

- A local function that only one part calls goes into that part.
- Each part imports only what its code reads. Server function stubs are copied into each part that calls them.
- The core finds an export by its name: `h<n>` and `c<n>` are in the part of the same name, and everything else is in `update`.

A bundler loads a part as `App.brm?brumate-client&part=<name>`.

The [Vite plugin](./vite.md) connects the compiler to the dev server and the build. It serves the modules and maps server function IDs to their modules.

## Runtime

The runtime has two parts.

The loader, `brumate/loader`:

- Is the only code that runs before the first interaction.
- Listens to the events in `data-on` attributes on `document`, and walks from the target outwards.
- Applies event modifiers before anything loads.
- Adds the `<window>` and `<document>` listeners, and starts `$client` callbacks and `#client` blocks when their trigger fires.
- Preloads a component's module when the pointer is over one of its handlers.
- Imports the core and the component's module on the first event, and calls the handler.

```ts
import { start } from 'brumate/loader';

start({ load: (id) => import(`/assets/${id}.js`) });
```

The core, `brumate/client`, loads on the first event:

- Reads the state script and links scope instances to their parents.
- Writes slots and calls the updates in `g`.
- Finds elements by `data-b` and text and blocks by their comment markers.
- Renders block bodies, keeps the elements of list items whose keys stay, and removes the scopes of removed markup.
- Runs `$effect` and `$client` callbacks and their cleanups.
- Calls server functions with `fetch`, at `/_brumate/<id>` by default. `handleRPC` from `brumate/server` answers them. The code for these calls is a separate chunk that loads on the first call.

Handlers run after the event has finished dispatching, so the core passes them an event whose `currentTarget` is still the element.

Parts load in parallel, but handlers start in the order of their events. Typing and then submitting runs the input handler before the submit handler, even when the submit handler's part loads first.

## Size

Minified, measured on the test components:

| Code                                    | Size    | Gzip                |
| --------------------------------------- | ------- | ------------------- |
| Loader                                  | 1783 B  | 892 B               |
| Core, with seroval                      | 33065 B | 10413 B             |
| Counter: entry, `h4`, `update`          |         | 185 B, 110 B, 132 B |
| Todo list: entry, `h12`, `update`       |         | 219 B, 157 B, 483 B |
| List of child components, client module | 2105 B  | 954 B               |
| Child render module                     | 368 B   | 266 B               |

The loader is the only code that loads before an interaction. The core loads once, on the first event. Most of its size is seroval's deserializer and serializer.

Splitting costs a little on small components. Toggling a todo loads 859 B in three requests, where one module was 772 B. It pays off on components with many handlers, because an event loads only its own handler.

## Dependencies

- [seroval](https://github.com/lxsmnsyc/seroval) for serialization.
- [oxc-parser](https://github.com/oxc-project/oxc) for the scripts, as in solid-sfc.
