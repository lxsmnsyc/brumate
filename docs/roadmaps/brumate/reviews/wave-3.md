# Checkpoint 2026-10-27

## Merged since the last checkpoint

- The four core gaps that #252 found: #254 nested-template-imports, #255 dynamic-spread-anchor, #256 dynamic-spread-handlers, #257 component-prop-render.
- #261 binding-shift.
- #262 component-tag-handlers.
- #263 element-types. The contract `element-types` is frozen.
- #264 component-tag-live-props. It also fulfilled rest-prop-handlers.
  - Handlers of one event that reach a component tag merge into one function that calls each in order, as Headless UI and Terracotta do. The maintainer chose this over a second key.
  - It went over its size budget (unminified gzip +174 B client, +578 B produce). The maintainer accepted it. handler-merge-trim measures and trims it.

## Active

None.

## Next

- split-client-runtime (must, gated, approved by the maintainer).
- as-collections: rework PR #252 on top of the core fixes, without its ID-lookup workarounds.
- as-controls.
- as-sound, unblocked by the frozen element-types contract.

## Notes

- `review: auto` is now set in GOAL.md.
- PRs #3, #78 and #98 are not roadmap work. Leave them.
