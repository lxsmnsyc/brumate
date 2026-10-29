---
name: brumate
description: Writes and fixes brumate components, the `.brm` files, with their state, events, control flow and server functions. Use it when a task creates or edits a `.brm` file, or reads an error of the brumate compiler.
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
- Keep only data in signals and memos: strings, numbers, booleans, `null`, plain objects and arrays, `Date`, `Map`, `Set`, `URL`, typed arrays and the like. Never put a function, a class instance or a regular expression in one, because the server cannot send it to the browser. Use a plain function in the script, or a function prop, and send a regular expression as its source. A class that the app sends needs a plugin in the serial entry (`src/serial.ts`). See `website/docs/reference-serialization.md`.
- Never change a value in place. `todos.push(todo)` updates nothing. Assign a new value, or use `$produce(todos, (draft) => { … })`.
- An attribute value is a quoted string, a plain name, a property path or a call, or an expression in parentheses. A value with an operator, such as `?:`, `+`, `>` or `&&`, or an arrow function, needs parentheses: `disabled=(count > 3)`. A bare `title=!closed` and `data-a=-1` work.
- Use the shorthands: `<a {href}>`, `<button {onClick}>`, `<input {...rest}>`.
- Write a branch on the line of the closing brace, as the style: `} #else if (…) {` and `} #else {`. The compiler also accepts `#else` on the next line.
- A `#for` has a key: `#for (item, index of items by item.id) { … }`. Without `by`, each item is its own key.
- `$effect` never runs on mount. Its first run is after the first change of a value it reads. Code that must run when the page loads or comes into view is `$client(callback, trigger)`. The default trigger is `'visible'`.
- Reach for a handler first, then `$memo`, and `$effect` last. An effect is only for work outside the page's state, such as an element method, a cookie, `document.title`, a timer or a library. Never write an effect that only sets a signal from other signals: that value is a `$memo`, or a write in the handler.
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
- [references/signals.md](references/signals.md): every function of `brumate/signals`, with what it returns and where it goes.
- [references/state.md](references/state.md): signals, memos, async data, effects, `$client` and refs.
- [references/events.md](references/events.md): handlers, the wrappers of `brumate/events`, and `$handler`.
- [references/errors.md](references/errors.md): every compile error, its cause, and the form to write instead.

## Checking your work

- `npx brumate-tsc --noEmit` type-checks the project, `.brm` files included.
- `npx brumate check --json` compiles every `.brm` file and runs the type check. It prints one JSON object per problem, with `file`, `range`, `message`, `code` and `link`, and exits with 1 on an error.
- A compile error names the file, the line and the column, and ends with a code such as `[BRM012]`. Look its message or its code up in [references/errors.md](references/errors.md).
- The docs of brumate, in `website/docs` of its repository, cover each topic in full.
