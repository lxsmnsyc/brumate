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

## Not checked yet

- `children` passed to a component has the type `any`.
- The attributes of elements other than events, such as `class` and `href`.

## TypeScript 7

TypeScript 7 does not load plugins and has no API for other file types yet. So:

- `brumate-tsc` comes with the TypeScript 6 compiler and runs it.
- In an editor, TypeScript features in `.brm` files need TypeScript 5.0 to 6, such as the version that VS Code ships with.
