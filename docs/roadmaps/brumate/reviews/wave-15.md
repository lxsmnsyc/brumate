# Checkpoint 2026-10-30, wave 15

## Merged

- #361 overlay-focus-fixes, #352 streamed-memo-reads (wave 14 leftovers).
- #362 ui-docs-pages-utilities, #363 indicator-timing-function, #364 transition-sibling-text (the bug was invalid HTML: a `<div>` in a `<p>`; the error now names it), #365 i18n-locale-change (only NumberField and ColorField needed it).
- #366 check-package-imports, #367 late-state-record, #368 parser-closed-nesting (BRM185: compile error plus a dev-only server check for `<p>`), #369 utility-demo-workarounds, #370 runtime-event-cancel (`cancelWhen` in brumate/events), #371 color-area-page-keys (stale e2e steps, not a code bug).
- #372 bind-read-your-writes, #373 promise-prop-memo (promise props are plain promises; BRM186 dropped), #374 try-sample-console (live samples render with `dev: true`), #375 html-attributes-navigation (`b-html` lists the server's `<html>` attributes), #377 code-examples, #378 ui-skill.
- Not roadmap nodes: 1a4b5bc3 (CI: a late draft run no longer cancels the ready run; the draft flag is in the concurrency group).

## Open

- #376 streamed-loading-errors: fresh review done, fixes in, ready, CI passes. For the maintainer to merge.
- #379 memo-prop-browser-child: fresh review done, fixes in, ready. CI fails on `ReferenceError: sameKeys is not defined` (21 times, ui tests). The tests pass locally on main and on the merged tree, so stale generated output may hide it locally. Needs shared-part-imports first, then a rebase and a CI rerun; if it still fails, #379's graph change is the trigger.
- shared-part-imports (must, a main bug, no PR yet when this was written): the compiler's `shared` client part does not import the names its functions use (ToggleButtonGroup's `toggle` calls `sameKeys`; #372 added the call). Worker told to reproduce from a clean output folder.

## Decisions (the maintainer)

- Block in `<p>`: compile error BRM185 plus a dev server check; production pays nothing; the server check stays `<p>`-only.
- Event cancel: keep capture-phase delegation (Marko 5 and 6 do the same; Solid bubbles); public `cancelWhen(element, 'click' | 'submit', check)`; plain listeners are not stopped. The name `guard` is reserved for the `$guard` proposal.
- Promise props: a plain value, no compile rule (supersedes Q6 of the pending-handler-reads debate; recorded in docs/decisions.md by #373).
- TextField and SearchField keep typed text after a refused edit in 0.4.0 (text-field-refused-edit, 0.5.0).
- HTML navigation stays; no component-based client router. First step if speed matters: partial-route-responses (0.5.0).
- Streamed errors: the server renders the nearest `#catch` and streams it; a stream cut after a client navigation fires `brumate:error` and keeps the fallback (the client walk was dropped for size).
- `#loading` fallbacks in browser-rendered markup: 0.5.0 (browser-loading-fallback); until then a pending value is empty text.
- `.worktreeinclude`: not used. The repo has no local secrets, and copying build or test output brings back stale state; it does not apply to plain `git worktree add` worktrees.

## Added nodes

- 0.4.0: parser-closed-nesting, utility-demo-workarounds, color-area-page-keys, html-attributes-navigation, memo-prop-browser-child, streamed-loading-errors, shared-part-imports, perf-pass-0.4 (gated, before changeset-review).
- 0.5.0 outlines: partial-route-responses, head-rerun-scripts, text-field-refused-edit, promise-in-markup (behavior settled in its brief: text and attributes make the nearest `#loading` pending; no boundary means the server waits; compile + dev error where a promise cannot wait; resume uses the streamed value), browser-loading-fallback, skill-command-packages, skill-blocks-typecheck.
- 0.6.0 outline: store-contract (`$store` with subscribe/get/set; design basis silmaril). store-lens-spike was retitled: its path-tracked store needs a new name, picked by a goal debate.

## Process notes

- GOAL.md says one fresh reviewer for every code PR. Until midway through this wave the orchestrator followed plan.py's per-node `self` mode instead, so #363 to #367, #369 and #371 had only the worker's own review. The maintainer was told; fresh reviews after the fact were offered, not run.
- Stale `dist` and `test/.output` in worktrees gave false results twice (a stale brumate dist showed hint strings in a production build; #379's CI failure does not reproduce locally). Rebuild before measuring, and clear generated output when CI and local disagree.
- CI tests a PR merged with main at trigger time; two PRs that both pass can still fail together (#375 met a new runtime-helpers test). Merge one, then rerun the other's CI when they touch the same files.
- Agents must never use `pkill` or kill processes they did not start (one killed others' e2e runs).

## Flakes seen

- website e2e overlays "Escape left the tooltip" (still flaky on a loaded machine).
- brumate resume/devtools and @brumate/ui tests time out under load; they pass alone or with `--maxWorkers 2 --testTimeout 30000`.

## Worktrees left

- .claude/worktrees/streamed-loading-errors (#376), memo-prop-browser-child (#379), shared-part-imports. Remove each after its PR merges.

## Resume

1. Check shared-part-imports: if its worker opened a PR, run a fresh review, mark it ready, CI, hand to the maintainer. If not, read nodes/shared-part-imports/log.md and continue on its worktree.
2. After shared-part-imports merges: rebase #379 onto main, rerun its CI; if it still fails on `sameKeys`, investigate #379's graph.ts change.
3. Mark streamed-loading-errors, memo-prop-browser-child and shared-part-imports done as they merge; clean their worktrees and branches.
4. Then perf-pass-0.4 (gated; run benchmarks one at a time on a quiet machine), then changeset-review, then release-0.4 (the maintainer merges #98).
