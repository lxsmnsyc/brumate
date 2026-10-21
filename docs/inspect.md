# Inspect

`brumate inspect` shows what each component ships to the client, and why.

```bash
brumate inspect src/Todos.brm
brumate inspect src            # every .brm file in a directory
brumate inspect --json src     # the reports as JSON
```

Without paths, it inspects every `.brm` file under the current directory. Props are analyzed across every `.brm` file under the current directory, as the Vite plugin does.

## Report

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

| Section               | What it lists                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client code           | Each event handler, function prop and `$client` callback, with the functions and server functions it calls. Each is its own part.                     |
| Changes on the client | Each value and piece of markup that can change on the client, and why: what writes it, what it reads, or which parent passes it a value that changes. |
| State                 | The values that the page state holds for each scope.                                                                                                  |
| HTML only             | The elements and inserted values that ship no client code.                                                                                            |
| Client modules        | The size of the entry and each part, before minifying.                                                                                                |

## From code

```ts
import { analyzeProjectProps, inspect } from 'brumate';

const props = analyzeProjectProps(sources).get('Badge.brm')!;
const { report, text } = inspect(source, {
  filename: 'Badge.brm',
  liveProps: new Set(props.keys()),
  parents: props,
});
```

Without `liveProps`, the file is inspected alone, and every prop can change.

## Devtools

The dev server adds a `brm` button to each page. It opens a panel with three tabs:

- **Scopes**: each component on the page, with its scopes and the value of each slot by name. A scope that changed since the panel last drew flashes.
- **Log**: each handler that ran, each part of client code that loaded, and each write to a slot.
- **Report**: the report of `brumate inspect` for a component. Choose one in Scopes.

Until the button is pressed, only a small listener runs, so the page behaves as in production. The panel loads when it opens. Production builds have no devtools. `devtools: false` in the plugin options removes the button.

## Build report

`report: true` in the plugin options prints what the client build ships. Sizes are after gzip.

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

- Every page loads the entry and what it imports before its first event.
- The first event loads the core.
- A route can load the code of its page, its layouts, and the components that they import. Each event loads only its own part, so a page often loads much less.
- Navigation and server calls load their own modules, which the report does not count.

`budget` fails the build when a size goes over it, in bytes after gzip:

```ts
brumate({ budget: { loader: 3072, route: 20480 } });
```

The error lists every size over the budget.
