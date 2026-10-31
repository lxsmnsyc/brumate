# Components

A component is a `.brm` file. It has scripts for its state and logic, an optional style, and markup. Other components import it and render it with props.

## The parts of a file

```brm
<script module>
  // Runs once, when the module loads. Its exports can be imported by other files.
  export const MAX = 10;
</script>

<script>
  // Runs once for each instance, on the server. Declares the state of the component.
  import { $signal } from 'brumate/signals';

  let count = $signal(0);
</script>

<style>
  /* Applies only to this component. */
  button {
    font-weight: bold;
  }
</style>

<!-- Everything else is markup. -->
<button onClick=(() => count++)>{count} of {MAX}</button>
```

- `<script>` is the instance script. It runs on the server when the component renders, and never runs again in the browser. Code in it that the browser needs, such as an event handler, is split out into the client code of the page, which the browser loads when the page starts.
- `<script module>` runs once per module. Use it for constants, helpers and data that every instance shares.
- `<style>` is scoped to the component. [Styles](./styles.md) describes it.
- The markup can come before or after the scripts. Each part is optional.

The compile-time functions, such as `$signal` and `$props`, come from `brumate/signals`. The compiler replaces their calls, so nothing of `brumate/signals` ships to the browser.

## Using a component

Import the file, and render it with a capitalized tag. Attributes are its props:

```brm live
<script>
  import Greeting from './Greeting.brm';
</script>

<Greeting name="Ada" />
<Greeting name="Grace" excited=(true) />
```

```brm live Greeting.brm
<script>
  import { $props } from 'brumate/signals';

  const { name, excited = false } = $props<{ name: string; excited?: boolean }>();
</script>

<p>Hello, {name}{excited ? '!' : '.'}</p>
```

## Props

`$props()` returns the props of the component. Destructure the call, so each prop stays a name that the compiler can follow.

```ts
const { title, size = 'medium', ...rest } = $props<{
  title: string;
  size?: 'small' | 'medium' | 'large';
  id?: string;
}>();
```

- The type argument types the props. Callers get type errors for missing or wrong props, in the editor and in `brumate-tsc`.
- A default value, such as `size = 'medium'`, applies when the caller does not pass the prop.
- A rest element, such as `...rest`, collects the other props. Spread it onto an element with `{...rest}`.
- On an element with a spread, the attributes apply in their order, so a later one wins. A `class` adds to the others: `<a class="link" {...rest}>` with `class="primary"` in `rest` gets `class="link primary"`.
- Read props by their names. The props object and `...rest` can only be destructured, read one key at a time, or spread in markup. Any other use is a compile error (BRM115): a spread in script code, and passing them to a function, `$memo`, `$setContext`, a signal or a variable. The copy would lose the `ref` and the live props. Use `<button {...rest} class="box">` instead.

### Props that change

A prop changes in the browser only when the parent passes a value that can change there, such as a signal. The compiler finds these props across the project, so a prop that every parent passes as a constant ships no update code.

```brm live
<script>
  import { $signal } from 'brumate/signals';
  import Meter from './Meter.brm';

  let level = $signal(2);
</script>

<button onClick=(() => (level = (level + 1) % 6))>More</button>
<Meter value=level max=(5) />
```

```brm live Meter.brm
<script>
  import { $props } from 'brumate/signals';

  const { value, max } = $props<{ value: number; max: number }>();
</script>

<meter {value} min="0" {max} aria-label="Level"></meter>
<span>{value} of {max}</span>
```

### Props that the component writes

Destructure `$props()` with `let` to write a prop. `$bind` in the parent passes its own value, so the child's writes change it.

```brm live
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Toggle from './Toggle.brm';

  let open = $signal(false);
</script>

<p>The parent sees: {open ? 'on' : 'off'}</p>
<Toggle label="Bound" on=$bind(open) />
<Toggle label="Own copy" on=open />
```

```brm live Toggle.brm
<script>
  import { $props } from 'brumate/signals';
  import type { Bindable } from 'brumate/signals';

  const { label } = $props<{ label: string }>();
  let { on = false } = $props<{ on?: Bindable<boolean> }>();
</script>

<button onClick=(() => (on = !on))>{label}: {on ? 'on' : 'off'}</button>
```

- Without a binding, the component writes its own copy. A new value from the parent replaces the copy.
- `Bindable<T>` in the type marks a prop that a parent can bind.
- A component can bind a `let` prop to its own child, so a write goes up more than one level.
- A `const` prop stays read-only. Writing it is a compile error.
- `$bind` also works on `value` and `checked` of form fields: `<input value=$bind(draft)>`.

### Controlled and uncontrolled

