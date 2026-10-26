---
branches:
---

# @brumate/ui ready to publish

## Outcome

@brumate/ui can be published as 0.1. Every part exports its props types, the parts that render an element take `as` (an element or a component) and forward `ref`, as Terracotta's do, every page of /ui has its props, attribute and keyboard tables with controlled and uncontrolled examples, /ui has a landing page, and the website's known faults are fixed.

## Acceptance

- `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` passes.
- `pnpm --filter website check:samples && pnpm --filter website build` passes.
- `node e2e/run.mjs --only website,ui` passes.

## Priorities

- must: needed to publish @brumate/ui 0.1 (step 4 of the Order of the proposals).
- should: the takeaways from Terracotta and Headless UI that improve the parts, but do not block publishing.
- could: the takeaways of low value.
- later: parked in ../inbox.md.

## Constraints

- The parts stay unstyled and follow React Aria Components 1.22.1 for behavior.
- Breaking changes are fine: the framework is unstable, with no deprecation periods.
- Writing follows the plain-writing skill.
- website/src/ui.ts is shared by the nodes that add a page. It is a list with one line for each page and card, so they append and merge in order. It is not split.

## Non-goals

- New parts beyond Fieldset, Legend, ColorScheme, PopoverGroup and Alert.
- Moving packages/ui to its own repository.

## Verification

- Fast check (safe in parallel worktrees): `pnpm lint && pnpm format:check && pnpm typecheck`, then the ui tests of the node.
- Full check (after merging): the Acceptance commands, about 10 minutes, with Chrome for e2e.

## Numbered resources

- None. Changesets have names, not numbers.

## Sources

- [What to take from Terracotta and Headless UI](../../proposals.md#what-to-take-from-terracotta-and-headless-ui)
- [Website](../../proposals.md#website)
- [Headless UI components](../../proposals.md#headless-ui-components)
- The review of polymorphism against Terracotta, 2026-10-26.

## Coverage

- Takeaway 1, props tables, anatomy and keyboard tables -> docs-generator, docs-controls, docs-overlays, docs-collections, docs-colors-dates
- Takeaway 2, popover sizing -> popover-sizing
- Takeaway 3, Fieldset -> fieldset
- Takeaway 4, context menu and command palette -> context-menu
- Takeaway 5, color scheme -> color-scheme
- Takeaways 6 and 9, PopoverGroup and Alert -> popover-group-alert
- Takeaways 7 and 8, guides -> part-guides
- Takeaway 10, Feed -> inbox: waits for streaming lists
- Website, the home link, the shop demo, highlighting, the error section -> website-fixes
- Website, the docs of @brumate/ui -> docs-* nodes
- Website, a guide to props types -> props-types-main (#245 writes it in website/docs/typescript.md)
- Website, the code examples -> code-examples
- Website, a landing page for @brumate/ui -> ui-landing
- Website, `$client` in markup that the browser renders -> core-next/client-markup-docs
- Polymorphism (`as` on the parts without it) -> as-controls, as-collections
- Headless UI, phases 0 to 7 -> built: all merged by 2026-10-26
- Headless UI, components from packages -> built: packages/brumate/src/packages.ts
- Headless UI, nested TransitionChild -> built: packages/ui/src/TransitionChild.brm
- Headless UI, leave animations for `#for` items -> inbox: needs a hook in the list code, wait for a request

## Open questions

- Should the ui example page and its e2e suite be split by part (split-ui-examples)? It blocks fieldset, context-menu, color-scheme and popover-group-alert.
- Are the must nodes the right line for publishing 0.1?

## Gates

- split-ui-examples: the user approves the change of layout.
- After props-table is frozen: the user reviews the page format before the four docs nodes start.
