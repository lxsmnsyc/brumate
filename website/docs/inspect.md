# Inspect and devtools

Three tools show what brumate ships to the browser and why: `brumate inspect` for a component, the devtools panel for a running page, and the build report for a whole app.

## `brumate inspect`

```bash
brumate inspect src/Todos.brm
brumate inspect src            # every .brm file in a directory
brumate inspect --json src     # the reports as JSON
```

Without paths, it inspects every `.brm` file under the current directory. It finds which props parents can change across all those files, as the Vite plugin does.

```
Badge (Badge.brm) Badge_1rjt0v5

Client code
  none

Changes on the client
  prop label (2:11)
    toolbar.brm passes a value that changes
  insert (5:19)
    reads prop label

State
  component: label

HTML only
  1 element and 0 inserted values ship no client code

Client modules, before minifying (bytes, gzip)
  entry: 296 B, 220 B
  update: 133 B, 125 B
```

| Section               | What it lists                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Client code           | Each event handler, function prop and `$client` callback, with the functions and server functions it calls. |
| Changes on the client | Each value and piece of markup that can change in the browser, and why: what writes it, or what it reads.   |
| State                 | The values that the page sends to the browser, for each scope.                                              |
| HTML only             | The elements and inserted values that ship no code.                                                         |
| Client modules        | The size of each module of the component, before minifying.                                                 |

Use it when a component ships more than you expect. The "Changes on the client" section names the write that makes each value change.

## Devtools

The dev server adds a grip to the bottom edge of each page: a thin bar that grows on hover or focus into a tab with the logo, the version of brumate and, when the page has errors, a red count of issues. Until you open the dock, only a small listener runs, so the page behaves as in production. Opening it loads the core of the page, so it can show the components before any event. Production builds have no devtools. `devtools: false` in the plugin options removes the grip.

### Open and close

- Click the grip, drag it up, or press Alt+Shift+D to open the dock.
- Press Alt+Shift+D, press Escape, or click the close button to close it. Escape does nothing while Pick, the search or a field uses it. Focus goes back to the grip.
- An error of the server or of Vite, such as a compile error after an edit, opens the dock on it, in place of Vite's overlay. An error of the browser only counts on the grip.

### Sides and size

The dock sits at the bottom of the page or at its right. **Dock side** in the header switches it, and so does the search. The page gets matching padding, so nothing hides behind the dock.

- Drag the edge of the dock to change its height at the bottom, or its width at the right. The edge is a separator you can focus: the arrow keys move it by 16 pixels, and Shift moves it by 64.
- Workspaces with two panes, such as the component tree and its detail, have a handle between the panes. Drag it, or focus it and use the arrow keys, Home and End. Double-click it to reset the split. At the right the panes stack, and the handle is horizontal.
- The browser keeps the side, the size, the splits and the last workspace between pages.

### Header

The header shows the logo, the version of brumate (hover it for the version of Vite), the four workspaces and these buttons:

- **Search** (Cmd+K, or Ctrl+K off macOS) opens a palette of the components, the issues and actions, such as Pick, the dock side and opening a workspace. Arrow keys move, Enter runs, Escape closes.
- **Pick** arms a pick: point at an element of the page, and the dock selects the row of its component in Inspect. Escape stops it.
- **Outline updates** outlines each element as it changes: green for one that changes now and then, yellow and red for one that changes often. The choice is kept between pages. The outlines are drawn on one canvas over the page, so they follow scrolling and fixed elements, and they add no elements to your page.

A footer shows whether the log is live or paused, the route, the number of components and scopes, the size of the page state, the version of Vite and how long the page has been up.

### Inspect

Inspect shows the components of the page. A filter and a tree of the components and their scopes are at the left. A dot marks a scope that was written lately. Hovering a row outlines its elements on the page.

The detail of the selected component shows its file, which opens in your editor, and two views:

- **Values** lists the signals and memos of the scope by name, with their type, their value and the code that reads them. Click a value to change it: type JSON, or text for a string, and press Enter. The page updates as if a handler wrote the value. Elements and functions cannot be changed.
- **Graph** shows what changes in the browser in the component, left to right: its signals and props, its memos, and the markup and effects that read them, with the current value of each. A node is as wide as its name needs, and a long chain is never folded. When a value changes, its node and every node after it light up in yellow, one after the other, so you can see what an event updated. Click a node to dim everything outside its lineage and to open a side with its kind, its place in the file, its value, what it reads and what reads it. Click an entry there to go to that node. Drag to pan, scroll to zoom at the pointer, or use the zoom and fit buttons.

### Activity

Activity is one log, oldest first, of what ran on the page. A chip for each kind filters it: Navigation, Block, Handler, Write, Effect and Server. **Pause** stops the log and **Clear** empties it. A ruler above the log has a tick for each row. The writes, effects and server calls made while a handler ran hang under that handler.

Select a server call to see its details at the right of the log. Click it again, or close the detail, to hide it.

### Server call details

The detail of a server call shows:

- the arguments, and the result or the error,
- for an error, the real message and the lines of the stack that are in your app, with the code of the line you choose, and a link to open the file in your editor,
- the time of the call, split into the wait for the module, the network, the server and the decoding,
- what ran on the server: the `console.*` output, the server functions that the call used, and the memos it reloaded,
- the handler that made the call, and the writes that followed it.

**Run again** posts the same request again, after you confirm that its side effects happen again. **Copy as fetch** and **Copy for an agent** put the call on the clipboard.