A part such as a dialog keeps its own state, or writes the state of its caller. A `let` prop does both, so the caller picks:

```brm
<script>
  import { $props } from 'brumate/signals';
  import type { Bindable } from 'brumate/signals';

  const { onChange } = $props<{ onChange?: (open: boolean) => void }>();
  let { open = false } = $props<{ open?: Bindable<boolean> }>();

  function toggle() {
    open = !open;
    onChange?.(open);
  }
</script>

<button aria-expanded=open onClick=toggle>Details</button>
```

- Without `open`, or with `open=(true)`, the part keeps its own copy. A new value from the caller replaces it.
- With `open=$bind(settingsOpen)`, the part writes the caller's signal.
- With `open=$bind(settingsOpen, (next) => …)`, the setter decides. The part shows what the caller keeps.

A part that needs to know how the caller passed a prop asks with `$isPassed` and `$isBound` from `brumate/signals`:

```ts
let { value } = $props<{ value?: Bindable<string | null> }>();
// True for value=(null) too, so null can be a value that the caller passed.
const passed = $isPassed(value);
// True for value=$bind(selected).
const bound = () => $isBound(value);
```

### Forwarding a ref

A bare `ref=input` is a compile error (BRM027): write `ref=$bind(input)`.

A component that renders an element for its caller can pass the element on. It declares `ref` as a bindable prop, and puts `ref=$bind(ref)` on the element:

```brm live
<script>
  import { $bind, $signal } from 'brumate/signals';
  import FancyButton from './FancyButton.brm';

  let button = $signal<HTMLButtonElement>();
</script>

<FancyButton ref=$bind(button)>Save</FancyButton>
<button onClick=(() => button!.focus())>Focus the button</button>
```

```brm live FancyButton.brm
<script>
  import { $props } from 'brumate/signals';
  import type { Bindable } from 'brumate/signals';

  let { ref } = $props<{ ref?: Bindable<HTMLButtonElement> }>();
  const { children } = $props();
</script>

<button class="fancy" ref=$bind(ref)>{children}</button>
```

- `ref` is an ordinary bindable prop of the component. The caller binds it with `$bind`, as it binds any other.
- The component writes the element through the binding, so the signal of the caller gets it. Without a binding, the element stays in the component.
- A component can pass the binding on: `<Inner ref=$bind(ref) />`.
- A dynamic tag that names a component passes `ref` as a prop too: `<{as} ref=$bind(root)>`.
- The server does not send the element. Handlers and `$client` callbacks of the caller read the element in the browser, as they read the element of a `ref` in their own file.
- A `$client(…, 'visible')` of the caller does not wait for a forwarded element. It runs when the element that follows it comes into view.

### Functions as props

A component cannot write the signals of its parent. To let a child change a value, the parent passes a function that writes it:

```brm live
<script>
  import { $signal } from 'brumate/signals';
  import Stepper from './Stepper.brm';

  let quantity = $signal(1);
</script>

<Stepper value=quantity onChange=((value) => (quantity = value)) />
<p>You are buying {quantity}.</p>
```

```brm live Stepper.brm
<script>
  import { $props } from 'brumate/signals';

  const { value, onChange } = $props<{ value: number; onChange: (value: number) => void }>();
</script>

<button onClick=(() => onChange(value - 1)) disabled=(value <= 1)>-</button>
<span>{value}</span>
<button onClick=(() => onChange(value + 1))>+</button>
```

- The function runs in the browser, and writes the parent's signal. The parent then passes the new value down.
- A function passed as a prop must be code that can run in the browser, such as an arrow function or a function of the parent's script.
- The call runs at once and returns the result, as on the server, so the child can call a function prop in markup or a memo, such as a `filter`. The same holds for a function in a [context](./context.md). When the function only reads state, the memo, markup or effect that reads the prop runs again when that state changes. A function that writes state, or calls through a context value or a prop, stays a fixed handler, and so does a prop named `onX`. A write or a call inside `$untrack` does not count, so wrap an incidental one there to keep the function a derivation. A prop named `onX` stays fixed regardless.

### Handlers in a spread

A handler that the caller passes, such as `onClick`, goes through `{...rest}` to the element, with its wrappers of `brumate/events`. The element keeps its own handlers too, and both run, its own first:

```brm
<!-- Button.brm -->
<script>
  import { $props, $signal } from 'brumate/signals';

  const { label, ...rest } = $props();
  let pressed = $signal(0);
</script>

<button onClick=(() => pressed++) {...rest}>{label}</button>
```

```brm
<Button label="Save" onClick=(prevent(save)) />
```

