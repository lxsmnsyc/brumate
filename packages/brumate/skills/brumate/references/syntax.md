# Syntax

## The parts of a file

```brm
<script module>
  export const MAX = 10;
</script>

<script>
  import { $signal } from 'brumate/signals';

  let count = $signal(0);
</script>

<style>
  button {
    font-weight: bold;
  }
</style>

<button onClick=(() => count++)>{count} of {MAX}</button>
```

- `<script>` runs once for each instance, on the server. `<script module>` runs once per module, and its exports can be imported.
- `<style>` is scoped to the component. `lang="scss"` and `lang="less"` work.
- A file has at most one of each script. Markup can come before or after them.
- Markup in a script, an expression or an attribute value is an error. Use a `#template`.

## Expressions and attributes

`{expression}` inserts text. It is escaped, and `null`, `undefined`, `true` and `false` insert nothing. Use `raw(html)` from `brumate/html` for HTML that you trust.

```brm
<script>
  import { $signal } from 'brumate/signals';

  let name = $signal('Ada');
  let on = $signal(false);
  const rest = { id: 'main' };
  const href = '/about';
</script>

<input type="text" value=name maxlength=(20 - 1) disabled=(!name)>
<a {href} {...rest} class={ on, big: name.length > 3 }>About</a>
<p style={ color: on ? 'crimson' : undefined }>{name.toUpperCase()}</p>
```

- Quoted values are strings. A name, a property path, a call, a number, an object or a template string can stand without quotes. Anything else, such as an operator, goes in parentheses.
- `null` and `undefined` leave the attribute out. `false` leaves out a plain attribute such as `disabled`, and says `"false"` for `aria-*` and `data-*`.
- `class` takes a string, an array or an object of class names. `style` takes a string or an object in camel case.
- `<{tag}>` renders the element or component that `tag` names. Close it with `</>`.

```brm wrong="Wrap this attribute value in parentheses"
<script>
  import { $signal } from 'brumate/signals';

  let count = $signal(0);
</script>

<input value=count+1>
```

## Props

```brm
<script>
  import { $props } from 'brumate/signals';

  const { title, size = 'medium', children, ...rest } = $props<{
    title: string;
    size?: 'small' | 'medium' | 'large';
    children?: unknown;
  }>();
</script>

<section data-size=size {...rest}>
  <h2>{title}</h2>
  {children}
</section>
```

- Destructure `$props()`. Do not keep the object.
- Markup between the tags of a component is `children`.
- Props are read-only with `const`. Writing one is an error.
- A prop that a child writes is declared with `let` and typed `Bindable<T>`:

```brm
<script>
  import { $props } from 'brumate/signals';
  import type { Bindable } from 'brumate/signals';

  let { on = false } = $props<{ on?: Bindable<boolean> }>();
</script>

<button aria-pressed=on onClick=(() => (on = !on))>Toggle</button>
```

The parent passes `on=$bind(open)` to write its signal, or `on=open` to give a start value that the child copies. `$bind` also works on `value` and `checked` of `<input>`, `<select>` and `<textarea>`.

A component that renders an element for its caller forwards the element with a bindable `ref` prop:

```brm
<script>
  import { $props } from 'brumate/signals';
  import type { Bindable } from 'brumate/signals';

  let { ref } = $props<{ ref?: Bindable<HTMLButtonElement> }>();
  const { children } = $props();
</script>

<button ref=$bind(ref)>{children}</button>
```

A file that has generic props declares them on the script: `<script generics="T">`.

A file uses another component by importing it, and renders it with a capitalized tag: `import Card from './Card.brm';`, then `<Card title="Hello" />`.

## Control flow

```brm
<script>
  import { $signal } from 'brumate/signals';

  let people = $signal([{ id: 1, name: 'Ada' }]);
  let tab = $signal<'a' | 'b'>('a');
  let open = $signal(false);
</script>

#if (people.length > 3) {
  <p>Many</p>
} #else if (people.length > 0) {
  <p>Some</p>
} #else {
  <p>None</p>
}

<ol>
  #for (person, index of people by person.id) {
    <li>{index + 1}. {person.name}</li>
  } #else {
    <li>Nobody</li>
  }
</ol>

#repeat (star of 5) {
  <i>{star}</i>
}

#switch {
  #case (tab === 'a') {
    <p>A</p>
  }
  #default {
    <p>Other</p>
  }
}

#key (tab) {
  <p>Starts over when the tab changes.</p>
}

#try {
  <p>{people[0].name}</p>
} #catch (error, reset) {
  <p>{String(error)}</p>
}

#portal {
  <p>At the end of the page.</p>
}

#offscreen (open) {
  <p>Hidden, and kept, while open is false.</p>
}

#client ('idle') {
  <p>Rendered in the browser.</p>
} #else {
  <p>Shown until then.</p>
}
```

- The body of a block can start with a `<script>` of its own, which runs for each instance, such as each item of a `#for`. It can declare signals and functions.
- `#for (item of list) window(32) { … }` renders only the items in view, for a long list. `32` is the height of an item.
- `#loading { … } #else { … }` and `#defer { … }` are for async data. See state.md.

```brm wrong="#else must follow its block"
<p>One</p>
#else {
  <p>Two</p>
}
```

## Templates

`#template name(parameters) { … }` is markup as a value. Declare it at the top level of the markup or at the start of a block body, and call it in an expression. A component can take one as a prop and call it for its own data.

```brm
<script>
  const total = 42;
</script>

#template price(label: string, amount: number) {
  <p><strong>{label}:</strong> {amount.toFixed(2)}</p>
}

{price('Subtotal', total)}
{price('Tax', total * 0.1)}
```

## Other parts of the markup

- `<window onKeyDown=(handler) />` and `<document onClick=(handler) />` listen to events of the window and the document. They close with `/>`.
- `$id()` gives an ID that is the same on the server and in the browser: `const field = $id();`, then `<label for=field>` and `<input id=field>`.
- `<script>` can export nothing. A value that other files import goes in `<script module>`.
- `#head { <title>{title}</title> <meta name="description" content="…"> }` sets the head of the page. A `<title>` outside `#head` is an error.
- A value that changes in a `<textarea>` or `<title>` must be its whole content: `<textarea>{text}</textarea>`.

## Modules of reactive logic

A file that ends in `.brm.ts` holds functions that use `$signal` and `$memo` for several components. The compiler copies the body into the component that calls it.

```ts
// counter.brm.ts
import { $memo, $signal } from 'brumate/signals';

export function counter(start: number) {
  let count = $signal(start);
  const double = $memo(count * 2);
  function increment() {
    count++;
  }
  return { count, double, increment };
}
```

```brm fragment
<script>
  import { counter } from './counter.brm.ts';

  const { count, increment } = counter(1);
</script>

<button onClick=increment>{count}</button>
```

- The function ends with `return { … }`, an object of plain keys, and returns nowhere else.
- A component calls it at the top level of its script, and destructures the result with plain names.
