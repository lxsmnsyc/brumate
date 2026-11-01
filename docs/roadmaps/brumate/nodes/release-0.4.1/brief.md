---
id: release-0.4.1
title: Release brumate 0.4.1
status: active
priority: should
type: release
outline: false
milestone: 0.4.1
target: main
from: main
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-10-31
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: untrack-prop-value
    kind: hard
    why: a handler write is lost when a prop value is wrapped in $untrack (debate function-prop-derivations)
  - on: context-writer-loop
    kind: hard
    why: an effect that calls a context writer loops on 0.4.0 (debate function-prop-derivations)
  - on: next-branch
    kind: hard
    why: minor work must go to next, so no 0.5.0 change lands on main before this release
  - on: function-prop-reads
    kind: hard
    why: a memo that calls a function prop must update, as the docs say
  - on: visible-forwarded-ref
    kind: hard
    why: a visible $client must wait for a forwarded element
  - on: setter-ref-resume-rest
    kind: hard
    why: a setter ref in the rest props must run on resume, as a named one does since 0.4.0
  - on: runtime-brand-checks
    kind: hard
    why: two copies of the runtime must not drop attributes; done with no change if it can't be reproduced
  - on: prop-write-load-error
    kind: hard
    why: a prop write to a child whose code fails to load must reach the nearest #catch
  - on: drop-preload-helper
    kind: hard
    why: the loader drops Vite's preload helper, about 0.68 kB gzip on todos (the maintainer, 2026-11-01)
---

# Release brumate 0.4.1

## Goal

Publish brumate 0.4.1 with the patch fixes of the 0.4.1 milestone, and the other packages at the versions their changesets give.

## Context

- The maintainer chose the patch cut on 2026-10-31. The nodes fix 0.4.0 behavior and add no API, so every changeset is a patch. A minor or major changeset in the version pull request means a node of 0.5.0 landed on `main` by mistake: move it to `next` before the release.
- Releases run through changesets: a push to `main` opens or updates the "Version Packages" pull request, and merging it publishes. This node checks that pull request and hands it to the maintainer. The orchestrator never merges it (`gate: true`).
- Before handing it over: `pnpm build && pnpm test && node e2e/run.mjs` pass on `main`, `pnpm bench` todos size is recorded against release-0.4 (15.2 kB gzip JS before `load`), and `pnpm pack --dry-run` shows no test fixtures.
- After the release, `next` is synced with `main` (GOAL.md, branches). That merge conflicts in packages/brumate/src/runtime/client/updates.ts (`trigger`, `queueWrite`, `pass`) between #402 (context writer loop) and #407 (prune-lazy-parts) if #407 lands first. After it, restore the two tests that #407 deleted because they need #408's props.ts fix: `a rejected load reaches the #try and the effects run` and `a rejected load of a write that joins a pass reaches onError` (from #407's history).

## Acceptance

- [ ] The Version Packages pull request shows brumate 0.4.1 and only patch bumps, and its changelog reads well.
- [ ] Build, tests, e2e, the bench and the pack check pass on `main`; the results are in the outcome.
- [ ] The maintainer merges the pull request and the package is on npm.
- [ ] `next` is synced with `main`.

## Sizing

S: checks and one pull request that the tooling writes.
