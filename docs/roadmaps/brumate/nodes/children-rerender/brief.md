---
id: children-rerender
title: A spread onto a component does not render its children again
status: active
priority: must
type: fix
story:
early: false
outline: false
milestone: 0.8.1
target: main
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter @brumate/ui exec vitest run test/navigation-tree.test.ts test/tree.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent:
owns: []
shared:
  - packages/ui/test/navigation-tree.test.ts
  - packages/ui/test/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
reserves: []
provides: []
depends_on:
  - on: release-0.8
    kind: hard
    why: it branches from `main` after the 0.8.0 promotion
---

> 2026-11-19 (refine): most likely already fixed on main. spread-children-live (#281, 2026-10-27) found the cause and fixed it, and rest-ref-local-error removed the workaround, so NavigationTreeItem now spreads `{...rest}` onto TreeItem with children. This node adds the guard test the outline asked for and closes; it changes runtime code only if the test fails.

# A spread onto a component does not render its children again

## Goal

Add a test in @brumate/ui that pins the case found on 2026-10-26 (#172): a NavigationTree whose items spread `{...rest}` onto TreeItem keeps the nodes and focus of the rows' children when a row opens or closes. If it passes on main, close the node with the test (`fulfilled_by: #281`). If it fails, fix the core cause in the same PR.

## Context

- The outline's guess (a template body sends `children` again after resume) was checked by spread-children-live: "no update of a parent sends `children`". The real cause was `refresh` (`runtime/client/insert.ts`) running the updates of new server markup with the record's values, so `content`/`text` of a live `children` got the `RenderedChildren` and `write` replaced the server's nodes. The fix keeps the nodes when the insert is the one where the server rendered them (`ChildrenReference.at`/`.anchor`, `write` in `runtime/client/inserts.ts`), and `retag` keeps a component in `as`.
- Its tests are on main: resume.test.ts `describe('a spread onto a component')` (about line 3792), fixtures `test/render/spreadChildren*.brm`, including "keeps the children of the component in a template when the template updates", which is the outline's repro (a template that renders a box with a spread).
- rest-ref-local-error removed `TreeItemAttributesContext`; `packages/ui/src/NavigationTreeItem.brm` passes `{...rest}` to `<TreeItem>{children}</TreeItem>` on main. tree.test.ts "opens and closes with the chevron, which keeps focus on the row" passes, but it re-queries the row, so it does not prove that the nodes stay.
- Limits that spread-children-live left (its outcome, Gotchas): children of a record sent before the server rendered them (a layout's children in a streamed body) have no `at`; a second insert of the same children renders them again; children inserted through a local const get no anchor. These re-render by design or are separate; do not chase them here unless the new test hits one.
- The ui tests mount several pages in one loaded core, so the second mount refreshes; that is where the bug showed. Mount the page twice in the same core in the test, so the refresh path runs.

## Acceptance

- [ ] A test in packages/ui/test/navigation-tree.test.ts: keep a reference to a row's link element (and focus it), open and close a sibling row and the row itself, and expect the same element and `document.activeElement`. Run it against a second mount in the same core.
- [ ] If it passes on main: no code change; the outcome names #281 and rest-ref-local-error as the fix and the test as the guard. No changeset.
- [ ] If it fails: a fix in packages/brumate/src/runtime/client, a resume test in packages/brumate with a fixture, and a patch changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`; `pnpm --filter @brumate/ui test` passes.

## Sizing

S: one test; a fix only if the test shows a gap.

## Notes for the worker

- Run the ui tests with `--maxWorkers=2` if they time out under load; do not loop them.
