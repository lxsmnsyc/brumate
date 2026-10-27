# Log: component-tag-spread

- Wrote tests for the three forms. Spread and computed fail on main; the handler passes on main.
- Counted spread, computed and event attributes in `dynamicTags` and `summarize`; `attrs` routes to `spreadProps` for a component anchor; codegen emits updates for computed attributes.
- A plain `*` broke two as-collections tests (Tabs `check()` race, as `children` became live). Switched to a `~` prop that leaves out `children`.
- Size of todos: +19 B.
