---
id: for-leave
title: "Leave animations for removed blocks (to debate)"
status: todo
priority: later
type: feature
story:
early: false
outline: true
milestone: backlog
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/for-leave.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-10
spent:
owns:
  - packages/brumate/test/for-leave.test.ts
shared:
  - packages/brumate/src/runtime/client/lists.ts
  - packages/brumate/src/runtime/features.ts
  - packages/brumate/src/features.ts
  - packages/brumate/src/parser.ts
  - packages/brumate/src/ast.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/src/codegen/client.ts
  - website/docs/control-flow.md
  - website/docs/reference-blocks.md
  - website/docs/errors.md
  - docs/decisions.md
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

> Parked 2026-11-11 (maintainer): out of 0.8.0, waiting for a goal debate on whether the idea is worth keeping. A hook for `#for` alone implies a second one for conditionals: prior art has one mechanism for every block (Svelte `out:`/`transition:` on `{#if}`, `{#each}`, `{#key}`; Framer Motion `AnimatePresence`) or a matching pair (Vue `Transition` and `TransitionGroup`; solid-transition-group `Transition` and `TransitionGroup`). Brumate's `Transition` part already covers `#if` with no runtime change. Nothing in @brumate/ui or the website needs a `#for` leave today (`ToastRegion.brm` keeps its own list). The draft below, from the 2026-11-11 refinement, is notes for that debate, not a plan.

# Leave animations for #for items

## Goal

A keyed `#for` can take a `leave(handler)` clause. When an item leaves the list, its scope is destroyed at once, but its nodes stay in the page until the promise that `handler(element)` returns settles. Then the nodes go. A list without the clause costs no client code.

```brm
<script>
  import { fade } from './motion.ts';
  let todos = $signal([{ id: 1, title: 'Write' }]);
</script>

<ul>
  #for (todo of todos by todo.id) leave(fade) {
    <li>{todo.title}</li>
  }
</ul>
```

`fade` is `(element: Element) => Promise<unknown> | void`, such as `(el) => Promise.all(el.animate({ opacity: [1, 0] }, 200).finished)`.

## Context

