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

The dev server adds a tab with the logo of brumate to the bottom edge of each page. The tab shows the version of brumate. It pulls up a panel docked at the bottom of the page, and sits on its top edge while it is open. Drag the tab, or the top edge of the panel, to change its height, which the browser keeps. Its header shows the versions of brumate and Vite, the page, and how many components, scopes and parts of code the page has, with the size of its state. It has nine tabs:

- **Errors** shows errors of a render on the server, of Vite, such as a compile error after an edit, and of code in the browser. The selected error shows the lines of its file, highlighted, with the line and the word at its column marked, and its stack. Click a place of the stack to see its code, or the file to open it in your editor. An error of the server or of Vite opens the panel on it, in place of Vite's overlay. An error of the browser counts on the button.
- **Overview** shows the page, the versions, the size of the client code and the state, the blocks, and each component on the page with its file, instances, scopes and the parts of its code that loaded.

- **Components** shows a tree of the components on the page and their scopes, and the signals and memos of the selected scope by name, with their type and value. A scope that just changed flashes. Filter the tree by a component or a value.
- **Elements** shows the element that **Pick** found: its component, its scope and anchor, its place in the `.brm` file, its handlers with the part of each one and whether it loaded, and the values that its updates read. The inserts and blocks inside it are listed too. Click the place in the file to open it in your editor.
- **Graph** shows what changes in the browser in a component, left to right: its signals and props, its memos, and the markup and effects that read them, with the current value of each. A value that changes marks its box and every box after it in yellow for a moment, so you can see what an event updated. Click a node to see what it reads and what reads it, and its place in the file. Drag to pan, and scroll or use the buttons to zoom.
- **Log** lists each handler that ran, each module of client code that loaded, each value that changed, and each server function call with its status and how long it took. Filter it by kind, search it, pause it, or clear it.
- **Loading** lists each part of client code that loaded, in order, with a bar of when it loaded: why it loaded, how long it took and its size. The reasons are an event, a block, a write and the like, or a preload on hover, near the viewport, on idle or after the page loaded. A preload that nothing has run yet is marked, so you can see code that loads for nothing. Sizes are those of the dev server, which does not minify.
- **Blocks** lists the `#loading`, `#defer` and `#client` blocks and the `$client` callbacks of the page, with their trigger and state: `streaming`, `waiting`, `loading` or `rendered`, and when they rendered. **Fire** runs the trigger of a `#defer` or `#client` block now, to see its body without scrolling to it.
- **Report** shows the `brumate inspect` report of a component.

In Components:

- Click a value to change it. Type JSON, or text for a string, and press Enter. The page updates as if a handler wrote the value. Elements and functions cannot be changed.
- Hover the label of a scope to outline its elements on the page.
- Press **Pick**, then click an element of the page. The **Elements** tab shows it.

Until you press the button, only a small listener runs, so the page behaves as in production. Opening the panel loads the core of the page, so it can show the components before any event. Production builds have no devtools. `devtools: false` in the plugin options removes the button.

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
