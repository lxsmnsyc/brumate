---
id: view-transitions
title: Named view transitions
status: todo
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/view-transitions && node e2e/run.mjs --only transitions
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/brumate/src/runtime/view-transitions.ts
  - packages/brumate/test/view-transitions/**
  - e2e/suites/transitions.mjs
shared:
  - packages/brumate/src/runtime/events.ts
  - packages/brumate/src/runtime/navigate.ts
  - packages/brumate/src/runtime/boot.ts
  - packages/brumate/src/runtime/features.ts
  - packages/brumate/src/features.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/elements.d.ts
  - e2e/run.mjs
  - e2e/README.md
  - website/docs/navigation.md
  - website/docs/events.md
  - docs/decisions.md
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

> 2026-11-18: made a must of 0.9.0 by the maintainer, the 10th feature of the cut (docs/debates/0.9.0-cut/debate.md, amendment 2026-11-18). Refined the same day. The navigation debate (docs/debates/navigation/debate.md) keeps the full-page swap, so a navigation animates the elements that a page marks, not a partial response.

# Named view transitions

## Goal

`viewTransition="todo"` marks an element, and `viewTransitionName=(expr)` gives it a name of the author. The core puts `view-transition-name` and `view-transition-class` on the marked elements only while a transition of brumate runs, for a handler wrapped in `transition()` and for a client navigation with `transition: true`. Lists then slide, and a picture can move from a list page to its detail page, with no hand-written unique names.

## Current state

- `transition(handler, ...types)` of `brumate/events` calls `document.startViewTransition` itself and waits for the writes through `Symbol.for('brumate.updated')` (`runtime/events.ts:136-175`). It runs the handler as it is with `prefers-reduced-motion`.
- A navigation does the same in its own function, `transition(visit, update)`, with the types `push`, `traverse` and `form` (`runtime/navigate.ts:39-62`), called at `navigate.ts:824`. It does not check `prefers-reduced-motion`; the docs tell the author to switch the animation off in CSS (`website/docs/navigation.md:218-250`).
- `NavigateOptions.transition` turns it on (`runtime/boot.ts:55-61`; `navigate: { transition: true }` in the plugin options).
- Names are written by hand today (``style=(`view-transition-name: todo-${todo.id}`)``), and every named element takes part in every transition.
- No attribute named `viewTransition` exists; types of global attributes are in `elements.d.ts`.

## Prior art

Pinned SHAs: react `6ff257439b3a`, astro `c7a2f1d16a08`, kit `1bd56525a540`, solid-router `def64e609e6b`.

| Choice | View Transition API | Astro | SvelteKit | React `<ViewTransition>` | Solid Router | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Name | `view-transition-name` CSS, unique on the page, always on | `transition:name` sets the name for the page ([router.ts](https://github.com/withastro/astro/blob/c7a2f1d16a08bab8c9e2d380e0991fb22a5bafc1/packages/astro/src/transitions/router.ts)); on all the time | by hand in CSS | `name` prop; with no name it makes one for each instance, and applies it only during a transition ([ReactFiberViewTransitionComponent.js](https://github.com/facebook/react/blob/6ff257439b3919fc8dcc643b635e09d62fa74d0e/packages/react-reconciler/src/ReactFiberViewTransitionComponent.js)) | none: no view transition support in routing | Like React: a generated name per instance, only while a transition runs. `viewTransitionName=(expr)` for a shared name, as React's `name`. |
| Class | `view-transition-class` groups elements for one rule | not used | not used | `enter`, `exit`, `update`, `share` map to classes | | `viewTransition="todo"` is the class. |
| Start | `document.startViewTransition(update)` | `<ClientRouter />`, line 517 of router.ts | `onNavigate` calls it ([client.js](https://github.com/sveltejs/kit/blob/1bd56525a5409fab4153196f026cf85ef620e3b2/packages/kit/src/runtime/client/client.js), `onNavigate`) | the renderer starts it | | Brumate already starts it: `transition()` and `navigate`. Both go through one helper. |
| Navigation | cross-document needs CSS `@view-transition` | the router | the author | | Client navigation only. The author names what pairs two pages. |

## Decisions

- The attributes: `viewTransition="todo"` (a static string, a class name) and `viewTransitionName=(expr)` (any expression, a CSS `<custom-ident>`). Both are typed on every element in `elements.d.ts`. They render as `b-vt="todo"` and `b-vtn="name"`, so the page has no `view-transition-*` property at rest and nothing takes part in a transition it was not asked to.
- `viewTransition` without `viewTransitionName` gets a name from the runtime: `todo-<n>`, with `n` from a counter that the runtime keeps for the element in a `WeakMap`. It is not the key of `#for … by`, since a key can be any value and two keys such as `1` and `'1'` would give one name. A keyed list keeps the element of an item, so an element that moves keeps its name and slides; a new one fades in and a removed one fades out.
- A new module `runtime/view-transitions.ts` exports `startTransition(update, types)`. It replaces the two calls of `startViewTransition` in `events.ts` and `navigate.ts`. Each caller keeps its own rule on `prefers-reduced-motion` (handlers skip the transition; navigation does not change).
  1. Before `startViewTransition`: set `view-transition-name` and `view-transition-class` on each `[b-vt],[b-vtn]` element that intersects the viewport (`getBoundingClientRect`). Elements out of view get no name, so an element that comes from far off screen fades in. This is the proposal's "near the viewport", with the viewport as the limit.
  2. In the update callback, after the writes (`UPDATED`) or after the swap: name the marked elements that the update added and that are in view.
  3. When `transition.finished` settles: remove the names and classes.
  Elements of layouts that stay keep a `viewTransitionName` that pairs old and new. Two elements with one name at once make the browser skip the transition; the helper skips names that are already taken on the page and warns in development.
- Code that does not use the feature: a build flag `viewTransitions` (`src/features.ts`, set by the compiler when an element has the attributes). Without it, the helper is only the `startViewTransition` call that exists today, and the naming code is cut. A page that does not use the feature adds 0 bytes; the bench of todos must show the same gzip JS.
- Rejected: naming at compile time with the scope ID, because a block that the browser renders needs the same name and the runtime counter does the same with no table; putting `view-transition-name` in the server HTML, because it takes part in every transition and every navigation captures it.
- The `prefers-reduced-motion` check stays out of `navigate`: changing it is a separate behavior change and the docs already say to use CSS.
- The overlap in `navigate.ts` with `style-files-navigation` (waits for stylesheets before the swap) is in `transition()` and the swap callback. The helper takes the update as a function, so the stylesheet wait can sit inside it; merge `release/0.9` before the PR.

## Steps

- [ ] `elements.d.ts` types, the attribute rendering of `b-vt` and `b-vtn` on the server and the browser, the `viewTransitions` feature flag.
- [ ] `runtime/view-transitions.ts`; `events.ts` and `navigate.ts` use it.
- [ ] Docs: a section in `website/docs/navigation.md` (a list that animates, a shared picture), `events.md`, `docs/decisions.md`, a minor changeset.
- [ ] Real-browser test.

## Acceptance

- [ ] A keyed `#for` with `viewTransition="todo"` inside a `transition()` handler: an item that moves slides (its `getAnimations()` of `::view-transition-group` or the `ViewTransition` it started shows a group for it), an added item fades in, a removed one fades out. A test in Chrome (`e2e/suites/transitions.mjs`) reads `document.getAnimations({ subtree: true })` pseudo-element targets by name.
- [ ] While no transition runs, no element has `view-transition-name` (checked in the same test, before and after).
- [ ] A client navigation with `transition: true` between two pages whose picture has the same `viewTransitionName` pairs the two elements; an element out of view is not named.
- [ ] The names are removed after `finished`, also when the update throws or the transition is skipped.
- [ ] `prefers-reduced-motion` keeps a handler from starting a transition; a browser without `startViewTransition` runs the update as before.
- [ ] A page without the attributes adds 0 bytes: the same gzip JS for todos (`pnpm bench --only brumate --scenario todos`) as `release/0.9`.
- [ ] Docs, `docs/decisions.md` (the rule that names exist only during a transition) and a minor changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`, then the tests of the node. Report the todos gzip size in the outcome.

## Sizing

M: the attributes on server and browser, a shared runtime helper, two callers and a real-browser test, with no new compile error. One change.

## Notes for the worker

- Chrome supports `view-transition-class` since 125; other browsers ignore it and the transition still runs. Check the support of `document.startViewTransition` types as `navigate.ts:55-59` does.
- `external-scripts` also edits `navigate.ts` and `elements.d.ts`, in other places.
- Do not change when `navigate` starts a transition; only what it names.
