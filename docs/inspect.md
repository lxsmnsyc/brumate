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
