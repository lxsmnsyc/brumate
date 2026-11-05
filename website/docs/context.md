# Context

A context passes a value from a component to every component inside it, without props. It suits values that many components read, such as a theme, the current user or a language.

```brm live
<script>
  import { $setContext } from 'brumate/signals';
  import Toolbar from './Toolbar.brm';
  import { Theme } from './theme.ts';

  $setContext(Theme, 'dark');
</script>

<Toolbar />
```

```brm live Toolbar.brm
<script>
  import Badge from './Badge.brm';
</script>

<p>The toolbar does not read the theme. <Badge /></p>
```

```brm live Badge.brm
<script>
  import { $getContext } from 'brumate/signals';
  import { Theme } from './theme.ts';

  const theme = $getContext(Theme);
</script>

<strong>The badge reads {theme}.</strong>
```

```ts live theme.ts
import { createContext } from 'brumate/context';

export const Theme = createContext<'light' | 'dark'>('theme');
```

`Badge` reads the theme two components down, and `Toolbar` in between knows nothing about it.

## Creating a context

`createContext(key)` from `brumate/context` creates a context. Put it in a `.ts` file, so the components that provide and read it can import it.

```ts
import { createContext } from 'brumate/context';

export const Locale = createContext<string>('locale');
```

- The key names the context in the page, so it must be unique in the app.
- A context has no default value. A default would be one object in the module, shared by every request on the server, and a context is meant to be local. A component that reads a context needs a provider above it, or asks first with [`$hasContext`](#reading-without-a-provider).

## Providing a value

`$setContext(context, value)` gives the components inside this one a value of the context:

```ts
$setContext(Locale, 'fr');
```

- Call it at the top level of a script. A `<script>` of a block, such as the body of a `#for`, provides to the markup of that block.
- Every context is static: the value is read once, when the component renders, and readers keep it. A value that changes goes in a store, as [below](#live-values-with-stores). The compiler refuses a value that reads a signal, a memo, a prop or a `$bind` value that changes in the browser ([BRM196](./errors.md#brm196)). A read inside a function is fine, since it runs when the function is called, and so are `$untrack` and `$toStore`.
- `$route()` and `$navigation()` are the exception. The runtime provides them to the page and updates their readers when navigation changes them.
- A component further down can provide the same context again for its own part of the page. A component reads the nearest one.
- A component can read a context and provide it again, such as a value of its own built on the one above. It reads the one above, and the components inside it read its own.
- The value goes to the browser with the page, so it must be a value that brumate can send. See [Serializable values](./reference-serialization.md).

## Reading a value

`$getContext(context)` reads the value from the nearest component above that provides it:

```ts
const locale = $getContext(Locale);
```

- Declare it with `const`. It reads like any value, once.
- Without a provider above, it throws: `The context "locale" has no provider above this component. Provide it with $setContext, or in a parent that does`. This happens on the server and in the browser. To read a context that may be missing, see [below](#reading-without-a-provider).
- Components that the browser renders later, such as a new item of a `#for`, read the value of their provider at that time.

## Reading without a provider

A part that works on its own, such as a button outside any group, asks first, since a read without a provider throws. `$hasContext(context)` is `true` when a component above provides the context, and `false` when none does:

```ts
const grouped = $hasContext(ButtonGroup);
```

- Declare it with `const`. The answer is fixed when the component renders, since providers are static. It is the same on the server and in the browser.
- `$route()` and `$navigation()` have a provider on every page, so it is `true` for them.
- To read only when there is a provider, guard the read with the same context. Without a provider the variable is `undefined`, and nothing links to a store:

```ts
const group = $hasContext(ButtonGroup) ? $getContext(ButtonGroup) : undefined;
const state = $hasContext(ButtonGroup) ? $store(group.state) : undefined;
const level = $hasContext(Level) ? $store(Level) : undefined;
```

- The guarded read is `const`, not `let`, and the guard and the read name the same context. Another form is [BRM197](./errors.md#brm197).

## Changing a provided value

A component cannot assign to a value that it reads from a context. The component that provides it can give functions that change its own state, and any component below can call them:

```brm live
<script>
  import { $setContext, $signal } from 'brumate/signals';
  import { Counter } from './counter.ts';
  import Buttons from './Buttons.brm';

  let count = $signal(0);

  $setContext(Counter, {
    add: (step: number) => (count += step),
    reset() {
      count = 0;
    },
  });
</script>

<p>Count: {count}</p>
<Buttons />
```

```brm live Buttons.brm
<script>
  import { $getContext } from 'brumate/signals';
  import { Counter } from './counter.ts';

  const counter = $getContext(Counter);
</script>

<button onClick=(() => counter.add(1))>Add one</button>
<button onClick=(() => counter.reset())>Reset</button>
```

```ts live counter.ts
import { createContext } from 'brumate/context';

export const Counter = createContext<{ add: (step: number) => void; reset: () => void }>(
  'counter',
);
```

- A provided function can be the value itself, the value of a key, or an item of a list, also inside other objects and lists of the value, such as `{ slots: { increment: { onPress } } }` or `{ items: [{ run }] }`. It is a function of the component, an arrow, or a method, written in the value. A list that code builds, such as with `map`, holds functions that the compiler cannot see, so it cannot send them.
- The function runs in the component that provides it, with its values. The browser loads it the first time a component calls it.
- A function prop does the same for one child: `<ThemeSwitch onChange=((next) => (theme = next)) />`.

## Live values with stores

A context holds a value that is read once. A value that changes reaches the components through a store that the context holds. A store has `get()`, `subscribe(listener)` and, to write, `set(value)`.

The provider makes a store of a memo or a signal with `$toStore`, and the readers bind it with `$store`:

```brm live
<script>
  import { $memo, $setContext, $signal, $toStore } from 'brumate/signals';
  import Readout from './Readout.brm';
  import { Level } from './level.ts';

  let count = $signal(0);
  const level = $memo(count * 10);
  $setContext(Level, { level: $toStore(level), reset: () => (count = 0) });
</script>

<button onClick=(() => count++)>Raise</button>
<Readout />
```

```brm live Readout.brm
<script>
  import { $getContext, $store } from 'brumate/signals';
  import { Level } from './level.ts';

  const field = $getContext(Level);
  const level = $store(field.level);
</script>

<p>The level is {level}.</p>
<button onClick=(() => field.reset())>Reset</button>
```

```ts live level.ts
import { createContext } from 'brumate/context';
import type { Store } from 'brumate/store';

export const Level = createContext<{ level: Store<number>; reset: () => void }>('level');
```

- `$store(source)` takes a context that holds a store, `$store(Level)`, a key of its value, `$store(field.level)`, or a store that the file imports, `$store(theme)`. Nothing else, since the browser finds the store again when the page resumes.
- `const x = $store(source)` follows the store. `let x = $store(source)` also writes it: `x = next` calls `set(next)`. A store without `set`, such as one from a memo, throws a `TypeError` when the variable registers.
- The provider has one store for each `$toStore`, and a reader updates in the same ordered pass as the props and memos around it.
- The page sends only the value of a store from `brumate/store`. A store of another library, with `get` and `subscribe`, works when the file imports it, and the server refuses it inside a provided value, with an error that names the context.
- `import { store } from 'brumate/store'` makes a store for a module: `export const theme = store('light')`. `Store` calls its listeners only when the value changes (`Object.is`).
- Keep functions for handlers. A reader renders from the store, not from a function that reads a signal.