- Source: [Leave animations for #for items](../../../../proposals.md#headless-ui-components), phase 2: "leave animations for `#for` items, which need a hook in the list code of the runtime, come later". Added to 0.8.0 on 2026-11-10 (docs/debates/0.8.0-cut/debate.md).
- `list()` (packages/brumate/src/runtime/client/lists.ts:35-260) finds the old items by scanning the DOM between the block markers (lists.ts:55-86) and looking each up in `scopes`. A node without a live scope goes into `others` and is removed on every update (lists.ts:160-164). `leave()` (lists.ts:97-110) calls `destroy(item.scope)` and removes the nodes. `clear(start, end)` runs when no item stays (lists.ts:184-196, 119-121). So a node that outlives its scope would be removed by the next update: it must be marked and skipped in all three places.
- `destroy` (runtime/client/scopes.ts:63-91) drops the scope from `scopes`. That is the wanted behavior: effects and cleanups stop at once, the DOM stays.
- Codegen: `$$b.list($$s, anchor, items, key, render, assign, fallback, kinds, held)` is emitted at packages/brumate/src/codegen/client.ts:1626; the key function is built by `keyFunction` and hoisted unless it reads `$$s` (client.ts:1612-1613). The handler follows the same rule. `parseWindow` (parser.ts:1049-1068) is the precedent for a clause after the header of a `#for`; `ForBlock` is in ast.ts.
- Feature flags: a `windows` flag is found by regex on the client output (packages/brumate/src/features.ts:29, 61, 106, 160) and read as `HAS_WINDOWS` (runtime/features.ts:78). A `leaves` flag follows it, so apps without the clause drop the code.
- Who needs it today: `ToastRegion.brm:101-160` keeps removed toasts in its own list (`shown`, `leavingToasts`) and runs `leaveSteps` (transition.ts:186) before it drops them. `Transition`/`TransitionChild` do the same for one `#if` body. Both work without the runtime; this node replaces the toast workaround and gives apps the same for any list. No `data-exiting` or presence code exists in packages/ui or the website.
- Prior art, checked 2026-11-11:
  - Svelte 5: `out:` or `transition:` on an element in an `{#each}`. The block keeps every element of the block in the DOM until its transitions end; local transitions play when the item is added or removed ([docs](https://svelte.dev/docs/svelte/transition)). The form is an element directive.
  - Solid: `<TransitionGroup onExit={(el, done) => …}>` of [solid-transition-group](https://github.com/solidjs-community/solid-transition-group/blob/main/README.md) (README on main, 2026-11-11). `done()` removes the element. Without `done`, it waits for `transitionend` or `animationend`. Classes are `<name>-exit`, `-exit-active`, `-exit-to`.
  - Vue 3: `<TransitionGroup>` needs a unique `key` on each child. `.list-leave-active` and `.list-leave-to` classes, or JS hooks `@leave="(el, done) => …"` with `:css="false"` ([guide](https://vuejs.org/guide/built-ins/transition-group.html)). It advises `position: absolute` on leaving items so the others can move.
  - Terracotta `Transition` (already in @brumate/ui) keeps content until `transitionend`.
- Chosen form: a clause on the `#for` header, `leave(handler)`, where the handler returns a promise. Why: (1) decisions.md has no element directives (`use:` was refused, line 121), and a `#` block is for markup, so the hook is not a new block. (2) `window(…)` already sets the precedent for a clause after the header. (3) A promise replaces `done`, as `await` does everywhere else in brumate, and `Element.animate().finished` and `leaveSteps` already return one. (4) It is one place per list, as Vue's group and Solid's group, and needs no wrapper element.
- Open question (the maintainer's): the clause above, or a camelCase event attribute on the row's element, `<li onLeave=(…)>`. Recommendation: the clause. The event form has no way to hold the node, since the event runs after the scope is gone and needs `done` again.

## Steps

- [ ] Parser and AST: `leave(expression)` after the header of a `#for`, before or after `window(…)`. `#repeat` and a windowed `#for` with `leave` are compile errors (new BRM code in error-catalog.ts, documented in website/docs/errors.md). Highlight and `check` keep working.
- [ ] Codegen: pass the handler as one more argument of `$$b.list`, hoisted like the key. The server ignores it.
- [ ] Feature flag `leaves` in both features.ts files, gated like `windows`.
- [ ] `list()`: for an item that leaves, destroy the scope, set `inert`, call `handler(firstElement)` (the first element node of the row; a row with no element does not wait), and remove the nodes when the promise settles or rejects (a rejection is reported to the nearest `#catch`... or `console.error` if the worker finds no hook; do not leave the node). Keep leaving nodes in a `WeakSet`; skip them in the scan, in `others` and in `clear`. Order: a leaving node stays where it was, the new items go around it.
- [ ] A key that returns while its old item leaves renders a new row. The old nodes finish and go.
- [ ] Use it in `ToastRegion` only if it is smaller; otherwise leave the toast code alone (the node is not a ui rewrite).
- [ ] Docs in control-flow.md and reference-blocks.md, the decisions.md entry with the prior art above, the changeset.

## Acceptance

- [ ] `packages/brumate/test/for-leave.test.ts` (fails on release/0.8, which has no clause): an item removed from a keyed `#for` stays in the DOM until its handler's promise settles, then goes; its scope is destroyed at once (an effect inside it stops); a list update while it leaves keeps it and does not duplicate it; reorder of the other items during a leave keeps their elements; removing all items shows the fallback after, not over, the leaving nodes; a key added again during the leave renders a new row; a rejecting handler still removes the nodes; a list without the clause behaves as before.
- [ ] Resume: a page rendered by the server, resumed in the test DOM, removes an item with the clause and waits as above.
- [ ] Compile errors for `#repeat` and `window` with `leave`.
- [ ] `pnpm bench --only brumate --scenario todos`: the client gzip size is the same as release/0.8 (the flag removes the code).
- [ ] Docs page section, one decisions.md entry, a minor changeset for `brumate` (`.changeset/for-leave.md`).
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/for-leave.test.ts test/lists.test.ts`. Then `pnpm lint`, `pnpm format:check`, `pnpm typecheck`.

## Sizing

M. Parser, codegen, runtime, flag and docs across several files, but one behavior. Uncertainty medium: the scan, `others` and `clear` paths all drop nodes. No dependencies.

## Notes for the worker

- Check the test names of `test/` for the list tests that exist; extend the same helpers.
- Run the e2e of the website only if a page uses the clause; none has to.
- Do not add `data-*` attributes from the runtime beyond `inert`. CSS-only users can write the animation in the handler.
- Do not add a prefix to the clause or a deprecation path. The name `leave` is new, so nothing breaks.
- Keep the new code behind `HAS_LEAVES`; check the todos bundle for the strings.
