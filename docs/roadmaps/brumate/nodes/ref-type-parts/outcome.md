# Outcome: ref-type-parts

## Built

- `ref?: Bindable<HTMLElement | undefined>` in the own props of ListBox, ListBoxItem, Menu, MenuItem, GridList, GridListItem, Tree, TreeItem, TabList, Tab, TabPanel, TagList and Tag (packages/ui/src/<Name>.brm), as part-props v1.3 says. Each reads it with `let { ref } = $props<<Name>OwnProps>()`, in place of the separate `Bindable<HTMLElement>` line.
- The same member in `LinkOwnProps`, `ButtonOwnProps` and `HeadingOwnProps`. These three do not read `ref`: it stays in `rest`, which they spread onto the root, so there is no code change.
- A block at the end of packages/ui/test/props-types.ts: `ref=$bind(signal)` of `HTMLElement | undefined` on all 16 parts, on Link with `as: 'span'`, and an error for a string signal.
- Changeset .changeset/ref-type-parts.md (patch).

## Deviations

- The type case is in the `.ts` file, as a call of each part with `$bind(bound)`. It tests the prop type only, so the core check of a bound element signal on a component prop (node bound-element-signal) does not apply.
- Link, Button and Heading already accepted the signal before this change (their `ref` came from the target of `as`), so the case fails with the old type for the 13 collection parts only. For these three the change makes the type part of their own props, which the props table reads.

## Stubs left

- None.

## Gotchas

- A `.brm` page that binds `$signal<HTMLElement>()` to a part still hits the core check until bound-element-signal lands.
- `Tree` needs `items` and `item` in a type test call.
- `npx oxfmt --check` reports docs/roadmaps/brumate/reviews/core-gaps-2.md, a file from main that this node does not touch.

## Proposed learnings

- Declare a forwarded `ref` in the own props, never in a separate `$props` line | the own prop wins over the target's, and a separate line hides it from the props table | packages/ui/src | no

## Verification

- Before the parts: `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui failed with 13 errors from the new case, one for each collection part. After: exit 0. A deliberate error in props-types.ts made it fail, so the check is live.
- `npx vitest run --maxWorkers=2` in packages/ui: 56 files, 529 passed, 7 expected fail. Exit 0.
- `npx oxlint --quiet` from the root: exit 0. `npx oxfmt --check`: only the file named above.
- packages/brumate has no change, so its suite was not run.

## Size

- No change to the runtime, so no gzip numbers. Estimated S, actual S.
