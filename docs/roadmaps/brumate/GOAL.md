---
milestones: ["0.4.0", "0.5.0", "0.6.0", backlog]
# S, docs and chore nodes self-review; the rest, and gates, contracts, releases and hotfixes, get a fresh
# reviewer (the maintainer, 2026-10-30; this is what ran since 2026-10-27, when an inline comment hid `fresh`).
review: auto
merge:
  # The user chose auto-merge on 2026-10-26. The orchestrator merges the pull requests that pass
  # plan.py can-merge, and the rest wait for the user.
  mode: auto
  method: merge
  max_size: M
  exclude: [release, hotfix, contract, gate, story]
  # Children of a story merge into its branch feat/<story id> under auto; the story PR goes to the user.
  stories: auto
branches:
  # After the 0.4.0 release (node next-branch): minor work targets `next`, hotfixes target `main`,
  # and `next` is synced with `main` after every release from `main`. Empty until then.
---

# brumate

## Outcome

The core is correct and safe to change, agents write good .brm files with a skill, @brumate/ui is ready to publish, and the client keeps shrinking. Far-off proposals stay in the graph as outlines until a milestone reaches them.

## Acceptance

- 0.4.0: brumate 0.4.0 and @brumate/ui 0.1.0 are published, after `pnpm build && pnpm test && node e2e/run.mjs` passes and `pnpm --filter website check:samples && pnpm --filter website build` passes with every page of /ui complete.
- `npx brumate skill` installs the skill, and its code blocks compile in a test (done in 0.4.0).
- `pnpm bench` shows the gzip JS before `load` for todos below the baseline (0.5.0 and later).

## Priorities

- must: core correctness (the scope ID table, tests against the current compiler, the client.ts split, ordered updates, batching, fields typed early) and the .brm skill. Needed soon.
- should: what makes them useful, the ui release, and the website fixes. They can wait.
- could: the takeaways of lower value, and the spikes.
- later: the outline nodes of the backlog. Parked, never scheduled.

## Milestones

Milestones are releases (the maintainer, 2026-10-29).

- 0.4.0: brumate 0.4.0 and @brumate/ui 0.1.0. The cut is the `depends_on` list of release-0.4. changeset-review waits for every open node of the cut, and release-0.4 waits for changeset-review. Every node done before 2026-10-29 ships here.
- 0.5.0: the open should nodes: core fixes left out of the cut, the type audit, the agent tools, the smaller client, `$searchParam` and `<style global>`, and the next branch.
- 0.6.0: the could nodes, the new ui parts and the spikes.
- backlog: outlines, refined when a release takes them. Large features are outline stories (`type: story`); refining one means writing its children, which merge into `feat/<story id>`, and the story is one PR to its target.

## Constraints

- Size comes first. Every core change reports the gzip size of todos (`pnpm bench`), within 0.3 kB.
- Breaking changes are fine, with no deprecation periods.
- client.ts is split (split-client-runtime) before the nodes that rewrite it. website/src/ui.ts is an append-only list of one line for each page, so it is shared, not split.
- batching (the `flush()` audit) and element-checks (the caller fixes of the stricter check) sweep many parts of @brumate/ui. plan.py warns that a part is edited by four nodes or more. The edges order them: element-checks runs after the parts are rewritten.
- Writing follows the plain-writing skill.

## Non-goals

- Moving packages/ui to its own repository.

## Verification

- Reviews: every pull request that changes code gets one fresh reviewer (the pr-review skill), whatever its size. Docs, chore and test-only nodes may be reviewed by a fresh agent that the worker spawns itself; a reply without a review verdict counts as unreviewed. At most 3 workers run at once (`plan.py ready --max-parallel 3`), since more make the ui suite flaky under load.

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
- Client size (2026-10-30, after perf-pass-0.4): prune the runtime by use -> usage-pruning-spike; fewer files and no preload helper -> loader-preload-spike; reactive graph at compile time -> compiled-graph
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
- usage-pruning-spike and loader-preload-spike: the user decides go or no-go. compiled-graph needs a goal debate before its refine.
