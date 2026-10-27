---
'brumate': minor
---

A dynamic tag checks its attributes, `ref`, spreads and children against its tag: the attributes of an element name, or the props of a component. Its handlers are typed from the tag, so `<{tag} onClick=((event) => ...)>` types `event` and `event.currentTarget`. A tag that can name any element or component, such as a generic `T extends AsTarget`, checks the global attributes, and its handlers get `HTMLElement | SVGElement`. An unknown attribute, a wrong value or a wrong `ref` on a dynamic tag is now an error.
