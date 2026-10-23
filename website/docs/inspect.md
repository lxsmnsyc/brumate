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

The dev server adds a small grip to the bottom edge of each page. On hover or focus it grows into a tab with the logo and the version of brumate, and the number of errors. The grip turns red when the page has errors. Click it, drag it up, or press Alt+Shift+D to open a panel docked at the bottom of the page. Drag the top edge of the panel to change its height, which the browser keeps. Its header shows the versions of brumate and Vite, the page, and how many components, scopes and parts of code the page has, with the size of its state. It has ten tabs:

- **Errors** shows errors of a render on the server, of Vite, such as a compile error after an edit, and of code in the browser. The selected error shows the lines of its file, highlighted, with the line and the word at its column marked, and its stack. Click a place of the stack to see its code, or the file to open it in your editor. An error of the server or of Vite opens the panel on it, in place of Vite's overlay. An error of the browser counts on the button.
- **Overview** shows the page, the versions, the size of the client code and the state, the blocks, and each component on the page with its file, instances, scopes and the parts of its code that loaded.

- **Components** shows a tree of the components on the page and their scopes, and the signals and memos of the selected scope by name, with their type and value. A scope that just changed flashes. Filter the tree by a component or a value.
- **Elements** shows the element that **Pick** found: its component, its scope and anchor, its place in the `.brm` file, its handlers with the part of each one and whether it loaded, and the values that its updates read. The inserts and blocks inside it are listed too. Click the place in the file to open it in your editor.
- **Graph** shows what changes in the browser in a component, left to right: its signals and props, its memos, and the markup and effects that read them, with the current value of each. A value that changes marks its box and every box after it in yellow for a moment, so you can see what an event updated. Click a node to see what it reads and what reads it, and its place in the file. Drag to pan, and scroll or use the buttons to zoom.
- **Log** lists each handler that ran, each module of client code that loaded, each value that changed, and each server function call with its status and how long it took. Filter it by kind, search it, pause it, or clear it.
- **Timeline** shows each handler that ran, on a bar of its own: the wait for its code and the handlers before it, its run, and its promise. Under it are the server functions it called, with the time on the server from the `Server-Timing` header of the dev server, and the updates that followed.
- **Loading** lists each part of client code that loaded, in order, with a bar of when it loaded: why it loaded, how long it took and its size. The reasons are an event, a block, a write and the like, or a preload on hover, near the viewport, on idle or after the page loaded. A preload that nothing has run yet is marked, so you can see code that loads for nothing. Sizes are those of the dev server, which does not minify.
- **Page state** lists each value that the page state sent, by the slot that holds it, largest first, with about how many bytes it takes and the code of the browser that reads it, such as a handler or an update. A value is sent because that code reads it. One over 1 kB is marked, so you can see a value that the browser needs only part of.
- **Effects** lists each `$effect` and `$client` callback that ran, with how many times, how many in the last second, how long its runs took, and how many times its cleanup ran. One that ran 10 times or more in the last second is marked, and one whose cleanup ran without a new run is grey, such as in a scope that went.
- **Navigation** shows each client navigation of the page, newest first: the routes that stayed, such as a layout, and the slots whose route was replaced, with the old and the new route, or that the whole page was replaced and why. It also shows how long the page took to change, and how far the IDs of the new page moved, when they did not start where the page asked, such as for a prerendered page.
- **Server** shows what the server did for the last page that it rendered, on one scale: the render until the page could stream, each memo that loaded, by name, and each server function call of a `'use server'` file, each `#loading` body, and the rest of the stream. A slow call or memo stands out by its bar. The dev server writes the trace at the end of each page, as a `<script type="application/json" b-trace>`, and a build writes none.
- **Blocks** lists the `#loading`, `#defer` and `#client` blocks and the `$client` callbacks of the page, with their trigger and state: `streaming`, `waiting`, `loading` or `rendered`, and when they rendered. **Fire** runs the trigger of a `#defer` or `#client` block now, to see its body without scrolling to it. **Fallback** shows the fallback of a `#loading` or `#defer` body again, to check how it looks, and **Body** brings the body back. While the fallback shows, the body is out of the page.
- **Report** shows the `brumate inspect` report of a component.

