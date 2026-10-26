# TypeScript

`brumate-tsc` type-checks a project with its `.brm` files, and the TypeScript plugin gives editors the same types. A `.ts` file that imports a component gets the type of its props.

## Checking a project

```bash
pnpm add -D @brumate/tsc
brumate-tsc --noEmit
```

- `brumate-tsc` takes the options of `tsc`, and checks `.ts` and `.brm` files together.
- Add `brumate/types` to the types of the project. It declares `.brm` modules and the virtual modules of the Vite plugin.

```json
{
  "compilerOptions": {
    "types": ["brumate/types"]
  }
}
```

A file with a syntax error is reported with the code `BRM`. Its scripts are still checked.

## In an editor

In VS Code, the [extension](./editor.md) adds the plugin itself.

In another editor, add the plugin to `tsconfig.json`, and use the TypeScript version of the workspace:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@brumate/typescript-plugin" }]
  }
}
```

## What is checked

- The scripts, as TypeScript.
- Every expression in the markup: attributes, inserts, block headers and style variables. Each one sees the names around it, such as the item of a `#for`.
- The props of components. A prop with the wrong type, or one that the component does not take, is reported at the prop, and a missing prop at the tag. The props type is the type argument of `$props<T>()`, or of every call of it together. A component that passes other attributes on takes them with an index signature, such as `[attribute: string]: unknown`.
- Event handlers on elements. The event has the type of its name, such as `MouseEvent` for `onClick`, and `event.currentTarget` is the element, such as `HTMLInputElement` for `<input>`.
- The items and indexes of `#for`, the `error` and `reset` of `#catch`, and the parameters of `#template`.
- Links made with `href` from `brumate/routes`, against the route files. See [Routing](./routing.md).
- Values that the page sends to the client. A signal or memo that client code reads must hold a [serializable value](./reference-serialization.md). A function, an instance of a class with methods, or a regular expression is reported at its declaration:

```brm
<script>
  import { $signal } from 'brumate/signals';

  let format = $signal((value: number) => String(value));
  // error: A function cannot be sent to the client. Keep it out of the signal or memo
</script>
```

Values that only the server reads are not checked, because they are not sent.

## Props types

Other files need the props type of a component, such as a wrapper that passes props on, a story or a test. A component exports it from `<script module>`, and its instance script uses it:

```brm
<script module>
  export interface BadgeProps {
    label: string;
    isDisabled?: boolean;
  }
</script>

<script>
  import { $props } from 'brumate/signals';

  const { label, isDisabled } = $props<BadgeProps>();
</script>
```

Any other file imports it by name, as a type:

```ts
import type { BadgeProps } from './Badge.brm';

const props: BadgeProps = { label: 'New', isDisabled: 'yes' };
// error: Type 'string' is not assignable to type 'boolean | undefined'
```

- A `.brm` file imports it the same way, and a test does too. The type is the real one, so a wrong prop is an error in each of them.
- It works where the TypeScript plugin of brumate runs: in the editor, and in `brumate-tsc`. Plain `tsc` reads `.brm` imports through `declare module '*.brm'` and sees `any`.
- A component with more than one `$props<T>()` call, such as one for its bindable props, takes the props of all of them together. Export one type that holds every prop, and use it in each call.
- Export a type, not a value, from `<script module>`, since only the type is needed.

### Extending the props of another component

A wrapper that adds props to a component uses an intersection, since an interface cannot extend a type that depends on a parameter:

```brm
<script module>
  import type { ButtonProps } from '@brumate/ui/Button.brm';

  export type FancyProps = ButtonProps<'button'> & { tone?: 'red' | 'blue' };
</script>

<script>
  import { $props } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';

  const { tone, children, ...rest } = $props<FancyProps>();
</script>

<Button data-tone=(tone) {...rest}>{children}</Button>
```

`<Fancy tone="green" />` is an error, and so is a prop that a Button does not take.

### Generic components

`generics` on the instance script declares the type parameter, and the props type takes it:

```brm
<script module>
  export interface ListProps<T> {
    items: T[];
    label: (item: T) => string;
  }
</script>

<script generics="T">
  import { $props } from 'brumate/signals';

  const { items, label } = $props<ListProps<T>>();
</script>
```

A caller infers `T` from its props. In `<List items=([1, 2]) label=((n) => n.length) />`, `n` is a number, so `length` is an error.

### The `as` of `@brumate/ui`

A part that renders one element takes `as`, the name of an element or a component. Its other props are those of the target, so `<Button as="a" href="/docs">` is valid, and `<Button as="a" foo>` is an error. With `as=(Link)`, the props are those of `Link`.

The props type takes the target, `ButtonProps<'a'>` or `ButtonProps<typeof Link>`, and `ButtonProps` alone is a button. `ButtonOwnProps` has the props of the part without the target. To write a part like this, use `AsProps` of `@brumate/ui/as.ts`:

```brm
<script module>
  import type { AsProps, AsTarget } from '@brumate/ui/as.ts';

  export interface CardOwnProps {
    isFeatured?: boolean;
    children?: unknown;
  }
  export type CardProps<T extends AsTarget = 'div'> = AsProps<T, CardOwnProps>;
</script>

<script generics="T extends AsTarget = 'div'">
  import { $props } from 'brumate/signals';

  const { as = 'div', isFeatured, children, ...rest } = $props<CardProps<T>>();
</script>

<{as} data-featured=(isFeatured || undefined) {...rest}>{children}</>
```

Inside the part, a prop that depends on the target has a type that TypeScript cannot resolve. A value of it that goes to `$memo` needs a cast, such as `$memo(as as AsTarget)`. If the part reads many props with exact types, read them from a call of `$props<CardOwnProps>()`, and `as` from another call of `$props<CardProps<T>>()`.

## Not checked yet

- `children` passed to a component has the type `any`.
- The attributes of elements other than events, such as `class` and `href`.

## TypeScript 7

TypeScript 7 does not load plugins and has no API for other file types yet. So:

- `brumate-tsc` comes with the TypeScript 6 compiler and runs it.
- In an editor, TypeScript features in `.brm` files need TypeScript 5.0 to 6, such as the version that VS Code ships with.
