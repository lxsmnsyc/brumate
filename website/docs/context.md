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

export const Theme = createContext<'light' | 'dark'>('theme', 'light');
```

`Badge` reads the theme two components down, and `Toolbar` in between knows nothing about it.

## Creating a context

`createContext(key, defaultValue)` from `brumate/context` creates a context. Put it in a `.ts` file, so the components that provide and read it can import it.

```ts
import { createContext } from 'brumate/context';

export const Locale = createContext<string>('locale', 'en');
```

- The key names the context in the page, so it must be unique in the app.
- The default value is what a component reads when no component above it provides the context.

## Providing a value

`$setContext(context, value)` gives the components inside this one a value of the context:

```ts
$setContext(Locale, 'fr');
```

- Call it at the top level of a script. A `<script>` of a block, such as the body of a `#for`, provides to the markup of that block.
- The value is read once. A value that changes goes in a store, as [below](#live-values-with-stores). The compiler warns when the value reads a signal, a memo or a `let`, and `$untrack` silences the warning.
- A component further down can provide the same context again for its own part of the page. A component reads the nearest one.
- A component can read a context and provide it again, such as a value of its own built on the one above. It reads the one above, and the components inside it read its own.
- The value goes to the browser with the page, so it must be a value that brumate can send. See [Serializable values](./reference-serialization.md).

## Reading a value

`$getContext(context)` reads the value from the nearest component above that provides it:

```ts
const locale = $getContext(Locale);
```

- Declare it with `const`. It reads like any value, once.
- Without a provider above, it is the default value of the context.
- Components that the browser renders later, such as a new item of a `#for`, read the current value.

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

export const Counter = createContext('counter', {
  add: (_step: number) => {},
  reset: () => {},
});
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
import { store } from 'brumate/store';
import type { Store } from 'brumate/store';

export const Level = createContext<{ level: Store<number>; reset: () => void }>('level', {
  level: store(0),
  reset: () => {},
});
```

- `$store(source)` takes a context that holds a store, `$store(Level)`, a key of its value, `$store(field.level)`, or a store that the file imports, `$store(theme)`. Nothing else, since the browser finds the store again when the page resumes.
- `const x = $store(source)` follows the store. `let x = $store(source)` also writes it: `x = next` calls `set(next)`. A store without `set`, such as one from a memo, throws a `TypeError` when the variable registers.
- The provider has one store for each `$toStore`, and a reader updates in the same ordered pass as the props and memos around it.
- The page sends only the value of a store from `brumate/store`. A store of another library, with `get` and `subscribe`, works when the file imports it, and the server refuses it inside a provided value, with an error that names the context.
- `import { store } from 'brumate/store'` makes a store for a module: `export const theme = store('light')`. `Store` calls its listeners only when the value changes (`Object.is`).
- Keep functions for handlers. A reader renders from the store, not from a function that reads a signal.
