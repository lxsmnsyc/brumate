# Keyed list with a block style

Write `src/Todos.brm`, a list of to-dos.

- An `input` with the class `text` and a `button` with the class `add`. A click on `add` adds a to-do with the text of the input and clears the input. It adds nothing for an empty text.
- Each to-do is an `li` in a `ul`, with a `span` for its text and a `button` with the class `remove`. A click on `remove` removes that to-do. The other `li` elements stay the same elements.
- A click on the `span` toggles `done`. A done to-do has the class `done` on its `li`.
- The list has a key for each to-do. Give each to-do an `id` when it is added.
- The `li` is styled with a `<style>` inside the body of the loop, not at the top of the file. The style uses `${…}` once, to set `text-decoration` from the to-do: `line-through` when it is done.
