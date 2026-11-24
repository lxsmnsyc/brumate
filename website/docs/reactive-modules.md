# Reactive logic in modules

A `.brm.ts` module holds state and logic that several components share. Its functions use `$signal`, `$memo` and the other compile-time functions, and a component calls one at the top level of its script.

```brm live
<script>
  import { counter } from './counter.brm.ts';

  const { count, double, increment, reset } = counter(1);
</script>

<button onClick=increment>Clicked {count} times</button>
<button onClick=reset>Reset</button>
<p>Double: {double}</p>
```

```ts live counter.brm.ts
import { $memo, $signal } from 'brumate/signals';

export function counter(start: number) {
  let count = $signal(start);
  const double = $memo(count * 2);

  function increment() {
    count++;
  }

  return { count, double, increment, reset: () => (count = start) };
}
```

## How it works

The compiler copies the body of the function into the component, in place of the call. Its signals and memos become values of the component, as if the component declared them itself.

- Each call has its own values. Two calls of `counter` make two counts.
- Code that runs in the browser, such as `increment` and the memo of `double`, ships once for the module, however many components call it. Each call passes the values that the code works on.
- A literal argument, such as `1`, is written into the code. It does not become a value in the state of the page.
- What the component destructures takes the names it gives. `const { count: clicks } = counter(1)` names the signal `clicks`.
- The other locals of the function get names of their own, so they never clash with the names of the component.

## Write a module function

- The file name ends in `.brm.ts`, so the compiler knows to copy its functions.
- The function is exported, as `export function name()` or `export const name = () => { … }`.
- It ends with `return { … }`, an object of what it gives the component. It cannot return anywhere else.
- A returned key holds a local, such as `count`, or a value, such as `reset: () => (count = start)`.
- Getters and setters cannot be returned. Return the signal itself, and the component reads it as a value.

The module can import other modules and declare constants. The function can read them, and the component imports them for it. A constant that the function reads must be exported, because the component imports it from the module.

## Call it from a component

Destructure the call at the top level of a `<script>`:

```brm
<script>
  import { counter } from './counter.brm.ts';

  const { count, increment } = counter(1);
</script>
```

- The call must be at the top level, because its values are fixed values of the component. A call in a function, a condition or a loop is a compile error.
- The result must be destructured. `const result = counter(1)` is a compile error.
- A key that the function does not return is a compile error.
- The script of a block can call it too, such as the script of a `#for` body. Each item gets its own values.

## Pass a signal in

An argument that is a name, such as a signal or a prop, stays reactive inside the function. Any other argument is computed once, when the component renders.

```brm live
<script>
  import { $signal } from 'brumate/signals';
  import { scaled } from './scaled.brm.ts';

  let size = $signal(2);
  const { area } = scaled(size);
</script>

<button onClick=(() => size++)>Size {size}</button>
<p>Area: {area}</p>
```

```ts live scaled.brm.ts
import { $memo } from 'brumate/signals';

export function scaled(size: number) {
  const area = $memo(size * size);
  return { area };
}
```

Here `area` follows `size`, because the memo reads the component's signal. With `scaled(2)`, it would stay at 4.

## Effects and other compile-time functions

A module function can use `$effect`, `$client`, `$produce`, `$untrack` and the rest. They behave as in the component that calls the function.

