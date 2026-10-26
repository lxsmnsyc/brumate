---
name: brumate
description: Writes and fixes brumate components, the `.brm` files, with their state, events, control flow, server functions and @brumate/ui parts. Use it when a task creates or edits a `.brm` file, or reads an error of the brumate compiler.
---

# Writing .brm files

A `.brm` file is a component: scripts for its state, an optional `<style>`, and markup. The server renders it, and the browser gets only the code that an event, an effect or a changing value reaches. Write it as below, because the compiler reads the form of the code, and it reports the rest as an error.

```brm
<script>
  import { $memo, $signal } from 'brumate/signals';

  let count = $signal(0);
  const double = $memo(count * 2);
</script>

<button onClick=(() => count++)>Clicked {count} times</button>
<p>Double: {double}</p>
```

## Rules that agents get wrong

- Compile-time functions come from `brumate/signals`: `$signal`, `$memo`, `$props`, `$effect`, `$client`, `$id`, `$bind` and the others. Import each one that the file calls.
- A signal is `let name = $signal(value)`. A memo is `const name = $memo(expression)`. Read and write them as plain variables: `count++`, `name = 'Ada'`. There is no `.value`.
- Never write a signal in the setup code of the script. Only handlers, effects, `$client` callbacks and functions that they call write. Give the start value in the call: `$signal(5)`.
- Never change a value in place. `todos.push(todo)` updates nothing. Assign a new value, or use `$produce(todos, (draft) => { … })`.
- An attribute value is a quoted string, a plain name or call, or an expression in parentheses: `disabled=(count > 3)`. An operator without parentheses is an error.
- Use the shorthands: `<a {href}>`, `<button {onClick}>`, `<input {...rest}>`.
- Branches follow on the same line as the closing brace: `} #else if (…) {` and `} #else {`.
- A `#for` has a key: `#for (item, index of items by item.id) { … }`. A list of strings or numbers can leave `by` out.
- `$effect` never runs on mount. Its first run is after the first change of a value it reads. Code that must run when the page loads or comes into view is `$client(callback, trigger)`. The default trigger is `'visible'`.
- An element that browser code needs is `ref=$bind(name)`, where `name` is a signal. A bare `ref=name` is an error.
- To let a child write a value, destructure its prop with `let` and type it `Bindable<T>`. The parent passes `$bind(signal)`.
- A component never receives a signal. A function prop writes the parent's value: `onChange=((next) => (count = next))`.
- Markup is never a value in code or in an attribute. Use `#template name(parameters) { … }` and call it as `{name(arguments)}`.
- Browser wrappers of a handler come from `brumate/events`: `prevent`, `stop`, `once`, `capture`, `transition`. Write them in the attribute, with keys as string literals. `prevent(handler, 'Enter')` prevents only Enter with Ctrl, Meta and Alt up. `'Mod+ArrowDown'` names Ctrl or Meta. Calling `event.preventDefault()` in a handler is too late.
- A server function is an `async` function with `'use server'` on its first line. It reads no variable of the instance script. Pass values as arguments.
- Do not use `$ref`, `$watch`, `$settled`, `$cleanup`, `$store`, `$get`, `$set`, or modifiers such as `onSubmit:prevent`.

## References

Read the file for the part of the work that you do.

- [references/syntax.md](references/syntax.md): the parts of a file, attributes, props, children, templates and control flow.
- [references/state.md](references/state.md): signals, memos, async data, effects, `$client` and refs.
- [references/events.md](references/events.md): handlers, the wrappers of `brumate/events`, and `$handler`.
- [references/ui.md](references/ui.md): the parts of `@brumate/ui`, and how to compose them.
- [references/errors.md](references/errors.md): every compile error, its cause, and the form to write instead.

## Checking your work

- `npx brumate-tsc --noEmit` type-checks the project, `.brm` files included.
- A compile error names the file, the line and the column. Look its message up in [references/errors.md](references/errors.md).
- The docs of brumate, in `website/docs` of its repository, cover each topic in full.
