---
id: usage-pruning-spike
title: "Spike: ship only the client runtime functions a page uses"
status: active
priority: must
type: spike
outline: false
milestone: 0.5.0
target:
from:
size: M
spike: true
verify:
exclusive: [bench]
fulfilled_by:
gate: true
added: 2026-10-30
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: perf-pass-0.4
    kind: hard
    why: its report and benchmarks/brumate-0.3 give the baseline to measure against
---

# Spike: ship only the client runtime functions a page uses

## Goal

The client core is one prebuilt chunk that drops code by a few feature flags (`children`, `templates`, `lateMarkup` and more). Most paths ship on every page. Find out what it saves to let the bundler drop unused runtime functions one by one, from what the compiler knows each page uses, and what that costs in build complexity.

## Context

- Measured on 2026-10-30 with Chrome coverage on the todos benchmark (load, counter, toggle, add): brumate loads 37.6 kB raw and runs 19.6 kB (52%); Marko 6 loads 9.3 kB and runs 6.0 kB (64%).
- Code the todos page can never call, by its features: `asyncMemo` (no promises), `fail` and `replaceTry` (no `#try`), `call` and `serverBuild` (no server functions), `keyMatches` (no key filters), `currentRoute` (no route context), `prop`, `typedInto`, `foreignOf`, `parseHTML`, `loadOnce`. About 3 to 4 kB raw, 1.5 kB gzip. Coverage alone is not proof: `destroyRange` and the list's `leave` did not run but removing a todo needs them.
- Largest files not run on todos (raw): boot.ts 2.0 kB, client/updates.ts 2.0 kB, client/scopes.ts 1.6 kB, shared.ts 1.4 kB, lists.ts, resume.ts and html.ts about 1.1 kB each.
- Scripts used: coverage with playwright-core over benchmarks/harness/serve.mjs, attribution through the Vite and tsdown source maps. Rebuild them in the spike; they were kept in a session scratchpad only.
- Marko 6 does this with compiled output that imports single runtime helpers.
- Known candidates from the runtime audit of 2026-11-01 (measured on trimmed copies of the todos core):
  - `refresh` runs on every insert (client/insert.ts, about 30-100, and `refreshNames`) but only server children and async memos of new scopes need it. A feature flag like `lateMarkup` saves 730 B min / 251 B gzip on todos.
  - `list` carries the windowed list's `park` code (client/lists.ts `leave`, `parked`, `back`, `redraw`) on every page: 550 B min / 176 B gzip if absent; a split where `windowList` passes callbacks saves about 300-400 B min (guess).
  - String branches not gated by `HAS_CLIENT_HTML` (lists.ts `added`, templates.ts `fillRange`, `bodyNodes`, `fillList`): 101 B min / 34 B gzip.
  - templates.ts repeats `keepText`/`appendText` and `scopes.get` + `found.n ??= []` six times: 181 B min / 21 B gzip.

## Questions

1. Which runtime paths can the compiler prove a page never needs, and from which facts (blocks used, handlers, promises, server functions, modifiers)?
2. Per-function exports and the bundler's tree shaking, or more feature flags, or generated runtime per build? Measure at least two.
3. What happens to shared chunks when pages of one app use different sets (the core is shared across pages today)?

## Acceptance

- [ ] outcome.md with the measured gzip saving on todos, dashboard, rows and the website, the chosen approach, its cost, and a go or no-go.
- [ ] Every candidate passes the brumate tests.
- [ ] Gate: the maintainer decides go or no-go.

## Sizing

M: time-boxed to three days.