A function that gives a handler with [`$handler`](./components.md#handlers-that-a-script-makes) is compiled into each component that calls it, rather than shared, because its handler is a part of that component.

```brm live
<script>
  import { clock } from './clock.brm.ts';

  const { seconds } = clock();
</script>

<p>{seconds} seconds on this page</p>
```

```ts live clock.brm.ts
import { $client, $signal } from 'brumate/signals';

export function clock() {
  let seconds = $signal(0);
  $client(() => {
    const timer = setInterval(() => seconds++, 1000);
    return () => clearInterval(timer);
  });
  return { seconds };
}
```

## Shared state at module level

`$signal`, `$memo`, `$gate`, `$debounced`, `$throttled` and `$optimistic` also work at the top level of a `.brm.ts` module. They give one value for the module, which every component that imports it reads like its own signal. [The list of forms](#the-forms-a-module-can-declare) says what each one does there.

```brm live
<script>
  import { add, items, total } from './cart.brm.ts';
</script>

<button onClick=(() => add(5))>Add</button>
<p>{items.length} items, {total}</p>
```

```ts live cart.brm.ts
import { $memo, $signal } from 'brumate/signals';

export let items: number[] = $signal<number[]>([]);
export const total: number = $memo(items.reduce((sum, price) => sum + price, 0));

export function add(price: number): void {
  items = [...items, price];
}
```

The module is compiled to the stores of `brumate/store`, so the feature adds nothing to a page that does not use it. `let items = $signal(v)` becomes `store(v)`, and `$memo(expression)` becomes a store of the module signals that the expression reads, which holds an error (see below) and can load a value (see [A memo that loads](#a-memo-that-loads)). The `derived` of `brumate/store` that you call yourself does not hold errors. Code in the module reads a signal as `items.get()` and writes it as `items.set(…)`, and `$produce(items, recipe)` works as it does in a component.

- A component reads an imported signal like `$store(items)`, and an imported memo as a memo of its own. Reads render on the server, resume in the browser and update when the value changes.
- A component cannot write what it imports, because an import is read-only. Write it in a function that the module exports, such as `add`. Assigning to `items` in the component is `Cannot assign to module signal "items"`, with that advice.
- The same forms work in `<script module>`. A component writes a signal of its own `<script module>` in its script, since that is one file.
- A function that a component copies with `const { … } = name()` reads a module signal like an imported store, and stays live.
- A memo computes when it is first read, and again when a module signal that it reads changes. A memo over two module signals computes once per change.
- A memo tracks the module signals that its expression reads, and those that the functions it calls read: functions of the module, and exported functions of other `.brm.ts` modules, followed through their calls. A function that the memo cannot follow is BRM211, with the advice to pass the signals as arguments.
- A module reads a signal of another `.brm.ts` module like its own signal (`items.length`), and cannot write it: a write through an import is BRM117, so export a function from the module that owns it. The same holds for a `.brm` component that imports a signal of another component's `<script module>`.
- A `.ts` file that imports a module signal gets the store, while TypeScript says the type of its value. `brumate check` reports that import as BRM208. Read the value in an exported function instead.
- `$effect`, `$client` and the compile-time functions that need a component (`$props`, `$setContext`, `$getContext`, `$route`, `$searchParam`, `$navigation`, `$id`, `$title`, `$action`, `$handler`, `$bind`, `$isBound`, `$isPassed`) cannot run at the top level of a module, and a signal cannot be the target of a destructuring write such as `[count] = values` (all BRM211). Put them in a component, or in a module function that a component calls.
- A module function that a component copies can write the module signals of its own module: its writes go to the store.

### The forms a module can declare

Each form is declared on its own at the top level, as in a component, with one value per module.

| Form                    | Declare with | At module level                                                                                                                                                           |
| ----------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$signal(value)`        | `let`        | A `store`. Exported functions write it.                                                                                                                                   |
| `$memo(expression)`     | `const`      | A store of the module signals that the expression reads. Its value can load: a promise, `await` or an async iterable, as in a component.                                  |
| `$gate(value, guard)`   | `const`      | A store that keeps its value when `guard(prev, next)` returns false. The first value passes, and so does the first one after an error.                                    |
| `$debounced(value, ms)` | `const`      | A store that the browser writes once the value has not changed for `ms`. It is pending while it waits. The server has the value itself.                                   |
| `$throttled(value, ms)` | `const`      | A store that the browser writes at most once every `ms`, with the last value after the wait. It is pending while it waits.                                                |
| `$optimistic(source)`   | `let`        | A store that follows the module memo `source`. An exported function writes a guess. It goes back when the source changes, or when every server call of the page finishes. |
| `$untrack(expression)`  | in a form    | Reads the module signals in the expression without making them sources of the memo, the gate or the timed value.                                                          |

```ts
// search.brm.ts
import { $debounced, $gate, $memo, $signal, $untrack } from 'brumate/signals';

export let input: string = $signal('');
export const query: string = $gate(input, (_, next) => next.length >= 2);
export const typed: string = $debounced(input, 300);
export const label: string = $memo(`${query} (${$untrack(input.length)})`);

export function type(text: string): void {
  input = text;
}
```

- The arguments are those of the component forms, and an error that a component form has keeps its code: BRM085 to BRM092 for the declaration and the arguments, BRM120 for a signal as the source of `$optimistic`, BRM161 for `++` and `--` on it, BRM202 and BRM203 for `$gate`. `$optimistic` follows a memo of a module. Anything else that a module cannot compile, such as `await` in a debounced value or a source that is no module memo, is BRM211.
- A component reads an imported memo, gate or timed value as a memo of its own, and an optimistic value like `$store(x)`. A form over a memo that loads waits for it, as in a component. `$isPending(typed)` is true while a debounced or throttled value waits, and so is the `$isPending` of a memo that reads it. `$resolve(typed)` waits for it, and `$untrack` reads it once.
- The guard of `$gate` does not track what it reads and runs in the browser, on changes. Without a subscriber a gate has no history, so it gives the value, as the server renders it. A throw in the guard, in a memo, or in a debounced or throttled value is held as in a component: the write that caused it does not throw, the other values of the change still update, and each read of the store throws the error, which goes to the nearest `#try` of the component that reads it. The next value that computes without a throw replaces it. The gate lets that value pass without the guard.
- `$optimistic` follows a memo, as in a component, and not a signal: write the signal from the exported function. Its guess is a browser state, so a write on the server does nothing.
- `$effect` and `$client` stay BRM211 at the top level, since they need a component.

### A memo that loads

A memo of a module takes the same values as one of a component: a promise, `await`, and an async iterable.

```ts
// user.brm.ts
import { $memo, $signal } from 'brumate/signals';
import { fetchUser } from './api.ts';

export let id: number = $signal(1);
export const user: User = $memo(await fetchUser(id));

export function show(next: number): void {
  id = next;
}
```

```brm
<script>
  import { $isPending } from 'brumate/signals';
  import { user } from './user.brm.ts';
</script>

#loading {
  <h1 class={ pending: $isPending(user) }>{user.name}</h1>
} #else {
  <p>Loading…</p>
}
```

- A component reads the memo as a memo of its own, so `#loading`, `await user`, `$isPending(user)`, `await $resolve(user)` and `#try` work as in [Async data](./async-data.md). A handler that reads a memo with `await` and no guard is BRM182, as for a memo of the component.
- The memo loads once for all its readers, for the latest values of the module signals that it reads, and again when one of them changes. Only the latest load is written, and the old value stays while a new one loads.
- The server waits for it, or streams it in `#loading`, as for a memo of a component. The page state sends its value, as for a memo of a component. The browser takes that value on resume and loads again when a signal that the memo reads changes, so code of the module that reads it, such as an exported function that a handler calls, gets the value without a load.
- A stream gives each of its values in turn in the browser. The server renders its first value.
- A load that fails goes to the nearest `#try` of each component that reads the memo. In the browser the memo holds the error until a signal that it reads changes.
- Code in the module that reads the memo before its first value has loaded throws `This value is still loading`. A memo, a gate or a timed value of the module that reads it waits for it, and is pending meanwhile.

A module signal is one value for the whole server process, as `export const cart = store([])` is: two requests that write it share the value. A memo that loads is one load for the process too: the requests share it while it loads and after, and it loads again when a signal that it reads changes. A load that fails goes to the requests that read it, and the next request loads again. A browser starts from the first value of its own module and repairs the page once if that differs from the value the server rendered. Keep per-request data in a context, which the framework holds for each request.

## Errors and types

- An error in the code of the function points at the call in the component, and names the line in the module, as in `(in counter.brm.ts:7:5)`.
- Source maps point the copied code at the module, so the browser shows it in the module file.
- TypeScript sees an ordinary function call, so what the component destructures has the types that the function returns.

A module function runs only as a copy in a component. Called anywhere else, such as from a `.ts` file, its compile-time functions throw, because nothing compiles them.
