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

A file with a syntax error is reported with the code of its compile error, such as `error BRM031`, as `src/App.brm(5,3): error BRM031: message`. [Compile errors](./errors.md) lists the codes. Its scripts are still checked.

## `brumate check`

```bash
brumate check             # compile every .brm file, then type-check the project
brumate check --json      # one JSON object per line, for scripts and agents
brumate check --no-types  # the compiler only
brumate check src/App.brm # limit the compiler to these files or directories
```

It compiles every `.brm` file under the current directory, and runs `brumate-tsc` when `@brumate/tsc` is installed and the directory has a `tsconfig.json`. It exits with 1 when there is an error. Warnings are printed and do not change the exit code.

With `--json`, each problem is one line:

```json
{"file":"src/App.brm","range":{"start":{"line":5,"column":3},"end":{"line":5,"column":4}},"severity":"error","message":"Cannot assign to memo \"double\"","code":"BRM117","link":"https://brumate-docs.vercel.app/docs/errors#brm117","source":"brumate"}
```

- `range` has 1-based lines and columns. The type checker gives a start only, so its end is the start.
- `code` is `BRM` and a number for a compile error, and `TS` and a number for a type error. A warning has no code. `link` is the section of [Compile errors](./errors.md) that explains a `BRM` code, and `null` for other problems.
- `source` is `brumate` or `typescript`.

The message of a compile error in Vite and in the terminal ends with its code, as `message [BRM117] (App.brm:5:3)`.

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
- The attributes of elements, against the types of `brumate/elements`. An unknown attribute, a wrong value, a wrong name or value in a spread and a computed attribute are errors at the attribute.
- `ref` on an element. `ref=$bind(name)` needs a signal that can hold the element, such as `HTMLInputElement | null` for `<input>`.
- Dynamic tags. `<{tag} ...>` checks its attributes, `ref`, spreads and children against the tag: the attributes of an element name, or the props of a component. A tag that can name any element or component checks the global attributes and leaves its spreads unchecked.
- The children of a component. They are `Markup`, so a component that takes no `children` prop reports them.
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

## Element and markup types

`brumate/elements` exports the types that the check uses. Import them in a `.ts` file or a `<script module>`:

| Type                | What it is                                                                |
| ------------------- | ------------------------------------------------------------------------- |
| `Elements`          | The attributes of each HTML and SVG element, by tag.                      |
| `ElementProps<'a'>` | The attributes of one tag, such as `ElementProps<'button'>`.              |
| `Markup`            | What children, a `#template` and a render give. A string is not `Markup`. |
| `Component<P>`      | A component with the props `P`.                                           |
| `PropsOf<C>`        | The props of a component type.                                            |

```ts
import type { ElementProps, Markup } from 'brumate/elements';

export type CardProps = ElementProps<'section'> & { children?: Markup };
```

### Custom events and elements

A handler takes its event type from `ElementEvents`. An event that no element fires, such as `onDoubleClick`, is a type error. To add an event that an element sends, merge it into `ElementEvents`:

```ts
declare module 'brumate/elements' {
  interface ElementEvents {
    itemaction: CustomEvent<string>;
  }
}
```

A handler is written in camel case. The name `itemaction` becomes `onItemaction`. For a name of several words, add its camel-case form to `ElementEventNames`, and the handler is `onItemAction`:

```ts
declare module 'brumate/elements' {
  interface ElementEventNames {
    itemaction: 'ItemAction';
  }
}
```

The tag of a custom element is added by merging into `Elements`.

## TypeScript 7

TypeScript 7 does not load plugins and has no API for other file types yet. So:

- `brumate-tsc` comes with the TypeScript 6 compiler and runs it.
- In an editor, TypeScript features in `.brm` files need TypeScript 5.0 to 6, such as the version that VS Code ships with.
