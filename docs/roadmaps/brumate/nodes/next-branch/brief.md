---
id: next-branch
title: Set up the next branch for minor work after 0.4.0
status: done
priority: should
type: chore
outline: false
milestone: 0.4.1
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-10-28
owns: []
shared:
  - docs/roadmaps/brumate/GOAL.md
  - docs/decisions.md
  - .github/workflows/**
  - .changeset/config.json
  - CONTRIBUTING.md
reserves: []
provides: []
depends_on:
  - on: release-0.4
    kind: hard
    why: the policy starts after the 0.4.0 release
---

# Set up the next branch for minor work after 0.4.0

## Goal

After 0.4.0, minor-release work goes to a `next` branch, and hotfixes still go to `main`. `next` is synced with `main` after every release from `main`.

## Policy (the maintainer, 2026-10-28)

- Minor work (features, minor fixes, docs for unreleased work): pull requests target `next`.
- Hotfixes found while working on those pull requests, or anywhere: a pull request from `main` to `main`, as today.
- After every release from `main` (the Version Packages pull request merges), merge `main` into `next` so `next` has the hotfixes and the versions.
- A minor release promotes `next` into `main` through a gated release node.

## Tasks

- Create `next` from `main` right after the 0.4.0 release.
- Fill the `branches:` frontmatter of docs/roadmaps/brumate/GOAL.md (`feature: next`, `fix: next`, `docs: next`, `hotfix: main`, `promote: next -> main`), so `plan.py ready` gives each node its target. Retarget open nodes; write `type: hotfix` on the main fixes.
- Make CI run on pull requests and pushes to `next` (check .github/workflows), and keep the Release workflow on `main` only. Decide whether `next` publishes prereleases with changesets pre mode; ask the maintainer.
- Write the policy in docs/decisions.md and in the contributing notes, and add a release-node pattern for the sync of `next` after each main release.

## Acceptance

- [ ] `next` exists; CI runs on it; `plan.py ready --json` shows `next` as the target of feature nodes and `main` for hotfix nodes.
- [ ] The policy is in docs/decisions.md and GOAL.md.

## Sizing

S: a branch, CI triggers and the roadmap policy.
