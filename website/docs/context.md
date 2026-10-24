# Context

A context passes a value from a component to every component inside it, without props. It suits values that many components read, such as a theme, the current user or a language.

```brm live
<script>
  import { $setContext, $signal } from 'brumate/signals';
  import Toolbar from './Toolbar.brm';
  import { Theme } from './theme.ts';

  let theme = $signal<'light' | 'dark'>('light');
  $setContext(Theme, theme);
</script>

<button onClick=(() => (theme = theme === 'light' ? 'dark' : 'light'))>Switch the theme</button>
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
let locale = $signal('fr');
$setContext(Locale, locale);
```

- Call it at the top level of a script. A `<script>` of a block, such as the body of a `#for`, provides to the markup of that block.
- Providing a signal passes its value. When the signal changes in the browser, every component that reads the context updates.
- A component further down can provide the same context again for its own part of the page. A component reads the nearest one.
- A component can read a context and provide it again, such as a value of its own built on the one above. It reads the one above, and the components inside it read its own. When the value above changes, both update.
- The value goes to the browser with the page, so it must be a value that brumate can send. See [Serializable values](./reference-serialization.md).

## Reading a value

`$getContext(context)` reads the value from the nearest component above that provides it:

```ts
const locale = $getContext(Locale);
```

- Declare it with `const`. It reads like any value, and the markup updates when the provided value changes.
- Without a provider above, it is the default value of the context.
- Components that the browser renders later, such as a new item of a `#for`, read the current value.

## Changing a provided value

A component cannot assign to a value that it reads from a context. The component that provides it can give functions that change it, and any component below can call them:

```brm live
<script>
  import { $setContext, $signal } from 'brumate/signals';
  import { Counter } from './counter.ts';
  import Buttons from './Buttons.brm';

  let count = $signal(0);

  $setContext(Counter, {
    count,
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
  count: 0,
  add: (_step: number) => {},
  reset: () => {},
});
```

- A provided function can be the value itself, or the value of a key, also of an object inside the value, such as `{ slots: { increment: { onPress } } }`. It is a function of the component, an arrow, or a method.
- The function runs in the component that provides it, with its values. The browser loads it the first time a component calls it.
- A function prop does the same for one child: `<ThemeSwitch onChange=((next) => (theme = next)) />`.