In Components:

- Click a value to change it. Type JSON, or text for a string, and press Enter. The page updates as if a handler wrote the value. Elements and functions cannot be changed.
- Hover the label of a scope to outline its elements on the page.
- Press **Pick**, then point at an element of the page. A card shows its component, its place in the file, its scope, its handlers with whether their code loaded, and the values it reads. Click to see it in the **Elements** tab, or press Escape to stop.

**Updates** in the header outlines each element as it changes: green for one that changes now and then, yellow and red for one that changes often. The choice is kept between pages.

Until you press the button, only a small listener runs, so the page behaves as in production. Opening the panel loads the core of the page, so it can show the components before any event. Production builds have no devtools. `devtools: false` in the plugin options removes the button.

## Workbench

The dev server has a workbench at `/__brumate/workbench`. It lists the components of the app that depend only on their props and their own state, such as a button or a list of labels, and shows each one with controls for its props.

- Each component renders on the server with the props of the controls, and resumes in the browser, as a page does. So what it shows, and the code that it loads, is what a page gets. The devtools are in the frame too.
- The controls come from the type of `$props<T>()`: a text field for `string`, a number field for `number`, a box for `boolean`, a list for a union of literals, such as `'info' | 'warning'`, and JSON for the rest. A prop starts at the default of its destructuring. A function prop, such as a handler, has no control.
- The toolbar sets the width of the frame, to fill the canvas or as a phone, a tablet or a desktop, and the background around it. It renders the component again, or opens it alone in a new tab. Click the file to open it in your editor.
- **Reset** puts each prop back to its start, and the arrow next to a prop resets that one.
- The files of `src/routes` are not listed. Pages are what `visit` from [`brumate/testing`](./testing.md) and end-to-end tests are for.

A component that needs more than its props, itself or through a component that it renders, is under **Needs the environment**, with a dot for each kind of need. Pick it to see what it needs:

- It calls a server function, of a `'use server'` file or one that it declares.
- It reads the request, through an import of `brumate/server`.
- It reads the route with `$route` or `$navigation`, or a context with `$getContext`.
- It has a form action of `$action`, a `#defer` block or a dynamic tag.
- It renders a component that the workbench cannot find.

A component in the workbench has no layout around it, so the styles of a layout, such as `:global` rules of `_layout.brm`, are not there.

## Build report

`report: true` in the plugin options prints what the client build ships, after gzip:

```
brumate client report (gzip)
  Every page, before its first event: 2.7 kB
  The core, on the first event: 13.4 kB
  The most each route loads after its first event, with the core
    /: 15.8 kB (4 components)
    /guestbook: 14.6 kB (2 components)
  Components, largest first
    src/App.brm: 1.3 kB
    src/routes/guestbook.brm: 847 B
  What the first run of a handler loads, largest first
    src/App.brm event form.submit (33:24): 1.3 kB
    src/Counter.brm event button.click (9:18): 246 B
```

- Before its first event, every page loads the loader only.
- The first event loads the core.
- A route can load the code of its page, its layouts and the components that they import. Each event loads only its own part, so a page often loads much less than this number.
- A handler loads the entry of its component, its own part, the updates that it runs, and what they import. A small component is one module, so each of its handlers loads all of it. The report lists the ten largest handlers.
- Navigation and server function calls load their own small modules, which the report does not count.

## Budgets

`budget` fails the client build when a size goes over it, in bytes after gzip:

```ts
brumate({ budget: { loader: 3072, route: 20480, event: 2048, component: 4096 } });
```

- `loader` limits what every page loads before its first event.
- `route` limits the most that any route can load after its first event.
- `event` limits what the first run of one handler or `$client` callback loads, besides the loader and the core. A route can stay under its budget while one handler grows past what a first click should load.
- `component` limits the client code of one component.
- The error lists every size over the budget. For a handler, it names the component, the handler with its place in the file, and the largest modules that it imports:

```
The handler event button.click (12:5) of src/Chart.brm loads 9.4 kB, over the budget of 2.0 kB. Its largest imports are node_modules/chart.js/dist/chart.js, src/format.ts.
```
