---
'@brumate/ui': minor
---

Every part exports its props type from `<script module>`, such as `ButtonProps` from `Button.brm`. The parts that render an element take `as`, the name of an element or a component, and the other props are those of the target, so `<Button as="a" href="/docs">` is valid and `<Button as="a" foo>` is an error. They forward `ref`, and the signal is typed from the target: `<Button ref=$bind(b)>` gives `HTMLButtonElement | undefined`, and `<Button as="a" ref=$bind(link)>` gives `HTMLAnchorElement | undefined`. `@brumate/ui/as.ts` has the types `AsProps` and `AsTarget` for a part of your own.
