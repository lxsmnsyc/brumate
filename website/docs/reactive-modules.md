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

`$signal` and `$memo` also work at the top level of a `.brm.ts` module. They give one value for the module, which every component that imports it reads like its own signal.

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

The module is compiled to the stores of `brumate/store`, so the feature adds no runtime. `let items = $signal(v)` becomes `store(v)`, and `$memo(expression)` becomes a `derived` store of the module signals that the expression reads. Code in the module reads a signal as `items.get()` and writes it as `items.set(…)`, and `$produce(items, recipe)` works as it does in a component.

- A component reads an imported signal or memo like `$store(items)`. Reads render on the server, resume in the browser and update when the value changes.
- A component cannot write what it imports, because an import is read-only. Write it in a function that the module exports, such as `add`. Assigning to `items` in the component is `Cannot assign to module signal "items"`, with that advice.
- The same forms work in `<script module>`. A component writes a signal of its own `<script module>` in its script, since that is one file.
- A function that a component copies with `const { … } = name()` reads a module signal like an imported store, and stays live.
- A memo is lazy until something subscribes, and a memo over two module signals computes once per change.
- A memo tracks the module signals that its expression reads, and those that the functions it calls read: functions of the module, and exported functions of other `.brm.ts` modules, followed through their calls. A function that the memo cannot follow is BRM211, with the advice to pass the signals as arguments.
- A module reads a signal of another `.brm.ts` module like its own signal (`items.length`), and cannot write it: a write through an import is BRM117, so export a function from the module that owns it. The same holds for a `.brm` component that imports a signal of another component's `<script module>`.
- A `.ts` file that imports a module signal gets the store, while TypeScript says the type of its value. `brumate check` reports that import as BRM208. Read the value in an exported function instead.
- `$memo(await …)`, `$effect`, `$client` and the other compile-time functions cannot run at the top level of a module, and a signal cannot be the target of a destructuring write such as `[count] = values` (all BRM211). Put them in a component, or in a module function that a component calls.
- A module function that a component copies can write the module signals of its own module: its writes go to the store.

A module signal is one value for the whole server process, as `export const cart = store([])` is: two requests that write it share the value. A browser starts from the first value of its own module and repairs the page once if that differs from the value the server rendered. Keep per-request data in a context, which the framework holds for each request.

## Errors and types

- An error in the code of the function points at the call in the component, and names the line in the module, as in `(in counter.brm.ts:7:5)`.
- Source maps point the copied code at the module, so the browser shows it in the module file.
- TypeScript sees an ordinary function call, so what the component destructures has the types that the function returns.

A module function runs only as a copy in a component. Called anywhere else, such as from a `.ts` file, its compile-time functions throw, because nothing compiles them.
