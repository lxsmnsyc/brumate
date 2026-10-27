---
milestones: [core-correct, agent-skill, ui-0.1, smaller-client, features, backlog]
review: auto  # self for S, docs and chore nodes, a fresh reviewer for the rest
merge:
  # The user chose auto-merge on 2026-10-26. The orchestrator merges the pull requests that pass
  # plan.py can-merge, and the rest wait for the user.
  mode: auto
  method: merge
  max_size: M
  exclude: [release, hotfix, contract, gate]
branches:
---

# brumate

## Outcome

The core is correct and safe to change, agents write good .brm files with a skill, @brumate/ui is ready to publish, and the client keeps shrinking. Far-off proposals stay in the graph as outlines until a milestone reaches them.

## Acceptance

- core-correct: the 5 `it.fails` tests of "updates of a signal and a memo of it" pass as `it`, and `pnpm build && pnpm test && node e2e/run.mjs` passes.
- agent-skill: `npx brumate skill` installs the skill, and its code blocks compile in a test.
- ui-0.1: `pnpm --filter website check:samples && pnpm --filter website build` passes, with every page of /ui complete.
- smaller-client: `pnpm bench` shows the gzip JS before `load` for todos below the baseline.

## Priorities

- must: core correctness (the scope ID table, tests against the current compiler, the client.ts split, ordered updates, batching, fields typed early) and the .brm skill. Needed soon.
- should: what makes them useful, the ui release, and the website fixes. They can wait.
- could: the takeaways of lower value, and the spikes.
- later: the outline nodes of the backlog. Parked, never scheduled.

## Milestones

- core-correct, agent-skill: the must work.
- ui-0.1: @brumate/ui ready to publish.
- smaller-client: step 3 of the smaller client, and the spikes for step 4 and inlining.
- features: `$searchParam`.
- backlog: outlines, refined when a milestone takes them.

## Constraints

- Size comes first. Every core change reports the gzip size of todos (`pnpm bench`), within 0.3 kB.
- Breaking changes are fine, with no deprecation periods.
- client.ts is split (split-client-runtime) before the nodes that rewrite it. website/src/ui.ts is an append-only list of one line for each page, so it is shared, not split.
- batching (the `flush()` audit) and element-checks (the caller fixes of the stricter check) sweep many parts of @brumate/ui. plan.py warns that a part is edited by four nodes or more. The edges order them: element-checks runs after the parts are rewritten.
- Writing follows the plain-writing skill.

## Non-goals

- Moving packages/ui to its own repository.

## Verification

- Fast check (safe in parallel worktrees): `pnpm lint && pnpm format:check && pnpm typecheck`, then the tests of the node.
- Full check (after merging): `pnpm build && pnpm test && node e2e/run.mjs`, about 10 minutes, with Chrome. `pnpm bench` runs one at a time (exclusive: bench).

## Numbered resources

- Compile error codes (BRMnnn), assigned once in brumate-check.

## Sources

- [Proposals](../../proposals.md), and the review of the parts against Terracotta and Headless UI on 2026-10-26.

## Coverage

Each item of the proposals maps to one node, or to built work:

- Syntax: named view transitions -> view-transitions; long lists -> built (`parseWindow`); streaming lists -> streaming-lists; styles in blocks -> block-styles; external scripts -> external-scripts; reveal order of `#defer` -> defer-reveal; server components -> server-components-spike, server-components
- Reactivity: ordered updates -> ordered-updates; batching -> batching; one table of the fields with scope IDs -> scope-id-table; fields typed before the code loads -> fields-typed-early
- Data: worker functions -> worker-functions; offline pages -> offline-pages; observability -> observability
- Routing: state in the URL -> search-params
- Server: idempotent calls -> built for forms, keys -> call-keys; two-way realtime -> realtime
- Tooling: content mappers -> content-mapper (#3); tests against the current build -> tests-current-build; what ships in the editor -> editor-sizes; devtools -> built except history -> devtools-history; workbench -> built steps 1 to 3, step 4 -> workbench-stories; accessibility checks in tests -> a11y-in-tests; embedding -> embedding
- Agent support: the skill -> brm-skill; llms.txt -> llms-txt; copy in the devtools -> devtools-copy; brumate check -> brumate-check; the tasks -> skill-tasks; an MCP server -> mcp-server
- Compiler: steps 1 and 2 -> built (#147, 4d1d0f14, 624e210b); step 3 -> partly built, the rest -> drop-marker-index; step 4 -> values-spike, values-build; fixed walks -> fixed-walks; inlining and constant folding (2026-10-26) -> inlining-spike, inlining-build
- Library: Headless UI phases 0 to 7, components from packages, nested TransitionChild -> built; leave animations for `#for` -> for-leave; takeaway 1 -> docs-generator and the four docs-* nodes; 2 -> popover-sizing; 3 -> fieldset; 4 -> context-menu; 5 -> color-scheme; 6 and 9 -> popover-group-alert; 7 and 8 -> part-guides; 10 -> feed; internationalization -> i18n; images -> images; Markdown with components -> markdown-plugin
- Types (2026-10-26): brumate has no element, markup or component type -> element-types, element-checks; as.ts is unsound and opaque -> as-sound; the parts fall back to `any` for values -> ui-generics
- Polymorphism and ref (2026-10-26): props types -> props-types-main (#245); `as` on more parts -> as-controls, as-collections; ref forwarding -> built (#243), its visible gap -> visible-forwarded-ref
- Website: the home link, the shop demo, highlighting, the error section -> website-fixes; the docs of @brumate/ui -> docs-*; a guide to props types -> props-types-main; the code examples -> code-examples; a landing page -> ui-landing; `$client` in markup that the browser renders -> client-markup-docs

## Open questions

- Are the must line and the milestones right?
- Gate: split-ui-examples (the ui example page and its e2e suite by part). Approve or decline it.
- Should the Order section of the proposals become a link to this roadmap?

## Gates

- split-client-runtime: the layout change was approved by the user on 2026-10-26. The gate stays for a review of the split before the nodes that build on it start.
- split-ui-examples: the user approves the layout change.
- props-table, once docs-generator freezes it: the user reviews the page format before the docs nodes start.
- values-spike and inlining-spike: the user decides go or no-go.
