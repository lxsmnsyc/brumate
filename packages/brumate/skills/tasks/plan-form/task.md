# Form with a server function and a Select

Write `src/PlanForm.brm`. The project has `@brumate/ui`.

- A form with a `Select` from `@brumate/ui` (class `plan`, with a `Label` of `Plan`, a `Button` with class `trigger` that holds a `SelectValue`, and a `Popover` with a `ListBox`). Its items have the ids `free`, `pro` and `team` and the classes of their ids.
- A submit `button` with the class `submit`. Submitting runs a server function `save(plan)`, an `async` function with `'use server'`, which returns `Saved: <plan>`. The form does not reload the page.
- Submitting without a plan does not call `save`, and shows `Pick a plan` in a `p` with the class `error`.
- The result of `save` is the text of a `p` with the class `result`.
