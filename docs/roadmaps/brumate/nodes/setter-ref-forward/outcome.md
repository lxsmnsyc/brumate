# Outcome: setter-ref-forward

## Built

- A `ref=$bind(root, fn)` that a parent passes to a component calls `fn` with the element in the browser. Two paths:
  - A component that forwards it by name (`let { ref } = $props()`, then `ref=$bind(ref)`): the write of the element goes through `set`, which now calls the setter by `send` (runtime/client/updates.ts). `send` waits for `afterInsert` when it gets an element reference, so `fn` sees the element in the page.
  - A component that leaves `ref` in its rest props and spreads them on an element or a dynamic tag: `forwardRef` (runtime/client/inserts.ts) calls `send` when the target of the binding is a setter. It remembers the scope and slot it gave each element, so a later update of the spread does not call `fn` again.
- `runtime/client/insert.ts` runs `afterInsert` until it is empty. A callback that adds another, such as the write of a ref in an outer scope that then calls the setter, was dropped before. The queue is taken first and the shared list cleared in `finally`, so a throw leaves nothing for the next insert.
- `addScopes` calls the setters of named props on resume (see the decision).
- Tests added for: no second call on a spread update, a block that closes and opens again. Two different setters on one element have no test: `$bind(name, fn)` takes a function expression, so a page cannot pick between two, and an element has one `ref`.
- Tests in packages/brumate/test/resume.test.ts, "a ref bound with a setter": named prop and rest props, each with the setter called by a block that the browser renders. Fixtures `setterRefPage.brm`, `setterRefRestPage.brm`, `SetterRefButton.brm`, `SetterRefBox.brm`.
- Changeset `.changeset/setter-ref-forward.md` (patch, brumate).

## Decision: resume

- A named prop calls the setter on resume (maintainer's decision, option A). The server records the `ref` slot of the child as an element reference, and the setter as `b[slot]`. `addScopes` in runtime/client/resume.ts finds each scope with a non-slot binding whose slot holds an element reference, and calls `send` with the element. A test covers one call on resume, one more for a block, and none after.
- Rest props are not called on resume yet. The server has no slot to write for them, so the page state needs a new record. The follow-up node is `setter-ref-resume-rest`. A block that the browser renders, and a spread update, call the setter now.
- A setter replaces the write, so the signal itself is not written.

## Deviations

- The brief says `ref=$bind(root, fn)` on an element. The parser accepts only `ref=$bind(name)` on an element (BRM027), so a setter reaches an element only through a component prop. Not changed.
- `runtime/client/insert.ts` is outside the brief's list of shared paths, but inside `runtime/client/**`.

## Stubs left

- None.

## Gotchas

- `fn` is called once per element and setter. The key is the setter: a function, or the component and export name of a reference. Another setter on the same element and signal is called too. Arguments of a `$handler` setter are not part of the key.
- The element is never written into the page state: the setter case adds nothing to it.

## Proposed learnings

- A callback in `afterInsert` can add to it. Drain the list until empty.

## Verification

- `npx vitest run test/resume.test.ts -t "a ref bound with a setter"` in packages/brumate: 2 failed on main (timeout), 2 pass now.
- packages/brumate: 58 files, 1146 passed, 1 skipped. packages/ui: 58 files pass, 573 tests pass; `test/generics-markup.test.ts` fails 3 tests the same way with main's client runtime in this worktree (type-check tests), so not from this change. `oxlint` (warnings only), `oxfmt --check` and `tsc --noEmit` pass.

## Size

- gzip -9 of every client asset of the todos build, main then head: 28915 to 28981 B. The eager core grows by 66 B, within 0.1 kB. `run.mjs` prints 28.1 kB for both.
- Estimated S, actual S.
