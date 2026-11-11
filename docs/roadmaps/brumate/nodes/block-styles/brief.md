---
id: block-styles
title: Styles in blocks
status: done
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.8.0
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/styles/block-styles-live.test.ts
exclusive: []
fulfilled_by: 08001cf1 (batch/brumate-release-0.8)
gate: false
added:
spent: 473000
owns:
  - packages/brumate/test/styles/block-styles-live.test.ts
shared:
  - packages/brumate/src/codegen/client.ts
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/plan.ts
  - packages/brumate/src/runtime/client/page.ts
  - e2e/suites/website.mjs
  - website/docs/control-flow.md
  - website/docs/styles.md
  - docs/grammar.md
  - docs/decisions.md
  - packages/brumate/skills/brumate/SKILL.md
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: block-styles-scope
    kind: hard
    why: the live update runs over the block attributes, sites and render-time variables that scope builds
---

# Styles in blocks

## Goal

A `<style>` in a block body is scoped as the `let` of a block script is, with `${}` reading the values of the block, and its custom properties follow those values after the first render. This node adds the update of the variables for each instance (a signal of a block script, the item of a keyed `#for`), resume, the docs and the changeset. Parse, scope and the first render are block-styles-scope.

```brm
#for (tag of tags by tag.id) {
  <script>
    let hovered = $signal(false);
  </script>
  <span class="tag" onPointerEnter=(() => (hovered = true))>{tag.name}</span>
  <style>
    .tag {
      background: ${tag.color};
      outline: ${hovered ? '2px solid' : 'none'};
    }
  </style>
}
```

## Context

- Source: [Styles in blocks](../../../../proposals.md#styles-in-blocks); read the outcome of block-styles-scope for the attribute names and where the variables are written.
- A live style variable is an update function per site: `emitBinding` writes `$$b.setVar($$s, name, value)` for a `style` site (codegen/client.ts:1219-1232). `setVar` finds the elements by `[b-v="<scope.id>"]` in the document (runtime/client/page.ts:10-17). Markup writes `b-v` on the elements of a live component through `emitLiveStyles` (codegen/markup.ts:2156-2162), when `plan.liveStyles` is true (plan.ts:803-808).
- For a block, the scope is the instance scope of the body. It needs an ID when a style variable of the block is live (`needsId`, plan.ts around 790), and every top-level element of the instance carries `b-v="<id>"`. Navigation already shifts `b-v` (`IDS` in runtime/navigate.ts:343), and resume reads scope IDs from the page state, so a block scope that has an ID needs no new record.
- Rows of a keyed `#for` keep their scope when they move, so their elements keep their variables; a row removed takes its elements with it. Check that `setVar` on one instance does not touch another (the query is by ID).
- Cost to watch: `setVar` queries the whole document per update, so a list of 1000 rows that share a live value makes 1000 queries per change. The todos app uses no block style, so its client must not grow: the check is its client size before and after.
- Decisions: no deprecation period, nothing existing changes (a `<style>` in markup was an error). Docs go beside "A script in a block" (website/docs/control-flow.md:89), with "A style in a block" as the proposal says, and a section in website/docs/styles.md.

## Steps

- [ ] Probe on `release/0.8` once block-styles-scope is merged: a `#for` whose style reads a block-script signal, changed by a click, and a keyed reorder. Write the failing test first.
- [ ] Plan: a block scope with a live style variable needs an ID; markup writes `b-v` on the top-level elements of the instance; the update function calls `setVar` with the block scope.
- [ ] Resume: render on the server, resume in the browser, change the signal; only that row's variable changes. Also a block rendered by the browser (a new row, a branch that opens).
- [ ] Docs, skill and changeset.

## Acceptance

- [ ] Browser-render tests in `packages/brumate/test/styles/block-styles-live.test.ts` (fail on main): a click changes one row's custom property and not the others; a keyed reorder keeps each row's value; an `#if` branch that opens writes its variables; a prop of the item that changes updates the row; after resume the first change works.
- [ ] A step in `e2e/suites/website.mjs` checks the live sample of the docs in a real browser: after a click, the computed style of one row changes and the other rows' do not.
- [ ] Todos client JS (gzip) is within 0.1 kB of release/0.8 before the node (`pnpm bench --only brumate --scenario todos`).
- [ ] Docs: "A style in a block" in website/docs/control-flow.md and a section in website/docs/styles.md, with live samples (`brm live`) that `pnpm --filter website check:samples` accepts; docs/grammar.md lists `<style>` in a body; docs/decisions.md has one entry; the brumate skill mentions it.
- [ ] A minor changeset for `brumate` (`.changeset/block-styles.md`), and for `@brumate/language-core` if block-styles-scope changed it.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/styles`. Then `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `node e2e/run.mjs --only website`.

## Sizing

M. Uncertainty medium (live per-instance variables over block scopes and resume). Blast radius medium: client codegen and `codegen/markup.ts`, which other open nodes edit. Size medium: 4 source files, 2 test files, 6 docs files.

## Notes for the worker

- If `setVar` by document query is too slow for lists, change it to a query inside the instance's own top-level elements only after you measured it. The proposal says "a change sets them on the elements of that instance".
- Do not make a `<style>` in markup valid. Only a body's top level holds one.
- Docs must not claim more than the tests show.
