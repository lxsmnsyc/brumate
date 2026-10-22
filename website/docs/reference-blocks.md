# Blocks and markup

The syntax of markup in a `.brm` file: control flow blocks, attributes, events and special elements. [Control flow](./control-flow.md) and [Markup](./markup.md) explain each one with examples.

## Blocks

| Block                                                | Renders                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `#if (condition) { … }`                              | Its body when the condition is true.                                                                                      |
| `#else if (condition) { … }`                         | Its body when the blocks before it did not render and the condition is true.                                              |
| `#else { … }`                                        | Its body when no branch of the `#if` rendered.                                                                            |
| `#for (item of list) { … }`                          | Its body once for each item.                                                                                              |
| `#for (item, index of list by key) { … }`            | The same, with the index of each item, and a key that keeps the elements of an item.                                      |
| `#for (…) { … } #else { … }`                         | The `#else` body when the list is empty.                                                                                  |
| `#repeat (count) { … }`                              | Its body `count` times.                                                                                                   |
| `#repeat (index of count) { … }`                     | The same, with the index of each copy, from 0.                                                                            |
| `#switch { #case (condition) { … } #default { … } }` | The body of the first `#case` whose condition is true, or else `#default`.                                                |
| `#key (value) { … }`                                 | Its body, and renders it again when `value` changes.                                                                      |
| `#offscreen (visible) { … }`                         | Its body while `visible` is true. When it turns false, the body stays in the page, hidden, with its state.                |
| `#try { … } #catch { … }`                            | Its body, or the `#catch` body when the body throws.                                                                      |
| `#try { … } #catch (error, reset) { … }`             | The same. `error` is the error, and `reset()` renders the `#try` body again in the browser.                               |
| `#loading { … } #else { … }`                         | The `#else` body until the values that the body reads have loaded, then the body. The body at once when they are ready.   |
| `#portal { … }`                                      | Its body at the end of the page.                                                                                          |
| `#portal (target) { … }`                             | Its body inside `target`, an element or a selector, in the browser.                                                       |
| `#head { … }`                                        | Its body in the `<head>` of the document.                                                                                 |
| `#client { … }`, `#client ('idle') { … }`            | Nothing on the server. The browser renders its body when the trigger fires: `'visible'` by default, `'idle'` or `'load'`. |
| `#client { … } #else { … }`                          | The `#else` body on the server, until the browser renders the body in its place.                                          |
| `#defer { … } #else { … }`, `#defer ('idle') { … }`  | The `#else` body, until the trigger fires. The browser then asks the server for the body, which replaces it.              |
| `#template name(parameters) { … }`                   | Nothing. It declares markup that `{name(arguments)}` inserts.                                                             |

- `#else`, `#else if` and `#catch` come right after the body of their block. Only whitespace and comments can be in between.
- `#for (item, index of list by index)` keys items by position.
- Only `#case`, `#default`, whitespace and comments can be directly inside `#switch`. `#default` comes last.
- A body can start with a `<script>`. It runs for each instance of the body, such as each item of a `#for`. It cannot export and cannot call `$props()`.
- A `#template` at the top level of a file can be used anywhere in the file. One inside a body can be used in that body.
- `#` starts a block only before one of these keywords followed by `(` or `{`, and not right after a letter or a digit. Any other `#` is text.
- `#defer` cannot be inside a `#client` body, or in markup that the browser renders, such as a branch of an `#if` that changes. See [`#defer`](./control-flow.md#defer).
- A hidden `#offscreen` body gets `display: none !important` on each element at its top level, and its text at the top level is emptied. Its effects, `$client` callbacks and `<window>` and `<document>` listeners do not run. See [`#offscreen`](./control-flow.md#offscreen).

## Inserts

| Form          | Renders                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `{value}`     | The value as text, escaped. `null`, `undefined` and `false` render nothing. |
| `{raw(html)}` | HTML as it is, with `raw` from `brumate/html`. Insert only HTML you trust.  |
| `{children}`  | The markup that a parent put inside the component's tag.                    |
| `{row(3)}`    | The markup of a `#template` named `row`.                                    |

Expressions cannot contain markup. Use a block or a `#template` instead.

## Attributes

| Form                 | Meaning                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| `name="text"`        | A string.                                                                |
| `name=value`         | A name, a number or a member access, such as `todo.title` or `items[0]`. |
| `name=(expression)`  | Any expression, such as `disabled=(count > 3)`.                          |
| `name={ a: true }`   | An object, such as for `class` and `style`.                              |
| `name`               | `true`.                                                                  |
| `{name}`             | Short for `name=name`.                                                   |
| `{...object}`        | Every property of an object as an attribute.                             |
| `[expression]=value` | An attribute whose name is computed.                                     |

- `class` takes a string, an array, or an object whose true keys are the classes.
- `style` takes a string, or an object whose keys are written in kebab case.
- `null`, `undefined` and `false` remove the attribute. `true` adds it with no value.
- An attribute name can have one `:` namespace, as in `xlink:href`.

## Events

| Form                      | Meaning                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `onClick=handler`         | Calls `handler` with the event. Any name `on` and a capital letter is an event. |
| `onClick=(() => count++)` | An inline handler.                                                              |
| `onSubmit:prevent=save`   | A handler with modifiers.                                                       |

| Modifier   | Effect                                     |
| ---------- | ------------------------------------------ |
| `:prevent` | Calls `event.preventDefault()`.            |
| `:stop`    | Calls `event.stopPropagation()`.           |
| `:passive` | Adds the listener as passive.              |
| `:once`    | Removes the handler after the first event. |
| `:capture` | Listens in the capture phase.              |

Modifiers apply before the handler's code loads, so they work on the first event.

## Reserved attributes

| Attribute                    | Meaning                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `ref=name`                   | Writes the element into the signal `name`, declared with `$signal` in the same file.                |
| `prefetch="hover"`           | Loads the code of the element's handlers when the pointer is over it or it gets focus. The default. |
| `prefetch="visible"`         | Loads it when the element enters the viewport.                                                      |
| `prefetch="idle"`            | Loads it when the browser is idle.                                                                  |
| `prefetch="none"`            | Loads it on the event only.                                                                         |
| `action=fn`, `formaction=fn` | Posts a form to the server function `fn`. See [Forms](./forms.md).                                  |

`ref` and `prefetch` are reserved on elements only. On components, they are ordinary props.

Attribute names that start with `b-` are reserved on elements, because brumate writes them into the page. Using one is a compile error.

## Special elements

| Element                                 | Meaning                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `<window onKeyDown=close />`            | Listens to events on `window`.                                                                  |
| `<document onVisibilityChange=pause />` | Listens to events on `document`.                                                                |
| `<{tag}>…</>`                           | An element or a component whose name is the value of `tag`. A new value renders it again.       |
| `<>…</>`                                | A fragment: its children without an element around them.                                        |
| `<Name prop=value />`                   | A component. Its name starts with a capital letter, and can have dots, as in `<Icons.Close />`. |

`<script>` is allowed at the top level and at the start of a block body. `<style>` is allowed at the top level only. See [Styles](./styles.md).
