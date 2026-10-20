# Compiler

The compiler reads a `.brm` file and writes three things:

- A server module that renders the component to HTML with markers and state.
- Client chunks for the code that client roots reach.
- A component summary that parent components use to connect their graphs.

## Pipeline

1. **Parse.** Read the file into its scripts, styles and a markup tree with blocks. The scanner and the template and control flow parsers of solid-sfc can be reused here.
2. **Scope analysis.** Find the declarations in each scope: props, signals, memos, functions and block variables.
3. **Graph.** Build the dependency graph from the reads of each node. Follow local functions. Add edges through child component summaries.
4. **Reachability.** Start at each client root. Mark every node, function and template that it reaches.
5. **Checks.** Report captures that cannot be serialized, writes outside client roots, server function captures and client roots inside `#static`.
6. **Server codegen.** Write a render function that outputs HTML strings, markers and the state of the reachable scopes.
7. **Client codegen.** Write one chunk per handler, plus the update code and templates that the reachable nodes need.
8. **Summary.** Write which props the component reads on the client, which it calls and which bindings depend on them.

solid-sfc compiles markup to TSX as text. This compiler needs a tree for the markup and a graph for the scripts, so steps 3 to 8 are new.

## Output sketch

For the todo example in the [README](../README.md), the server writes:

```html
<form data-on="submit:prevent:c/Todos_add.js#h0" data-s="0">
  <input value="" data-on="input:c/Todos_input.js#h1" data-s="0">
</form>
<ul><!--b0-->
  <li>Write the docs</li>
<!--/b0--></ul>
<p><!--b1-->1<!--/b1--> left</p>
<script type="brumate/state">{"0":{"todos":[...],"draft":"","left":1}}</script>
```

The client chunk for `add`:

```js
// c/Todos_add.js
import { set, rpc } from 'brumate/runtime';

export const h0 = async (scope) => {
  set(scope, 'todos', [...scope.todos, { id: crypto.randomUUID(), title: scope.draft, done: false }]);
  set(scope, 'draft', '');
  await rpc('a1b2c3', [scope.todos]);
};
```

The update code for `todos`, `left` and the `#for` block is in a separate chunk. It loads on the first write to `todos`.

## Code splitting

The compiler splits code itself. It does not depend on another splitter or on the bundler.

- Each client root becomes its own module. The compiler moves the function out of the component and replaces its captured variables with reads from the scope.
- Each server function becomes its own server module. The client module gets a stub that calls it by ID.
- Code that more than one chunk reaches, such as a local helper function, moves to a shared module that those chunks import.
- Imports are copied into each module that uses them, and removed where they are no longer used.

The output is plain ES modules with static imports. A bundler can bundle them, but does not need to know how they were split.

A bundler plugin connects the compiler to the dev server and the build. It serves the split modules as virtual modules and maps server function IDs to their modules.

## Runtime

The runtime has two parts.

The loader:

- Is inlined in the page and stays under 1 KB.
- Listens to events on `document` and finds the nearest element with a `data-on` attribute for the event.
- Applies event modifiers.
- Preloads chunks for `prefetch`.
- Imports the handler chunk and calls the handler with the scope.

The core loads on the first handler call:

- Reads scopes from the state script when a handler needs them.
- Writes signals and updates the nodes downstream, in order.
- Finds DOM nodes by their markers.
- Creates and removes block bodies.
- Runs `$effect` and `$client` callbacks and their cleanups.
- Calls server functions.

## Dependencies

- [seroval](https://github.com/lxsmnsyc/seroval) for serialization.
- [oxc-parser](https://github.com/oxc-project/oxc) for the scripts, as in solid-sfc.
