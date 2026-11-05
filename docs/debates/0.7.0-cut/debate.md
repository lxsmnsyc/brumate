---
goal: Re-cut 0.7.0 to ship 8 to 12 new features, moving bug fixes to 0.6.x patches and the rest to 0.8.0+
date: 2026-11-05
rounds: 1 of 1
status: approved
roadmap: docs/roadmaps/brumate
supersedes: none
decision: none
---

# Debate: re-cut of 0.7.0

A short debate (one round, no subagents): moving a node between milestones costs one frontmatter edit and can be undone.

## Settled structure

0.6.1, a patch milestone with `target: main` (P1, O1 rejected):

- client-fixes: ref setters after the render, memo-reject, class-order
- render-memos: fixes the memo-throw, debounce-start and function-prop-reads divergences (7 pages)
- dom-content-loaded: keeps the name `onDOMContentLoaded`, since a rename would be API (O8)
- text-field-refused-edit: refine the outline first

0.7.0, with 11 features (P2, O4, P4):

1. context-stores: static contexts, with `$store` (story, 6 children)
2. memo-guard: `$gate`
3. conditional-rest-spread
4. control-target
5. element types: mathml-elements and missing-attributes, counted once (O4)
6. graph-node-locations
7. dev-dock-redesign (the approved prototype)
8. skill-command-packages (refine the outline)
9. popover-sizing
10. fieldset
11. is-pending-many, from the backlog (P4, refine the outline)

The 0.7.0 work below ships but does not count as features (P3): the context-stores spike and children, clone-remaining-bodies, no-client-html, cold-paths-spike, split-ui-examples, coverage-script, skill-tasks, skill-blocks-typecheck and part-guides.

## Budget

- time: about one to two 0.6.0 cycles. 0.6.0 shipped 8 features in 2 days (J4).
- device: unchanged, at most 3 workers (GOAL.md Verification).
- tokens: not capped. Parking 12 nodes removes about a third of the 0.7.0 work (J1).

## Rejected

- Parking fieldset and split-ui-examples (O5): split-ui-examples unblocks four parts, and forms are core to ui.
- Keeping render-memos out of the patch for its size (O1): the patch rule is about API, not size.
- Pulling defer-reveal, external-scripts or view-transitions from the backlog (O9): their design is open, or they wait for an app that needs them.

## Scope changes

- park to a new 0.8.0 milestone: devtools-copy, editor-sizes, head-rerun-scripts, partial-route-responses, color-scheme, context-menu, popover-group-alert, inlining-spike, loader-preload-spike, store-lens-spike (O3)
- park to 0.8.0: dev-setup-in-plugin (O6), tsc-check-api (O7)
- move from 0.7.0 to 0.6.1: client-fixes, render-memos, dom-content-loaded, text-field-refused-edit (P1)
- move from backlog to 0.7.0: is-pending-many (P4)

## Open risks

- dev-dock-redesign is an L outline and may slip (O2): accepted, because 0.7.0 still has 10 features without it. block-styles is the reserve (O9).

## Inferred choices

- Patch rule (J3): from the 0.4.1 rule in GOAL.md, fixes of shipped behavior that add no API.
- Feature count (J5): a node that adds user-visible API; a story counts once.
- 0.8.0 milestone (J6): no 0.8.0 milestone exists yet, so a new one goes between 0.7.0 and backlog.
- Main can take the fixes (J2): `next` has no commits that `main` lacks.

## Answers from the user

- none asked

## Overruled

- none

## Cost of this debate

- 1 of 1 rounds, orchestrator only
