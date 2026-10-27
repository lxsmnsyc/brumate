# Log: dynamic-tag-rest-ref

- Verify command matched no test on main (all skipped), so the work did not exist.
- Wrote four tests first (server render, block the browser renders, `as` changing between two elements, page state): 3 failed with timeouts on main.
- Fix: emitDynamic wraps the props in `restRef(props, scope, anchor, tag)` under the same gate as an element (`spreadsRest`, now shared). `restRef` skips a tag that names a component, which gets `ref` as a prop and forwards it itself.
- The change of `as` needed no extra code: the update of the spread already forwards the element (rest-ref-spread).
- Built packages/tsc and packages/language-core in the worktree for `brumate-tsc`.
