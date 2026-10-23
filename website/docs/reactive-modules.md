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
- Code that runs in the browser, such as `increment` and the memo of `double`, ships once for the module, however many components call it. Each call passes the values that the code works on, so a handler still loads on its own event.
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

## Errors and types

- An error in the code of the function points at the call in the component, and names the line in the module, as in `(in counter.brm.ts:7:5)`.
- Source maps point the copied code at the module, so the browser shows it in the module file.
- TypeScript sees an ordinary function call, so what the component destructures has the types that the function returns.

A module function runs only as a copy in a component. Called anywhere else, such as from a `.ts` file, its compile-time functions throw, because nothing compiles them.
