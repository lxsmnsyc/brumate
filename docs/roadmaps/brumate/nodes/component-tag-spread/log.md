# Log: component-tag-spread

- Wrote tests for the three forms. Spread and computed fail on main; the handler passes on main.
- Counted spread, computed and event attributes in `dynamicTags` and `summarize`; `attrs` routes to `spreadProps` for a component anchor; codegen emits updates for computed attributes.
- A plain `*` broke two as-collections tests (Tabs `check()` race, as `children` became live). Switched to a `~` prop that leaves out `children`.
- Size of todos: +19 B.
- Review fixes: compile error kept when a computed attribute has no browser code; inspect.ts looks up '~'; tests added; outcome corrected.
- Round 2: kept the error message (catalog needs an entry per message); inspect.ts skips ~ for children; rename test uses the Other button.
- Round 3: own catalog entry and message for the computed attribute with no browser code; errors.md regenerated; project.test.ts checks the constant case.
