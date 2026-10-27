---
id: rest-ref-local-error
title: A compile error for props used as a whole outside a markup spread
status: done
priority: should
type: fix
outline: false
milestone: core-correct
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/check.test.ts -t "props used as a whole"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/check/propsWhole*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/check.test.ts
  - packages/ui/src/NavigationTreeItem.brm
  - packages/ui/src/TreeItem.brm
  - packages/ui/src/tree.ts
  - website/docs/**
reserves: []
provides: []
depends_on:
  - on: rest-ref-spread
    kind: hard
    why: it defines which spreads forward a ref, and this node rejects the uses it leaves out
---

# A compile error for props used as a whole outside a markup spread

## Goal

The props object and the rest of `$props()` can be used in three ways only:

- destructured from `$props()`;
- spread in markup: `{...rest}` on an element, a dynamic tag or a component;
- read one key at a time: `rest.disabled`, `rest['aria-label']`.

Any other use of the object as a whole is a compile error: a spread in script code (`{ ...rest, class: 'box' }`), and passing it to a function, `$memo`, `$setContext`, a signal or another variable (`fn(rest)`, `$memo(rest)`, `const more = rest`). Such a copy carries a `ref` binding and live props away from the code that forwards them, so the ref never reaches the element. The error says to spread in markup instead: `<button {...rest} class="box">`.

## Decisions

- The maintainer chose a syntax rule over support, and over a check based on types, on 2026-10-27. It covers untyped props too.
- There are no `mergeProps` or `splitProps` utilities: destructuring `$props()` is the split, and markup spreads are the merge (later wins, handlers of one event merge). A runtime utility would return an object the compiler cannot follow, which is the same loss. If a real case needs one, it becomes a compile-time function in a new node, after the maintainer agrees.

## Context

- Found in the review of rest-ref-spread (#290): its codegen gate forwards only a spread that reads a `prop` or `props-rest` declaration.
- The check belongs in the analyzer (analyze.ts), which knows the `prop` and `props-rest` declarations. Add a catalog entry in error-catalog.ts with a code and the fix, like other compile errors.
- packages/ui/src/NavigationTreeItem.brm:42 spreads `...rest` into the object it passes through `$setContext(TreeItemAttributesContext, ...)`, read in TreeItem.brm:53. Rewrite it within the rule, for example by giving TreeItem the attributes through markup. If no rewrite fits without a merge utility, stop and tell the orchestrator.
- Check the website and the other packages for other hits, and rewrite them.

## Acceptance

- [ ] Tests: a script spread of the rest, and the whole rest passed to a function, `$memo`, `$setContext` and a variable, are each an error; a markup spread, a key read and destructuring are not.
- [ ] NavigationTreeItem passes the attributes without the banned form, and its tests still pass. A `ref` given to it reaches the row element, or the outcome says why not.
- [ ] The packages/brumate and packages/ui suites pass, and the website builds.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one analyzer check, its catalog entry, and the rewrite of the parts that hit it.