- The caller's handler runs in the caller's component, as if the caller had put it on the element.
- A spread passes on handlers on the server and in markup that the browser renders, such as a new item of a `#for`.
- A function that the component makes itself, such as one that calls `rest.onClick`, goes through a spread only when `$handler` marks it. See below.

### Handlers that a script makes

A function in a script is not a handler until markup uses it, so a spread leaves it out. `$handler(fn, ...args)` from `brumate/signals` marks it as one. A function that makes the attributes of a button can then give its handler too:

```brm live
<script>
  import { $handler, $signal } from 'brumate/signals';
  import { prevent } from 'brumate/events';

  let items = $signal(['Milk', 'Bread', 'Eggs']);

  function removeAt(index: number) {
    items = items.filter((_, at) => at !== index);
  }

  const remove = (index: number) => ({
    type: 'button',
    'aria-label': `Remove ${items[index]}`,
    onClick: $handler(prevent(removeAt), index),
  });
</script>

<ul>
  #for (item, index of items by item) {
    <li>{item} <button {...remove(index)}>×</button></li>
  }
</ul>
```

- `index` is an argument: it goes with the handler, and the handler runs as `removeAt(index, event)`. Arguments are JSON values.
- The handler reads the values of the component, such as `items`, as a handler in markup does. A value of the function around the call, such as `index`, must be an argument.
- `prevent` applies before the code of the handler loads, as in markup.
- A [module function](./reactive-modules.md) can call `$handler` too, so a library can give attributes with their handlers.

### `children`

Markup between the tags of a component is its `children` prop. Insert it with `{children}`:

```brm live
<script>
  import { $signal } from 'brumate/signals';
  import Panel from './Panel.brm';

  let likes = $signal(0);
</script>

<Panel title="Details">
  <p>The children render where the panel puts them.</p>
  <button onClick=(() => likes++)>Like ({likes})</button>
</Panel>
```

```brm live Panel.brm
<script>
  import { $props, $signal } from 'brumate/signals';

  const { title, children } = $props<{ title: string; children?: unknown }>();
  let open = $signal(false);
</script>

<section>
  <button onClick=(() => (open = !open)) aria-expanded=open>{title}</button>
  #if (open) {
    <div>{children}</div>
  }
</section>
```

- The children render where the component inserts them, so they read the contexts that the component provides. A `Tab` passed into a `Tabs` reads the context of the `Tabs`, as if `Tabs` rendered it.
- Their values and handlers stay the caller's: `{count}` in the children is the caller's `count`.
- The server renders the children with the page, also when the component does not insert them yet.
- When the component inserts them later, such as when the `#if` opens, they show the current values. Their event handlers work.

### Templates as props

A `#template` is a piece of markup with parameters. Pass one as a prop to let a component render your markup for its own data:

```brm live
<script>
  import List from './List.brm';

  const fruits = ['apple', 'pear', 'plum'];
</script>

<List items=fruits item=fruit />

#template fruit(name) {
  <strong>{name}</strong>
}
```

```brm live List.brm
<script>
  import { $props } from 'brumate/signals';

  const { items, item } = $props<{ items: string[]; item: (name: string) => unknown }>();
</script>

<ul>
  #for (name of items) {
    <li>{item(name)}</li>
  }
</ul>
```

- A parameter without a type takes it from the prop, here `string` from `item`. A type on the parameter, such as `name: string`, is allowed too. A template that the code calls, or passes in another way, needs the types of its parameters.
- The component can call the template in markup that changes in the browser, such as the items of a list, or a selected item. The template renders with the code of the component that wrote it.
- A call again at the same place, with new arguments, updates the markup in place, as a snippet of Svelte does. Its elements stay, and so does focus in them.
- The template reads the values of the component that wrote it, and its markup updates when they change.
- Its code loads in the browser with the page state, before an update needs it.

[Control flow](./control-flow.md#template) describes `#template`.

### Promises as props

A prop can be a promise. See [Promises as props](./async-data.md#promises-as-props).

## Generic components

`generics` on the instance script declares type parameters, so the props of a component can depend on each other:

```brm
<script generics="T">
  import { $props } from 'brumate/signals';

  const { items, label } = $props<{ items: T[]; label: (item: T) => string }>();
</script>
```

## What a component cannot do

- Signals never leave the file. A function or a child receives the value of a signal, never the signal itself. This is how the compiler sees every read and every write.
- A child cannot write a prop. It calls a function that the parent passes, as above.
- Scripts, expressions and attribute values cannot contain markup. Use a `#template` for markup that is used as a value, and `#for` for lists.

To share a value with every component inside a component, without passing it through each one, use a [context](./context.md).
