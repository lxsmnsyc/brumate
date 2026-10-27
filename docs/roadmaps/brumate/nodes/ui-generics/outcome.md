# Outcome: ui-generics

## Built

- `V` (the value of the items) on ListBox, GridList, Table, TableBody, Tree, TreeRow and NavigationTree, and on ToastRegion (the content of a toast). `items`, `item`, `getTextValue` and the toast template read `V`, so no `any` is left in the props of these parts. Constraints: `{ id: Key }` for lists and tables, `TreeNode` for Tree and TreeRow, `NavigationNode` for NavigationTree, none for ToastRegion (default `unknown`).
- A part with `as` takes `<V, T>` in this order: `ListBoxProps<V, T>`, `ListBoxOwnProps<V, T>`, and the same for GridList, Tree and ToastRegion. `V` has a default, so `ListBoxProps` alone still works.
- packages/ui/test/generics-types.ts: 14 `@ts-expect-error` lines, one for each wrong field and one for a missing `id`, and calls that show the inference with and without `as`.
- Changeset .changeset/ui-generics.md (minor).

## Deviations

- Select, ComboBox, TagGroup, TagList and Autocomplete got no parameter: they have no prop of a value type, and no `any`.
- `ListBoxProps<'ul'>` in test/props-types.ts is now `ListBoxProps<{ id: string }, 'ul'>`, a change of an existing line outside the owned list.
- Removed "as React Aria asks for" from a comment in toast.ts.

## Stubs left

- None.

## Gotchas

- A `#template` parameter has no context type. `#template animal(a: Animal)` types it, and then `V` is inferred from `items` and checked against it. Until the core fix (node template-context-types) lands, a template parameter needs this annotation. Without it `a` is an implicit any: an error under `noImplicitAny` about the missing annotation, and a silent `any` otherwise. The field is not checked. Fixed by template-context-types (#313): an untyped template passed to a prop now takes its type from the prop; TableBody and ToastRegion templates still need the annotation.
- A Table does not infer the `V` of its TableBody, since they share a context. Annotate the template of the TableBody.
- ToastRegion cannot infer `V` from the queue (it is found by name). Pass the type in a call in `.ts` (`ToastRegion<string>({ ... })`), or annotate the template.
- `$signal` and `$memo` reject a generic `V` (not `$$Sendable`). Keep the state typed by the constraint and cast where the value goes back to the caller's template.

## Proposed learnings

- Parts keep state typed by the constraint (`TreeNode`) and cast to `V` at the call of the caller's template | `$signal` and `$memo` take only Sendable types | packages/ui/src | no

## Verification

- `npx brumate-tsc --noEmit` in packages/ui: exit 0, with every `@ts-expect-error` of generics-types.ts and props-types.ts holding.
- `npx vitest run --maxWorkers=2` in packages/ui: 57 files, 537 passed, 1 expected fail.
- `npx oxlint --quiet` and root `npx oxfmt --check`: exit 0.
- Public repo, but the checks ran locally.

## Size

- Estimated M, actual M. No runtime change.
