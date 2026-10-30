# Checkpoint 2026-10-30, wave 15

## Merged

- #361 overlay-focus-fixes, #352 streamed-memo-reads (wave 14 leftovers).
- #362 ui-docs-pages-utilities, #363 indicator-timing-function, #364 transition-sibling-text (the bug was invalid HTML: a `<div>` in a `<p>`; the error now names it), #365 i18n-locale-change (only NumberField and ColorField needed it).
- #366 check-package-imports, #367 late-state-record, #368 parser-closed-nesting (BRM185: compile error plus a dev-only server check for `<p>`), #369 utility-demo-workarounds, #370 runtime-event-cancel (`cancelWhen` in brumate/events), #371 color-area-page-keys (stale e2e steps, not a code bug).
- #372 bind-read-your-writes, #373 promise-prop-memo (promise props are plain promises; BRM186 dropped), #374 try-sample-console (live samples render with `dev: true`), #375 html-attributes-navigation (`b-html` lists the server's `<html>` attributes), #377 code-examples, #378 ui-skill.
- Not roadmap nodes: 1a4b5bc3 (CI: a late draft run no longer cancels the ready run; the draft flag is in the concurrency group).

## Open

- #376 streamed-loading-errors and #380 shared-part-imports merged after this checkpoint was first written (both marked done). #380 also found the update part missing components passed in a template prop (8 fixtures), and added a guard test that parses every ui client part with oxc-parser.
- #379 memo-prop-browser-child: rebased onto main after #380; the `sameKeys` failures are gone, but 2 tests from #376 failed on the combination (`resume > an error inside a streamed #loading body > renders the #catch inside / around (dev false)`), while main passes them. Its worker was fixing that on the branch, then pushing for CI. The maintainer merges it, then restarts the session.
- lxsmnsyc/agent-skills#1: plan.py strips inline `# comments` in frontmatter and warns on unknown `review:`/`run:` values. Ready for the maintainer. That checkout's local main is 2 commits ahead of origin (not pushed), and its `.worktrees/fix-plan-inline-comments` can go after the merge.

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

- Review mode: GOAL.md said `review: fresh  # ...`, but plan.py does not strip inline comments, read an unknown value and fell back to `auto`. So S, docs and chore nodes self-reviewed (#363 to #367, #369, #371), which is the skills' intended `auto` behavior. The maintainer chose `review: auto` on 2026-10-30; the parser bug gets a fix in the agent-skills repo.
- Stale `dist` and `test/.output` in worktrees gave false results twice (a stale brumate dist showed hint strings in a production build; #379's CI failure does not reproduce locally). Rebuild before measuring, and clear generated output when CI and local disagree.
- CI tests a PR merged with main at trigger time; two PRs that both pass can still fail together (#375 met a new runtime-helpers test). Merge one, then rerun the other's CI when they touch the same files.
- Review mode is `auto` (GOAL.md, 2026-10-30): S, docs and chore nodes self-review, the rest get a fresh reviewer.
- Agents must never use `pkill` or kill processes they did not start (one killed others' e2e runs).

## Flakes seen

- website e2e overlays "Escape left the tooltip" (still flaky on a loaded machine).
- brumate resume/devtools and @brumate/ui tests time out under load; they pass alone or with `--maxWorkers 2 --testTimeout 30000`.

## Worktrees left

- .claude/worktrees/memo-prop-browser-child (#379). Remove after it merges.

## Resume

1. If #379 merged: mark memo-prop-browser-child done, remove its worktree and branch. If not: read its PR state and nodes/memo-prop-browser-child/log.md, finish the fix for the two #376 tests, push, CI, hand to the maintainer.
2. Start perf-pass-0.4 (gated; read its brief; run benchmarks one at a time on a quiet machine; add benchmarks/brumate-0.3 with brumate@0.3.0 from npm; compare with Marko 6). The maintainer picks which options to build.
3. Then changeset-review, then release-0.4 (the maintainer merges #98).
