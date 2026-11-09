---
goal: Cut 0.8.0 to ship 8 to 12 new features from the open 0.8.0 nodes and the backlog, with bug fixes of 0.7.0 in a 0.7.1 patch
date: 2026-11-09
rounds: 1 of 1
status: approved
roadmap: docs/roadmaps/brumate
supersedes: none
decision: none
---

# Debate: cut of 0.8.0

A short cut (one round, no subagents), as for 0.7.0 (../0.7.0-cut/debate.md): moving a node between milestones costs one frontmatter edit and can be undone. The maintainer approved it on 2026-11-09.

## Settled structure

0.7.1, a patch milestone with `target: main`:

- attribute-value-case: enumerated attributes accept any case where HTML does, and `translate=""`
- rest-ref-test-wait: the rest-props ref tests use `waitFor` instead of a fixed 300 ms

0.8.0, with 10 features, on `release/0.8`:

1. dev-dock-redesign (the approved prototype; slipped from 0.7.0)
2. devtools-copy (needs the new dock)
3. color-scheme
4. context-menu
5. popover-group-alert (two parts, counted once)
6. derived-stores
7. head-rerun-scripts
8. block-styles (the 0.7.0 reserve, from the backlog)
9. dev-setup-in-plugin
10. editor-sizes

Should, shipped but not counted: partial-route-responses (L, kept off the must line for its risk), tsc-check-api, part-guides, skill-tasks, skill-blocks-typecheck, clone-remaining-bodies, no-client-html, render-memo-reads, cold-paths-spike, coverage-script.

Could: inlining-spike, store-lens-spike, loader-preload-spike.

## Rejected

- partial-route-responses as a must feature: an L outline that changes the navigation protocol; it can slip without moving the release.
- tsc-check-api as a feature: it changes how `brumate check` runs, not what a user writes.

## Open

- dev-dock-redesign, derived-stores, head-rerun-scripts and block-styles are outlines; refine them before they start.
