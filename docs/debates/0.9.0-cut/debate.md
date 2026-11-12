---
goal: Cut 0.9.0 to ship the features an app needs, 8 to 12 of them, with fixes of 0.8.0 behavior in a 0.8.1 patch
date: 2026-11-12
rounds: 1 of 1
status: proposed
roadmap: docs/roadmaps/brumate
supersedes: none
decision: none
---

# Debate: cut of 0.9.0

A short cut (one round, no subagents), as for 0.7.0 and 0.8.0: moving a node between milestones costs one frontmatter edit and can be undone. It waits for the maintainer's approval.

## Facts

- After 0.8.0 the roadmap had no next milestone: 11 open should and could nodes of 0.8.0 and 27 backlog nodes, 22 of them parked.
- The maintainer, 2026-11-12: "size doesn't matter currently, we can make adjustments after we've shipped what needed". Todos gzip JS before `load` was 14.8 kB at 0.4.1, 13.6 kB at 0.5.0 and 0.6.0, and 13.8 kB at 0.7.0. The open size nodes move it by about 0 by their own briefs.
- Three proposals had no node and are not built (checked on `release/0.8`): async effects (`BRM096` still rejects them), `$produce` with maps and sets (`runtime/produce.ts` uses a `Map` as it is, so a write to it updates nothing), and the warning for effects that only copy signals.
- The differential test still lists four causes to remove: `try-rollback` (clone-remaining-bodies), `ref-loop`, `template-context` and `pending-read`. The last three had no node.
- mcp-server waited for skill-tasks, which is done. The server components spike waited for the smaller client, which ended with the no-go of values-spike.

## Settled structure

0.9.0, with 8 features, on `release/0.9`:

1. partial-route-responses (a story; chosen by the maintainer on 2026-10-30 over a client router)
2. external-scripts (analytics and widgets; every site needs one)
3. async-effects
4. produce-map-set (today a silent no-update)
5. effect-copy-warning
6. style-scope-where (scoping adds no specificity; a break, so it lands in a minor)
7. mcp-server (a story; agent support is rated high in the proposals)
8. observability (`onTrace` with an OpenTelemetry adapter)

Must, not counted: skill-0-9-apis.

Should, shipped but not counted: style-files (the reserve if a feature slips; its gated spike first), server-components-spike (gated), clone-remaining-bodies then no-client-html, tsc-check-api, part-guides, skill-blocks-typecheck, coverage-script (with items 9 and 10 of the client audit).

0.8.1, a patch milestone with `target: main`, after the 0.8.0 promotion: ref-element-writes, template-context, pending-read, children-rerender (prove it first) and resume-test-races. Bugs found on `main` during 0.9.0 work join it.

Parked in the backlog: cold-paths-spike, loader-preload-spike, inlining-spike, lazy-sync-memos-spike (size is not a goal now) and store-lens-spike (no user asks for it; its questions predate `$store` and `derived`).

GOAL.md: size is recorded, not a gate.

## Rejected

- i18n, images, offline-pages, realtime, embedding as 0.9.0 features: L and XL stories with no refined design. One of them can lead 0.10.0; i18n has the highest value in the proposals.
- view-transitions and defer-reveal: the proposals rate them low and say to build them when a page needs them.
- for-leave: it waits for its own goal debate.
- The three differential fixes on `release/0.9`: they fix shipped behavior and add no API, so they are patch work by the rule of 0.6.1.

## Open

- Every new node but the two releases is an outline. Refine each before it starts, with the survey of prior art its brief names.
- partial-route-responses and mcp-server are L stories; if both slip, the cut has 6 features and style-files is the only reserve.

## Amendment, 2026-11-12

The maintainer dropped drop-marker-index: its rule lives in no-html-string-fallback, clone-remaining-bodies and no-client-html, and the rest saves almost nothing. fixed-walks stays parked and now waits for clone-remaining-bodies.
