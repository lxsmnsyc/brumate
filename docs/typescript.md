# TypeScript

`.brm` files are type-checked with `brumate-tsc`, and in editors with a TypeScript server plugin.

## Checking a project

```sh
pnpm add -D @brumate/tsc
brumate-tsc --noEmit
```

`brumate-tsc` takes the options of `tsc`. It checks `.ts` files and `.brm` files together, so a `.ts` file that imports a component gets its props type.

Add `brumate/types` to the types of the project:

```json
{
  "compilerOptions": {
    "types": ["brumate/types"]
  }
}
```

## In an editor

Add the plugin to `tsconfig.json`, and use the TypeScript version of the workspace in the editor:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@brumate/typescript-plugin" }]
  }
}
```

## What is checked

The checker turns each `.brm` file into TypeScript. The scripts are copied, and the markup becomes statements in blocks that match its control flow, so each expression sees the names around it.

- The scripts, as TypeScript.
- Every expression in the markup, in attributes, inserts, block headers and style variables.
- The props of components. A prop with the wrong type is reported at the prop, and a missing prop at the tag. The props type is the type argument of `$props<T>()`.
- Event handlers on elements. The event has the type of its name, such as `MouseEvent` for `onClick`, and `event.currentTarget` is the element, such as `HTMLInputElement` for `<input>`.
- `#for` items and indexes, `#catch` errors and `reset`, and `#template` parameters, in the blocks that declare them.
- Values that the page state sends to the client. A signal or memo that client code reads must hold values that seroval can write: plain data, `Date`, `Map`, `Set`, promises of them, and components. A function, an instance of a class with methods, or a regular expression is reported at its declaration:

```html
<script>
  let format = $signal((value: number) => String(value));
  // error: A function cannot be sent to the client. Keep it out of the signal or memo
</script>
```

Values that only the server reads are not checked, because they are not sent.

A file with a syntax error is reported as error `BRM`, and its scripts are still checked.

## Not checked yet

- `children` passed to a component is typed as `any`.
- The attributes of elements other than events, such as `class` and `href`.
