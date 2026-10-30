---
'brumate': patch
---

The browser no longer throws `ReferenceError` for names that client code did not import.

- A helper that a component imports in `<script module>` and that its functions call, such as `sameKeys` in ToggleButtonGroup.
- A component named only in a template, as `as=Link`, `icon=Star` or `as=(open ? A : B)`, or used in a `#template` declared inside a block.
- A function that a page uses in its own markup and again in children or a `#template`, also as a prop of a component there, and a wrapper such as `prevent` in a handler prop of such a component.
- Components that only import each other, such as a Tree and a Leaf that render each other, get client code. Before, their handlers did nothing.
- An `#else if` whose condition never changes, such as a `$isPassed` const, works after a condition before it changes.
