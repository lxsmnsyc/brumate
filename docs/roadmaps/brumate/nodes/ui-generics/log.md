# Log: ui-generics

- Probe first: `ListBox({ items: animals, item: (animal) => animal.name })` infers `V` through brumate-tsc, also with `as: 'ul'`. In markup, `<ListBox items=(animals) item=animal />` infers `V` from a `#template` whose parameter is typed. A template parameter has no context type, so an untyped one is an implicit any, and a wrong type is an error on `items`.
- Order of the parameters: `V` first, then `T`, as Terracotta has them. `ListBoxProps<'ul'>` became `ListBoxProps<{ id: string }, 'ul'>` in props-types.ts (the only use).
- `$signal` and `$memo` take only `$$Sendable` types, and a generic `V` is not one. Tree keeps its rows as `TreeRow<TreeNode>` and TreeRow casts `row.item as V`. ToastRegion keeps `shown` as `QueuedToast<unknown>[]` and casts at `toast(item as QueuedToast<V>)`. Casts work inside markup expressions.
- Table has no context of the generic type: Table and TableBody each take their own `V`, and TableBody casts the entries of the table context. A Table does not infer the `V` of its TableBody.
- Select, ComboBox, TagGroup, TagList and Autocomplete have no prop of a value type (no `any`), so they got no parameter.
- Removed a mention of React Aria in a doc comment of toast.ts.
- A first run of brumate-tsc did not end (over 2 minutes) when I changed all the parts at once. Adding the parts back one at a time showed a normal run, so the cause was the load of other workers plus the `Sendable` errors of the memo in Tree, not a loop. Not reproduced.
