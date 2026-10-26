---
'@brumate/ui': minor
---

Every part exports its props type from `<script module>`, such as `ButtonProps` from `Button.brm`, so apps can import it. The parts that take `as` type it: it takes the name of an element or a component, and the other props are those of the target, so `<Button as="a" href="/docs">` is valid and `<Button as="a" foo>` is an error. These parts no longer take any attribute, but still take `class`, `data-*`, `aria-*` and the attributes and handlers of the target. `@brumate/ui/as.ts` has the types `AsProps` and `AsTarget` for a part of your own.
