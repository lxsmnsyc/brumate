# Compiler

The compiler reads a `.brm` file and writes three things:

- A server module that renders the component to HTML with markers and state.
- Client chunks for the code that client roots reach.
- A render module that renders the component on the client, for parents whose blocks change.

## Pipeline

1. **Parse.** Read the file into its scripts, styles and a markup tree with blocks.
2. **Scope analysis.** Find the declarations in each scope: props, signals, memos, functions and block variables.
3. **Graph.** Build the dependency graph from the reads of each node. Follow local functions. Props are live only if a parent can change them. See [Props across files](#props-across-files).
4. **Reachability.** Start at each client root. Mark every node, function and template that it reaches.
5. **Checks.** Report captures that cannot be serialized, writes outside client roots, and server function captures.
6. **Server codegen.** Write a render function that outputs HTML strings, markers and the state of the reachable scopes.
7. **Client codegen.** Write one chunk per handler, plus the update code and templates that the reachable nodes need.
8. **Render module.** Write the render function for the client. See [Render modules](#render-modules).

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
  $$html += "<h1>" + await $$b.insert((label)) + "</h1><button b-b=\"" + $$s1 + ":0\" b-on=\"click=Counter_m86gta#h4\">+</button><p><!--t" + $$s1 + ":1-->" + await $$b.insert((count)) + "<!--/t--> / <!--t" + $$s1 + ":2-->" + await $$b.insert((double)) + "<!--/t--></p>";
  $$ctx.slots($$s1, [count, double]);
  return $$html;
}
```

- Compile-time functions become plain values. `$signal(0)` is `(0)`, and `$effect` and `$client` calls are removed.
- Static markup becomes string literals. Only live values get markers.
- The slots of a scope are recorded after its markup, so `ref` signals hold their elements.

`renderToStream` from `brumate/server` runs the module, serializes the state and streams the page. [Page format](../website/docs/page-format.md) describes the markers and the state.

The client module for the same component:

```ts
import * as $$b from 'brumate/client';

const $$ctx = $$b.context;

export const id = "Counter_m86gta";
export const props = {  };
export const g = { 1: { 0: [[1, "m2"], [1, "u5"]], 1: [[1, "u6"]] } };

export const h4 = ($$s) => $$b.update($$s, 0, 1, false);
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
- Local functions become module functions that take the scope as their first argument. A call passes the scope, as `bump$($$s, 1)`. Only a function value that escapes, such as one passed as an argument, is bound with `.bind`.
- A handler that names a local function exports it as it is, as `export { add$ as h5 }`. An arrow handler gets the scope as its first parameter.
- Server functions become `$$b.rpc` stubs, also the ones of the module script.
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

The [Vite plugin](../website/docs/reference-plugin.md) runs the analysis when the build starts and when a `.brm` file changes.

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
- When the parts of a component are smaller than the `merge` option in all, the entry holds their code and has no `load`. The first event then loads one module instead of several. The size is an estimate of the minified size: without comments, extra whitespace and long generated names. Components with a `shared` part keep their parts. `compile` does not merge by default, and the Vite plugin merges below `DEFAULT_MERGE`, 4096 bytes. At that size one module costs less than the entry and the parts that a first event loads, each with its own request, imports and gzip header. The parts also wait for the entry, so a split component takes 2 round trips on a cold first event.
- The loader of a handler part that can write a slot that an update reads also starts loading `update`, so the write does not wait for another request.
- A component with no client code, such as a page of static markup, has no parts. A build leaves it out of the client: it has no entry and no place in the loader's registry, and the core treats it as a component with nothing to update.
- The core finds an export by its name: `h<n>` and `c<n>` are in the part of the same name, and everything else is in `update`.

A bundler loads a part as `App.brm?brumate-client&part=<name>`.

The [Vite plugin](../website/docs/reference-plugin.md) connects the compiler to the dev server and the build. It serves the modules and maps server function IDs to their modules.

## Runtime

The runtime has two parts.

The loader, `brumate/loader`:

- Is the only code that runs before the first interaction.
- Listens to the events in `b-on` attributes on `document`, and walks from the target outwards.
- Applies event modifiers before anything loads.
- Adds the `<window>` and `<document>` listeners, and starts `$client` callbacks and `#client` blocks when their trigger fires.
- Preloads a component's module and the handler's part when the pointer is over one of its handlers.
- After `load`, when the browser is idle, preloads the core and the code of the handlers of elements in or near the viewport, so a later first event needs no request. It skips `prefetch="none"`, a browser that asks to save data, and 2G connections. The `preload` option turns it off.
- Imports the core and the component's module at the same time on the first event, and calls the handler.
- Leaves out the code of client navigation when the Vite plugin has `navigate: false`. The plugin then starts the loader with `startWithoutNavigation` from `brumate/static-loader`, a module without the imports of the navigation code.

```ts
import { start } from 'brumate/loader';

start({ load: (id) => import(`/assets/${id}.js`) });
```

The core, `brumate/client`, loads on the first event:

- Reads the state records that the page's scripts handed over, and links scope instances to their parents. It does not include seroval.
- Writes slots and calls the updates in `g`.
- Finds elements by `b-b`, and text, blocks and list items by their comment markers. A text that is the whole content of an element, and a list item that is one element, are found by the element's `b-b`. A handler on an element without `b-b` runs with the scope of the nearest element around it that has one.
- Renders block bodies, keeps the elements of list items whose keys stay, and removes the scopes of removed markup.
- Runs `$effect` and `$client` callbacks and their cleanups.
- Hides and shows `#offscreen` bodies. The code that does it is set up when the first body hides, so the core of a page without one only checks that it is not there.
- Calls server functions with `fetch`, at `/_brumate/<id>` by default. `handleRequest` from `brumate/server` answers them. The code for these calls is a separate chunk that loads on the first call.

Each helper that compiled code calls is an export of the core of its own, and compiled modules read them as `$$b.<name>` from a namespace import, which a bundler tree-shakes as it does named imports. The loader reads the one export that it needs, `loader`, so a build keeps only what its components call. The helpers of markup that the client renders, such as `createScope` and `addPortal`, are exports too, not methods of a context object.

Features that change how the core reads the page are not in the core:

- `client-routes.ts` reads the state records of the pages that client navigation adds: IDs that moved, routes that it replaced, and layouts that it kept. The loader imports it when it navigates with a running core, or with the core when the page has records that navigation marked. It sets the core's `record` hook.
- Hot updates call `forget` and `remount`, which only `brumate/hot` imports. `remount` sets the `added` hook.
- `refresh` from a server function, and `$action` forms, are in the chunk of server function calls.
- The devtools hooks run only where `import.meta.env.DEV` is true. A Vite build replaces it with `false`.
- `$optimistic` sets up its code on the first guess.

These modules read the core with `import()`, not a static import. A static import of the core from a module that loads on its own would make the package build move the core into a chunk behind a module that only re-exports it, and a page would load the two one after the other.

Handlers run after the event has finished dispatching, so the core passes them an event whose `currentTarget` is still the element.

Parts load in parallel, but handlers start in the order of their events. Typing and then submitting runs the input handler before the submit handler, even when the submit handler's part loads first.

## Size

Minified, from the production build of `examples/todos`, with `gzip -9`:

| Code                                                   | Size    | Gzip   |
| ------------------------------------------------------ | ------- | ------ |
| Loader with its registry, `navigate: false`            | 4969 B  | 2279 B |
| Of that, Vite's preload helper                         | 1502 B  | 785 B  |
| Loader with its registry and client navigation         | 6779 B  | 2907 B |
| Navigation module, on the first link                   | 7489 B  | 3045 B |
| Core, `navigate: false`                                | 11463 B | 4832 B |
| Core                                                   | 11793 B | 4937 B |
| Navigation records, after the first navigation         | 2087 B  | 959 B  |
| Server function calls, with seroval, on the first call | 30172 B | 9331 B |
| `App.brm`: one module with 3 handlers and the updates  | 1361 B  | 801 B  |
| `Counter.brm`: one module                              | 324 B   | 268 B  |
| `_layout.brm`: one module                              | 313 B   | 266 B  |

The loader is the only code that loads before an interaction. The core loads once, on the first event. The page state is code that the page's scripts run, so the core needs no reader for it. seroval loads with the server function code, on the first call, which reads and writes seroval JSON.

Before the state was code, it was seroval JSON, and the core held seroval: 46339 B, 14971 B gzip.

Before the core was split by feature, it was 20646 B, 7838 B gzip, in every build. The loader imported the whole module, so a build kept every export. In `benchmarks/brumate`, a counter and a todo list without client navigation, the core is now 10877 B, 4632 B gzip. What left the core of that build, in minified bytes before gzip:

| Feature                                                              | Bytes  |
| -------------------------------------------------------------------- | ------ |
| `$produce`                                                           | 1765 B |
| Reading the pages that client navigation adds, and `leavePage`       | 1463 B |
| `$action` forms, `refresh`, server calls and their values            | 1150 B |
| Updates it has none of: `#if`, `#key`, `#try`, `#client`, `#portal`… | 1060 B |
| Render helpers of the client that it does not call, dynamic tags     | 910 B  |
| Context, and props of child components, shared module code           | 710 B  |
| Hot updates                                                          | 700 B  |
| `$optimistic`                                                        | 490 B  |
| Devtools hooks                                                       | 174 B  |

The rest is HTML helpers, effects and the title. The bytes come from a source map of the old core's chunk. The core of a build that calls a helper keeps it: the core of `examples/todos` keeps `#if`, server calls and `leavePage` for client navigation.

The idle preload adds 192 B, 97 B gzip, to the loader. Splitting the core moved its imports and the code that loads `client-routes.ts` into the loader: 10 B gzip without client navigation, and about 55 B gzip with it.

Vite wraps every dynamic import of a client build in its preload helper, which lands in the loader's chunk. The plugin keeps the list of chunks to preload out of the loader, because the loader imports the core itself.

After the page is idle, the first click on a todo needs no request: the loader preloaded the core and `App.brm`'s module. A click right at `load` loads them at the same time, in one round trip. Before the entry held the code of small components, it loaded the entry (744 B), then the handler's part (185 B), then, after the handler wrote a slot, `update` (924 B): three requests after one another. The pages without client code no longer ship an entry each.

## Dependencies

- [seroval](https://github.com/lxsmnsyc/seroval) for serialization.
- [oxc-parser](https://github.com/oxc-project/oxc) for the scripts.
