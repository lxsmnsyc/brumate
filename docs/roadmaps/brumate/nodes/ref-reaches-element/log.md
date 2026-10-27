# Log: ref-reaches-element

- Test first: ref-forward.test.ts failed on main for the plain case (`- - -`). The `as=AsTarget` case already passed on main.
- Fixed Link, Button and Heading with `let { ref }` and `ref=$bind(ref)` on the root.
- Probed the core: a ref left in rest props does not reach the element that spreads them. Added as `it.fails` in packages/brumate/test/resume.test.ts.
- A first draft used RefInRest.brm and refInRest.brm, one file on a case-insensitive disk. Renamed.