Server call details exist in development only. They need the dev server: when the answer comes from elsewhere, such as a server that runs in a Nitro worker, the detail shows only what the browser saw.

> **Security.** The dev server sends the real error message, the stack and the `console.*` output of a server function to the browser, in the dev header `x-brumate-dev` of the answer. With `server.host` set, the dev server is open to other machines, and anyone who can reach it can read them. A dev server on a shared network is not a place for secrets in logs or error messages. A production build never sends the header.

### Issues

Issues lists the errors of a render on the server, of Vite, of the compiler and of code in the browser. A dot shows the source: red for errors of the browser and the server, yellow for the checks of the compiler. The selected issue shows its full message, the lines of its file with the failing line highlighted, its stack, and a hint with a link to the page of the error when brumate knows its code. Click a place of the stack to see its code. **Open in editor** opens the file, **Copy for an agent** copies the issue, and **Show in Activity** goes to the log at that time, for errors of the browser. The arrow keys move between issues.

### Page

Page summarizes the running page in four numbers: the components with their scopes, the size of the page state, the handlers that ran with the server calls, and how long the page took to be ready. Below them:

- **Page state** lists each value that the page sent, largest first, with about how many bytes it takes and the code of the browser that reads it. A value is sent because that code reads it. One over 1 kB is marked, so you can see a value that the browser needs only part of. A bar splits the state by component.
- **Blocks** lists the `#loading`, `#defer` and `#client` blocks and the `$client` callbacks, with their trigger and state: `streaming`, `waiting`, `loading` or `rendered`. **Trigger now** runs the trigger of a `#defer` or `#client` block, to see its body without scrolling to it. The fallback toggle shows the fallback of a `#loading` or `#defer` body again, to check how it looks. While the fallback shows, the body is out of the page.
- **Environment** shows the versions of brumate and Vite, the route and how long the page has been open, with buttons to Issues and Activity.

## Workbench

The dev server has a workbench at `/__brumate/workbench`. It lists the components of the app that depend only on their props and their own state, such as a button or a list of labels, and shows each one with controls for its props.

- Each component renders on the server with the props of the controls, and resumes in the browser, as a page does. So what it shows, and the code that it loads, is what a page gets. The devtools are in the frame too.
- The controls come from the type of `$props<T>()`: a text field for `string`, a number field for `number`, a box for `boolean`, a list for a union of literals, such as `'info' | 'warning'`, and JSON for the rest. A prop starts at the default of its destructuring. A function prop, such as a handler, has no control.
- The type can be a literal, or an interface or type alias of the file, with what it extends, an intersection, or `Partial`. A type that the file imports has no controls.
- A context has no default. A component that reads one without a provider throws, unless the read has a fallback, `$getContext(Context, undefined)`.
- The toolbar sets the width of the frame, to fill the canvas or as a phone, a tablet or a desktop, and the background around it. It renders the component again, or opens it alone in a new tab. Click the file to open it in your editor.
- **Reset** puts each prop back to its start, and the arrow next to a prop resets that one.
- The components of a package, such as `@brumate/ui`, are listed under the name of the package.

A story file names sets of props for a component, so the workbench can show its states. It is a `.stories.ts` file next to the component, and each named export is a set of props:

```ts
// Button.stories.ts
export const Primary = { label: 'Save', tone: 'primary' };
export const Disabled = { label: 'Save', disabled: true };
```

The stories are listed above the controls. Picking one starts the controls from its props, and the address of the page names it, so a link opens it. Values that JSON cannot hold, such as functions, are left out.

- The files of `src/routes` are not listed. Pages are what `visit` from [`brumate/testing`](./testing.md) and end-to-end tests are for.

A component that needs more than its props, itself or through a component that it renders, is under **Needs the environment**, with a dot for each kind of need. Pick it to see what it needs:

- It calls a server function, of a `'use server'` file or one that it declares.
- It reads the request, through an import of `brumate/server`.
- A namespace import, such as `import * as api from './api.ts'`, counts as well.
- It reads the route with `$route` or `$navigation`.
- It has a form action of `$action`, a `#defer` block, or a dynamic tag with no element to fall back to, such as `<{as ?? 'button'}>` has.
- It renders a component that the workbench cannot find.

A component in the workbench has no layout around it, so the styles of a layout, such as `:global` rules of `_layout.brm`, are not there.

## Build report

`report: true` in the plugin options prints what the client build ships, after gzip:

```
brumate client report (gzip)
  The loader, on every page: 2.7 kB
  The core, when the page starts: 13.4 kB
  What each route loads when it starts, with the core
    /: 15.8 kB (4 components)
    /guestbook: 14.6 kB (2 components)
  Components, largest first
    src/App.brm: 1.3 kB
    src/routes/guestbook.brm: 847 B
```

- Every page loads the loader, and the loader imports the core at once.
- When a page starts, it loads the bundles of its route and layouts: the code of every component that they can render. See [Bundles](./client-modules.md#bundles).
- Navigation and server function calls load their own small modules, which the report does not count.

## Budgets

`budget` fails the client build when a size goes over it, in bytes after gzip:

```ts
brumate({ budget: { loader: 3072, route: 20480, component: 4096 } });
```

- `loader` limits the loader, which every page loads.
- `route` limits what any route loads when it starts, with the core.
- `component` limits the client code of one component. A component in the bundle of a page counts its share of the bundle, by the size of its modules.
- The error lists every size over the budget:

```
The component src/Chart.brm ships 9.4 kB, over the budget of 4.0 kB.
```
