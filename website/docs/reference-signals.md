# Compile-time functions

The functions of `brumate/signals` describe state and behavior to the compiler. The compiler replaces every call and removes the import, so none of them ship.

```ts
import { $memo, $signal } from 'brumate/signals';
```

- A call needs the import. A call of a function that the file does not import is a compile error.
- A renamed import works, as in `import { $signal as signal } from 'brumate/signals'`.
- They work only in `.brm` files. A call anywhere else throws.
- "Top level of a script" means a statement of the component's `<script>`, or of a `<script>` at the start of a block body. It is not inside a function or another statement.

## Summary

| Function                      | Returns                    | Where                                  | Guide                                              |
| ----------------------------- | -------------------------- | -------------------------------------- | -------------------------------------------------- |
| `$props<T>()`                 | `T`                        | `const` in the component script        | [Components](./components.md)                      |
| `$signal<T>(value?)`          | `T`                        | `let` at the top level of a script     | [State](./state.md)                                |
| `$memo<T>(value)`             | `MemoValue<T>`             | `const` at the top level of a script   | [State](./state.md), [Async data](./async-data.md) |
| `$isPending(memo)`            | `boolean`                  | Any expression                         | [Async data](./async-data.md)                      |
| `$effect(callback)`           | `void`                     | Statement at the top level of a script | [Effects](./effects.md)                            |
| `$client(callback, trigger?)` | `void`                     | Statement at the top level of a script | [Effects](./effects.md)                            |
| `$untrack(value)`             | the value                  | Any expression                         | [State](./state.md)                                |
| `$produce(signal, recipe)`    | `void`                     | Where a signal can be written          | [State](./state.md)                                |
| `$provide(context, value)`    | `void`                     | Statement at the top level of a script | [Context](./context.md)                            |
| `$context(context)`           | the value                  | `const` at the top level of a script   | [Context](./context.md)                            |
| `$id()`                       | `string`                   | `const` at the top level of a script   | [Page metadata](./page-metadata.md)                |
| `$title(value)`               | `void`                     | Statement at the top level of a script | [Page metadata](./page-metadata.md)                |
| `$action(fn)`                 | the result, or `undefined` | `const` at the top level of a script   | [Forms](./forms.md)                                |
| `$optimistic(source)`         | the value of `source`      | `let` at the top level of a script     | [Forms](./forms.md#showing-a-guess-while-it-posts) |

## `$props`

```ts
function $props<T = Record<string, any>>(): T;
```

Returns the props of the component.

- Assign it to a `const`, as a name or an object pattern. It takes no arguments.
- It can be called only in the component script, not in a block script.
- Destructuring the call keeps each prop reactive: `const { value } = $props()`.
- Server: the props that the parent passed.
- Client: a prop changes only when the parent passes a value that can change.

## `$signal`

```ts
function $signal<T>(value: T): T;
function $signal<T>(): T | undefined;
```

Declares writable state. Reading the variable reads the value, and assigning to it writes the value.

- Declare it with `let`, as a single name. It takes at most one argument.
- Server: the initial value is computed once. It does not track what it reads.
- Client: it can be written in event handlers, `$effect` and `$client` callbacks, and the functions that they call. A write anywhere else is a compile error.
- Its value is sent to the browser only when client code needs it.

## `$memo`

```ts
function $memo<T>(value: T): MemoValue<T>;
type MemoValue<T> = Awaited<T> extends AsyncIterable<infer U> ? U : Awaited<T>;
```

Declares a read-only value computed from other values.

- Declare it with `const`, as a single name. It needs one argument. `await` can be used in it.
- A promise is awaited where the memo is read. An async iterable gives each of its values in turn.
- Assigning to it is a compile error.
- Server: computed when first read. Markup outside every `#loading` body waits for a promise. A `#loading` body that reads it renders after the rest of the page.
- Client: computed again when the values it reads change. While a new promise loads, the memo keeps its old value. Only the latest run is written.

## `$isPending`

```ts
function $isPending(memo: unknown): boolean;
```

True while a new value of the memo loads in the browser, or a value that it reads loads.

- Its only argument is the name of a memo.
- Server: always `false`.
- Client: `true` from the start of a load until its value is written.

## `$effect`

```ts
function $effect(callback: () => void | (() => void)): void;
```

Runs `callback` when the values that it reads change.

- A statement at the top level of a script. The callback takes no parameters and cannot be `async`.
- Server: never runs.
- Client: never runs on page load. Its first run is after the first change of a value it reads. The returned function runs before the next run and when the scope is removed.
- Reads inside functions that the callback calls count too. Wrap a call in `$untrack` to read without depending on it.

## `$client`

```ts
function $client(callback: () => void | (() => void), trigger?: 'visible' | 'idle' | 'load'): void;
```

Runs `callback` in the browser once, when a trigger fires.

| Trigger     | Runs when                                                                |
| ----------- | ------------------------------------------------------------------------ |
| `'visible'` | The first element of the scope enters the viewport. This is the default. |
| `'idle'`    | The browser is idle after the page loads.                                |
| `'load'`    | The page loads. The compiler warns, because this runs before any event.  |

- A statement at the top level of a script. The callback takes no parameters and cannot be `async`.
- Server: never runs.
- Client: the returned function runs when the scope is removed.

## `$untrack`

```ts
function $untrack<T>(value: T): T;
```

Reads a value without depending on it. A memo or effect that reads `$untrack(count)` does not run again when `count` changes. A function called inside it, such as `$untrack(save())`, adds no dependencies either.

## `$produce`

```ts
function $produce<T>(signal: T, recipe: (draft: T) => T | void): void;
```

Changes an object or array in a signal through a draft, and writes the signal with the result.

- The first argument is a signal. The second is a function.
- It is allowed where a signal can be written.
- The new value shares the objects that the recipe did not change. If the recipe changes nothing, the signal keeps its value.
- Only plain objects and arrays are drafted.

## `$provide`

```ts
function $provide<T>(context: Context<T>, value: T): void;
```

Provides a value of a context to the components inside this one. A statement at the top level of a script. When `value` changes in the browser, every component that reads it updates. Create the context with `createContext` from `brumate/context`.

## `$context`

```ts
function $context<T>(context: Context<T>): T;
```

Reads a context from the nearest component above that provides it, or its default value. Assign it to a `const` at the top level of a script.

## `$id`

```ts
function $id(): string;
```

Returns an ID that is unique in the page, for attributes such as `for` and `aria-describedby`. Assign it to a `const` at the top level of a script. Server and client make the same ID. In the script of a block, such as the body of a `#for`, each instance gets its own.

## `$title`

```ts
function $title(value: unknown): void;
```

Sets the title of the page. A statement at the top level of a script, with one argument.

- Server: writes `<title>` into the head. If several components set it, the last one that renders wins.
- Client: when the value changes, the title changes.

## `$action`

```ts
function $action<F extends (...args: never[]) => unknown>(fn: F): Awaited<ReturnType<F>> | undefined;
```

The latest result of a server function that a form of this component posts to.

- Assign it to a `const` at the top level of a script. The argument is a server function of the same file.
- It is `undefined` before the first post. `$isPending(result)` is true while the form sends.
- Without scripts, the page renders again with the result.

## `$optimistic`

```ts
let shown = $optimistic(names);
```

- It follows `source`, a memo, an action or a prop, and handlers can write it.
- A write shows a guess. The guess stays until `source` changes, or until every server call of the page finishes.
- Write it with `=`. `++` and `--` are compile errors.
- `source` is a name. A signal is a compile error, because a handler can write a signal directly.

## Not supported

These names are reserved, and calling one is a compile error that names the replacement:

| Name           | Use instead                                      |
| -------------- | ------------------------------------------------ |
| `$ref`         | A `$signal` with `ref=name` on the element.      |
| `$watch`       | `$effect`.                                       |
| `$settled`     | `$client`.                                       |
| `$cleanup`     | A function returned from `$effect` or `$client`. |
| `$store`       | A `$signal` with a new value, or `$produce`.     |
| `$get`, `$set` | Nothing. Signals cannot leave the file.          |
