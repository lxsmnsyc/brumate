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
- A context has no default value. A default would be one object in the module, shared by every request on the server, and a context is meant to be local. A component that reads a context needs a provider above it, or gives the read a [fallback](#reading-without-a-provider).

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

A part that works on its own, such as a button outside any group, reads with a fallback, since a read without a provider throws. `$getContext(context, fallback)` gives the provided value, or the fallback when no component above provides the context:

```ts
const group = $getContext(ButtonGroup, undefined);
const size = $getContext(Size, 'm');
```

- The second argument decides, so `$getContext(ButtonGroup, undefined)` is a read that may have no provider. A provided `undefined` is a value, not a missing provider.
- The fallback is lazy. A literal, such as `undefined`, `false` or `'m'`, is passed as it is. Other code runs only when no provider is above, once for each read, in the reader. Nothing is stored on the context, so nothing is shared between requests.
- The browser does not run the fallback when the page resumes: a value that browser code reads comes with the page, as other values do. A component that the browser renders runs the fallback again, so a fallback that makes a new object gives that component a new object.
- `$route()` and `$navigation()` have a provider on every page, so they never give the fallback.

A store in a context that may be missing has two forms. Without a constant default, guard on the value, and the variable is `undefined` without a provider:

```ts
const group = $getContext(ButtonGroup, undefined);
const state = group ? $store(group.state) : undefined;
const level = $getContext(Level, undefined);
const value = level ? $store(level) : undefined;
```

- The guard is the name of the value, read with `$getContext(Context, undefined)`, and the read is `const`. Providers are static, so the guard never changes. Another form, such as `$store(group?.state)`, a `let` or another test, is [BRM197](./errors.md#brm197).

When a constant default exists, give a store as the fallback, and no guard is needed:

```ts
import { store } from 'brumate/store';

const locale = $store($getContext(LocaleContext, store('en-US')));
```

- With a provider, the reader binds the provider's store, and the fallback never runs, on the server, on resume or in a browser render.
- Without one, the fallback makes a store for this reader, so two readers or two requests never share it. The browser runs the fallback again on resume, as it runs the [source of a store](#live-values-with-stores), and the new store starts from its first value.

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

- `$store(source)` takes any expression at the top level of a script that gives a store: a key of the value of `$getContext`, `$store(field.level)`, the value itself, `$store($getContext(Level))` for a context that holds a store, an import, `$store(theme)`, a prop, a value of `<script module>`, a call, or a store made there, `$store(store(0))`. A context, `undefined` or `null` is no store: the compiler refuses one that it can see ([BRM199](./errors.md#brm199)), and the render throws a `TypeError` that names `$store` for any other source that gives no store. A context that may be missing is read as [above](#reading-without-a-provider).
- On resume the browser keeps the value that the server rendered. It finds the store of a context again from its provider, and runs any other source once, with the values the page resumed, when the component's code loads. Then it subscribes, and writes the variable once if the store's value differs from the server's. It never calls `set`.
- A store that the source makes, such as `$store(store(0))` or a call that returns a new store, is made again in the browser and starts from its first value there. A store of an import is one for the page in the browser, as it is one for each server process.
- The source runs once on resume, with the values that the server sent. A signal that a handler changed before the reader's code loaded is not seen by the source: it gives the store of the server's values.
- A store that reaches the browser in a value the page sends, such as a prop or a value of the script, must be a store of `brumate/store`, since only its value crosses. A store of another library works from an import, `<script module>` or a call in the reader. To send it in a prop, a script value or a context, wrap it with [`bridge()`](#outside-stores). In a prop or a script value that `$store` reads, a store that is not bridged makes the server render throw an error that names `$store`, the component and the value.
- Until a fix of the core, the code that the browser renders a component with has its own copy of `<script module>`. A `<script module>` store is then two stores once a page resumes and the browser also renders that component: the resumed readers share one, and the readers that the browser rendered share the other.
- The source gives its store at once. A source that awaits is [BRM198](./errors.md#brm198).
- `const x = $store(source)` follows the store. `let x = $store(source)` also writes it: `x = next` calls `set(next)`. A store without `set`, such as one from a memo, throws a `TypeError` when the variable registers. The guard on a value is `const` only ([BRM197](./errors.md#brm197)).
- The provider has one store for each `$toStore`, and a reader updates in the same ordered pass as the props and memos around it.
- The page sends only the value of a store from `brumate/store`. The server refuses a store of another library inside a provided value, with an error that names the context. [`bridge()`](#outside-stores) makes a store of another library that the page can send.
- `import { store } from 'brumate/store'` makes a store for a module: `export const theme = store('light')`. `Store` calls its listeners only when the value changes (`Object.is`).
- Keep functions for handlers. A reader renders from the store, not from a function that reads a signal.

## Outside stores

A store of another library, such as zustand, has its own functions to read and to listen. `$store` reads it from an import, `<script module>` or a call. To give it to the readers in a context or a prop, wrap it with `bridge()` from `brumate/store`. The page then sends the data of the store and the name of the bridge, and the browser makes the library's store again from that data.

```ts
// bears.ts
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import { bridge } from 'brumate/store';
import type { Bridge, BridgedStore } from 'brumate/store';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

interface Bears {
  bears: number;
  add: () => void;
}

export const bearStore: Bridge<StoreApi<Bears>, { bears: number }> = bridge({
  create: (snapshot?: { bears: number }) =>
    createStore<Bears>()((set) => ({
      bears: snapshot?.bears ?? 0,
      add: () => set((state) => ({ bears: state.bears + 1 })),
    })),
  get: (source) => ({ bears: source.getState().bears }),
  subscribe: (source, listener) => source.subscribe(listener),
  set: (source, value) => source.setState(value),
});

export const BearContext: Context<BridgedStore<StoreApi<Bears>, { bears: number }>> =
  createContext('bears');
```

A provider makes the store with the first data, and a reader binds it with `$store` and calls the actions of the library through `.source`:

```brm
<script>
  import { $setContext } from 'brumate/signals';
  import BearCount from './BearCount.brm';
  import { BearContext, bearStore } from './bears.ts';

  $setContext(BearContext, bearStore({ bears: 2 }));
</script>

<BearCount />
```

```brm BearCount.brm
<script>
  import { $getContext, $store } from 'brumate/signals';
  import { BearContext } from './bears.ts';

  const bear = $getContext(BearContext);
  const state = $store(bear);
</script>

<button onClick=(() => bear.source?.getState().add())>{state.bears} bears</button>
```

A child that gets the store in a prop reads and writes the same live store.

- `create(snapshot)` makes the library's store. On the server it runs once for each call of `bearStore(...)`, so a store made in a provider belongs to its request and no request shares it with another. In the browser it runs once, when the store gets its first subscriber, with the data that the server sent. All readers and prop holders share that one store.
- `get(source)` gives the data of the store. It goes in the page state, so it must be data that the page can send: numbers, strings, arrays and objects of them. If it gives something else, the server render throws an error that names the store and the context or prop that sends it.
- `subscribe(source, listener)` calls `listener` on each change and returns the function that stops it. The reader updates when `get` gives other data.
- `set(source, value)` is optional. `let state = $store(bear)` calls it when the variable is assigned, and a bridge without `set` throws a `TypeError` for `let`. Resume never calls `set`.
- If the first data of the browser's store differs from the server's, the readers are updated once.
- `.source` is the library's store. In the browser it is `undefined` until the store has a subscriber and the module of the bridge has loaded, since the browser makes the store at the first subscriber. A reader that binds the store with `$store` subscribes when the page resumes, but a handler that runs before the module has loaded sees `undefined`, so write `bear.source?.getState().add()` there.
- The value of `bridge()` must be a module-level export: of a script file, as in `export const bearStore = bridge({ … })`, `export { bearStore }` or `export default bridge({ … })`, or of the `<script module>` of a component, with `export const`. A bridge works from the app, from a workspace package, or from an installed package that lists `brumate` in `dependencies` or `peerDependencies` (also one that ships compiled `.js` and has no `brumate` field). The page state names an installed package's bridge by the package name and the path in it, as in `bridge:bear-kit/dist/index.js#bears`. When two versions of the package are installed, the name carries the version (`bridge:bear-kit@1.0.0/…`); two copies of one version are an error, so dedupe them. A bridge of `<script module>` is named by its component (`bridge:<component>#<export>`), and the browser loads the component's code with it, even if no other part of the component reads the bridge. The page state names the bridge by its module and its export, and the browser loads the module by that name. Any other place, such as the script of a component or a function, is a compile error ([BRM200](./errors.md#brm200)), and `brumate check` reports it. The module must also be one that the browser can load: it imports nothing that needs the server.
- With `isolatedDeclarations`, annotate the export, as `Bridge<StoreApi<Bears>, { bears: number }>` above.
