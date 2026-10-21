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

The dev server adds a `brm` button to each page. It opens a panel with four tabs:

- **Scopes** shows each component on the page, with the value of each of its signals and memos by name. A scope that just changed flashes.
- **Graph** shows what changes in the browser in a component, left to right: its signals and props, its memos, and the markup and effects that read them, with the current value of each. A value that changes marks its box and every box after it in yellow for a moment, so you can see what an event updated.
- **Log** lists each handler that ran, each module of client code that loaded, each value that changed, and each server function call with its status and how long it took. Filter it by kind, pause it, or clear it.
- **Report** shows the `brumate inspect` report of a component.

In Scopes:

- Click a value to change it. Type JSON, or text for a string, and press Enter. The page updates as if a handler wrote the value. Elements and functions cannot be changed.
- Hover the label of a scope to outline its elements on the page.
- Press **Pick**, then click an element of the page, to find its scope.

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
```

- Before its first event, every page loads the loader only.
- The first event loads the core.
- A route can load the code of its page, its layouts and the components that they import. Each event loads only its own part, so a page often loads much less than this number.
- Navigation and server function calls load their own small modules, which the report does not count.

## Budgets

`budget` fails the client build when a size goes over it, in bytes after gzip:

```ts
brumate({ budget: { loader: 3072, route: 20480 } });
```

- `loader` limits what every page loads before its first event.
- `route` limits the most that any route can load after its first event.
- The error lists every size over the budget.
