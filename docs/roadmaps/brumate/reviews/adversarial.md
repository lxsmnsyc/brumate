# Adversarial review

A reviewer with fresh context checked the ui and core parts of the plan on 2026-10-26, when they were two roadmaps: contracts, shared files and dependency edges. Each finding was checked against the code before it was applied.

1. **The docs checks could not fail.** check:samples reads only website/docs, and the website has no vitest. Applied: docs-generator adds vitest and makes check:samples read website/ui, and the docs nodes verify with check:samples and the website build. docs-generator also owns DocPage.brm, which renders the parts of a page.
2. **props-table was a stub behind a contract edge.** Applied: the docs nodes are hard on docs-generator, and on the as node of their parts. part-props now requires `<Name>OwnProps`, which the generator reads, so it never expands the fields of the target element.
3. **Ownership gaps.** Applied:
   - context-menu waits for docs-collections, since both edit menu.md and autocomplete.md.
   - fieldset owns the field parts it edits.
   - The new parts own their demos.
   - popover-group-alert waits for as-controls, and shares Popover.brm.
   - Each docs node owns the demos of its pages, by name.
4. **Parts that bind their own root.** Popover and Tooltip have `ref=$bind(panel)`. Applied: part-props says the part uses the `ref` prop as its root signal, so an element never has two bindings. Both as nodes share one test fixture. The parts left out are listed.
5. **visible-forwarded-ref owned the wrong file.** `b-near` comes from `refElement()` in codegen/markup.ts. Applied. drop-marker-index has hard edges on split-client-runtime and visible-forwarded-ref, now that the plan is one graph.
6. **Module names of the split were not frozen.** Applied: a client-modules contract with the map of functions to modules.
7. **fields-typed-early and the update pass.** Applied: fields-typed-early is hard on ordered-updates. batching freezes update-pass first, and search-params is a contract edge on it, and lists server.ts, macros.ts, features.ts and client.ts.
8. **scope-id-table.** Applied: the table goes to `shiftState` as an argument, so client-routes.ts still imports nothing, and serial.ts and devtools.ts are listed.

Rejected: none.
