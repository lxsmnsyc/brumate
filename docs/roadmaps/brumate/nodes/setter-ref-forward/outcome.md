# Outcome: setter-ref-forward

## Built

- A `ref=$bind(root, fn)` that a parent passes to a component calls `fn` with the element in the browser. Two paths:
  - A component that forwards it by name (`let { ref } = $props()`, then `ref=$bind(ref)`): the write of the element goes through `set`, which now calls the setter by `send` (runtime/client/updates.ts). `send` waits for `afterInsert` when it gets an element reference, so `fn` sees the element in the page.
  - A component that leaves `ref` in its rest props and spreads them on an element or a dynamic tag: `forwardRef` (runtime/client/inserts.ts) calls `send` when the target of the binding is a setter. It remembers the scope and slot it gave each element, so a later update of the spread does not call `fn` again.
- `runtime/client/insert.ts` drains `afterInsert` until it is empty. A callback that adds another, such as the write of a ref in an outer scope that then calls the setter, was dropped before.
- Tests in packages/brumate/test/resume.test.ts, "a ref bound with a setter": named prop and rest props, each with the setter called by a block that the browser renders. Fixtures `setterRefPage.brm`, `setterRefRestPage.brm`, `SetterRefButton.brm`, `SetterRefBox.brm`.
- Changeset `.changeset/setter-ref-forward.md` (patch, brumate).

## Decision: no call on resume

The setter does not run for markup that the server rendered. The server has no setter to call, and the state holds no list of calls to make at load. A resume call would need a new record in the page state and a pass over the scopes at start, and the rest props path has no scope slot to hang it on. The signal is not written either: a setter takes the place of the write, as in `set`. Code that needs the first element reads it with `$client(callback, 'load')` from a plain `ref=$bind(root)`. The brief's acceptance asked for a call after resume; this node does not do it. Reopen if the first element matters to a user of setter refs.

## Deviations

- The brief says `ref=$bind(root, fn)` on an element. The parser accepts only `ref=$bind(name)` on an element (BRM027), so a setter reaches an element only through a component prop. Not changed.
- `runtime/client/insert.ts` is outside the brief's list of shared paths, but inside `runtime/client/**`.

## Stubs left

- None.

## Gotchas

- `fn` is called once per element and binding. A new binding for the same element (the spread points `ref` elsewhere) calls it again.
- The element is never written into the page state: the setter case adds nothing to it.

## Proposed learnings

- A callback in `afterInsert` can add to it. Drain the list until empty.

## Verification

- `npx vitest run test/resume.test.ts -t "a ref bound with a setter"` in packages/brumate: 2 failed on main (timeout), 2 pass now.
- Full suites, lint, format and typecheck: see the PR.

## Size

- gzip -9 of every client asset of the todos build, main then head: 28915 to 28968 B. The eager core grows by 53 B, within 0.1 kB. `run.mjs` prints 28.1 kB for both.
- Estimated S, actual S.
