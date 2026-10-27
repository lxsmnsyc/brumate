---
'@brumate/ui': minor
---

The `ref` of a part takes the element of its `as` target. `<Button ref=$bind(b)>` types the signal as `HTMLButtonElement | undefined`, and `<Button as="a" ref=$bind(link)>` as `HTMLAnchorElement | undefined`. A signal of the wrong element is an error. The props types `<Name>OwnProps` take the target as a type parameter, and `TargetElement` is exported from `as.ts`.
