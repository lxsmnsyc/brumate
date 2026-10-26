# Change request: part-props v1.1 to v1.2

- From node: as-collections
- Status: open

## Problem

The contract says a part with a component in `as` gets its element through `ref`, and that a part reads its own root from the `ref` prop. Three things in the compiler and the runtime break this for a component that spreads its props onto its root, as most components do. Each has a test in packages/ui/test/as-collections.test.ts or a repro in the log.

1. The forwarded `ref` stays empty. The dynamic tag passes its anchor (`b-b`) in the props of the component. The component spreads them onto its root, where they replace the component's own anchor, so the component cannot find its element to write `ref`. A component that does not spread (a test fixture without `{...rest}`) forwards `ref` as the contract says.
2. A component given through a prop is, in the browser, a stub that renders nothing (`c` in runtime/shared.ts). A part that renders `<{as}>` in a block that the browser renders later (the panel of a TabPanel that gets selected, the rows that a Tree opens) renders nothing for a component. After the page code has loaded and hydrated, an item with a component in `as` is also re-rendered as a plain `div` without its handlers.
3. A component named only as a value (`as=AsTarget`) inside a `#template` is not imported in the client part of the template (ReferenceError).
4. Separately, a dynamic tag with a spread of `$handler` attributes loses its keys when the browser renders it (the list of a Select). ListBox keeps a plain `<div>` when there is no `as` for this reason.

## Proposed change

Add to Behavior: "A part reads its own root with `ref`, and also by an ID that it sets, because a component target can leave `ref` empty. A component in `as` works for what the server renders. What the browser renders later needs the compiler to keep the component (2, 3)." Or fix 1 to 3 in the core and keep the contract as it is.

## Affected nodes

as-controls, visible-forwarded-ref, docs-generator (props table), any node that renders a part with a component in `as`.

## Workaround in place

ListBox, Menu, GridList and Tree read their root with `ref ?? document.getElementById(id)` and set `id`. TagList reads `event.currentTarget`. The tests load the page afresh for each test and keep components in `as` to what the server renders. `ref` is tested through element names.

## Decision

