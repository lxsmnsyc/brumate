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

## After the restart of 2026-10-30

- Merged: #379 (memo-prop-browser-child done), #381 (perf-pass-0.4 done; no option built for 0.4.0, follow-ups usage-pruning-spike, loader-preload-spike, direct-update-calls), #382 to #386 (ts-style across the repo, helper renames, a 30 s limit for the ui client-part-imports test), #388 (docs/architecture.md, the contributor guide).
- Open: #387 (root typecheck with `--no-sort`: CI step 53 s to 28 s on Node 24), #389 (stale notes in decisions.md, the roadmap README, example client entries, README, highlight.ts), and chore/ui-part-sizes (pushed WIP, no PR; based on 21571276, needs a rebase and one commit).
- The maintainer: `.ts` on relative import paths is a personal dislike, removal skipped for now. Exported `<noun>Of` helpers that only the compiler or the parts call are not public API.
- Left for changeset-review: `.changeset/config.json` ignores only `example-todos` and `example-ui-kit` of the private examples; `examples/ui`, `language-core` and `typescript-plugin` have no tests of their own.

## Worktrees left

- .claude/worktrees/typecheck-no-sort (#387), .claude/worktrees/stale-notes (#389), .claude/worktrees/ui-part-sizes (draft). Remove each after its PR merges.

## Resume

1. Check #387 and #389; remove merged worktrees and branches.
   ui-part-sizes: bundled and minified, #384 grew the ui client chunks by +1,004 B gzip of 303,900 B (0.3%); the WIP is at -215 B but reverts 40 files (+285/-926 against main) and lacks the size comments and checks. Worst per component on main: GridList +280, Tree +242, Table +219, ListBox +163 B. Ask the maintainer: finish it (comments, checks, draft PR) or drop it. Scripts: the old session scratchpad ps/ (bundle.mjs, percomp.sh, revert2.mjs).
2. changeset-review (read its brief), then release-0.4 (the maintainer merges #98).
