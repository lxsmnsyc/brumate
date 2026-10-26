# The functions of brumate/signals

The compiler replaces each call and removes the import, so none of them ship. Import each one that the file calls: `import { $memo, $signal } from 'brumate/signals';`. A call of one that the file does not import is a compile error. They work only in `.brm` files and `.brm.ts` modules.

"Top level of a script" means a statement of the component's `<script>`, or of a `<script>` at the start of a block body. It is not inside a function or another statement.

| Function                      | Returns                    | Where                                                 |
| ----------------------------- | -------------------------- | ----------------------------------------------------- |
| `$props<T>()`                 | `T`                        | `const` or `let` in the component script              |
| `$signal<T>(value?)`          | `T`                        | `let` at the top level of a script                    |
| `$memo<T>(value)`             | the value, never a promise | `const` at the top level of a script                  |
| `$debounced(value, ms)`       | the value, as a memo       | `const` at the top level of a script                  |
| `$throttled(value, ms)`       | the value, as a memo       | `const` at the top level of a script                  |
| `$isPending(memo)`            | `boolean`                  | Any expression                                        |
| `$isPassed(prop)`             | `boolean`                  | `const` in the component script                       |
| `$isBound(prop)`              | `boolean`                  | Any expression                                        |
| `$effect(callback)`           | `void`                     | Statement at the top level of a script                |
| `$client(callback, trigger?)` | `void`                     | Statement at the top level of a script                |
| `$untrack(value)`             | the value                  | Any expression                                        |
| `$produce(signal, recipe)`    | `void`                     | Where a signal can be written                         |
| `$setContext(context, value)` | `void`                     | Statement at the top level of a script                |
| `$getContext(context)`        | the value                  | `const` at the top level of a script                  |
| `$route(path?)`               | `{ url, search, params }`  | `const` at the top level of a script                  |
| `$navigation()`               | `{ pending, from, to }`    | `const` at the top level of a script                  |
| `$id()`                       | `string`                   | `const` at the top level of a script                  |
| `$title(value)`               | `void`                     | Statement at the top level of a script                |
| `$action(fn)`                 | the result, or `undefined` | `const` at the top level of a script                  |
| `$optimistic(source)`         | the value of `source`      | `let` at the top level of a script                    |
| `$handler(fn, ...args)`       | a handler                  | Any expression of a script or a module function       |
| `$bind(value, set?)`          | a binding                  | The whole value of a prop, or of `value` or `checked` |

## What each one does

- `$props<T>()`: the props of the component. Destructure it: `const { title, size = 'm', ...rest } = $props<Props>()`. With `let`, the component writes the props, and `Bindable<T>` in the type marks one that a parent can bind. Not in a block script.
- `$signal(value)`: writable state. Read it and assign to it as a variable. The start value is computed once, on the server.
- `$memo(expression)`: a read-only value that follows the values it reads. It can hold a promise, such as a server function call, and gives the settled value.
- `$debounced(value, ms)`: a memo that takes the value once it stops changing for `ms` milliseconds. `ms` is a number literal.
- `$throttled(value, ms)`: a memo that takes the value at most once every `ms` milliseconds.
- `$isPending(memo)`: true while a new value of the memo loads in the browser. Always false on the server.
- `$isPassed(prop)`: true when the caller passed the prop, also as `undefined` or `null`. A default value does not count. The argument is a prop that the component destructures.
- `$isBound(prop)`: true when the caller passed the prop with `$bind`, so a write changes the caller's value. The argument is a prop destructured with `let`.
- `$effect(callback)`: runs the callback in the browser when a value that it reads changes. Never on mount, never on the server. The callback takes no parameters and is not `async`. It can return a cleanup function.
- `$client(callback, trigger?)`: runs the callback in the browser once. The trigger is `'visible'` (default), `'idle'` or `'load'`. It can return a cleanup function.
- `$untrack(value)`: reads a value, or calls a function, without depending on it.
- `$produce(signal, recipe)`: changes a draft of an object or array in a signal, and writes the result as a new value. The recipe can return a new value instead.
- `$setContext(context, value)`: gives a value of a context to the components inside. Create the context with `createContext` from `brumate/context`.
- `$getContext(context)`: reads a context from the nearest component above that provides it, or its default.
- `$route(path?)`: the current route, as `{ url, search, params }`. The path is the route, such as `'/posts/[id]'`, and takes at most one argument.
- `$navigation()`: the state of a navigation, as `{ pending, from, to }`. It takes no arguments.
- `$id()`: an ID that is unique in the page and the same on the server and in the browser. It takes no arguments.
- `$title(value)`: sets the title of the page. Prefer `<title>` in `#head`. It takes one argument.
- `$action(fn)`: the latest result of the server function `fn` of the same file, which a form of this component posts to. It is `undefined` before the first post.
- `$optimistic(source)`: a value that follows `source`, a memo, an action or a prop, and that handlers can write to show a guess. Write it with `=`, never `++` or `--`. `source` is not a signal.
- `$handler(fn, ...args)`: marks a function that a script makes as an event handler, so a spread passes it on. The arguments are JSON values, and the handler runs as `fn(...args, event)`.
- `$bind(value, set?)`: passes a value that the receiver writes back. The value is the name of a signal, or of a prop destructured with `let`. With `set`, a write calls `set(next)` instead of writing the value.

## Not supported

Calling one of these is a compile error that names the replacement: `$ref` (use a `$signal` with `ref=$bind(name)`), `$watch` (use `$effect`), `$settled` (use `$client`), `$cleanup` (return a function from `$effect` or `$client`), `$store` (assign a new value to a `$signal`, or use `$produce`), `$get` and `$set` (signals cannot leave the file).
