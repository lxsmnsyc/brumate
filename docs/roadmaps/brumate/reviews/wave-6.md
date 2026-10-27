# Checkpoint 2026-10-27, waves 6 and 7

## Merged

- rest-ref-spread (#290): a `ref` left in the rest props reaches the element that spreads them. Eager core +81 B after a trim from the review.
- memo-errors-server (#291): a memo declared outside its `#try` renders the `#catch` on the server; the memo is held and read in place. Todos -5 B.
- batching (#292): a handler is one pass up to its first `await`; `flush()` from brumate/signals; the update-pass contract is frozen at v1 (`onPassEnd` reserved for search-params). Todos +274 B.
- dynamic-tag-rest-ref (#295): the same for `<{as} {...rest}>`. 22 of 52 ui parts with a dynamic tag leave `ref` in their rest. +7 B.
- style-vars-target (#296): a live style variable wins over a stale server `style` when the target's rest is live. -12 B.
- size-trim (#297): -57 B against main; handler-merge-trim folded in (no safe cut). Todos is 14,768 B gzip before `load` against 14,227 B at the baseline.
- Not roadmap nodes: #293 (vite.ts reads components 32 at a time; EMFILE on Node 22 CI) and #294 (the vite tests build their own small app, 5.6 s to 1.9 s).

## Decisions (the maintainer)

- The remaining size over the baseline is accepted as size-trim's outcome accounts for it: `readFields` about 256 B, `settle` about 50 B, the rest under 30 B each.
- Browser memos stay eager. Marko 6 also pushes eagerly and prunes unread pure values at compile time; that is the node drop-unread-memos.
- Props of `$props()` are destructured, spread in markup, or read by key. Any other use of the whole object is a compile error (rest-ref-local-error). No merge or split utilities; a spread in `$memo` is banned too.
- `$gate(value, (prev, next) => boolean)` is the memo with a guard; `$memo` keeps one argument (memo-guard).
- A held memo error that the server writes into the page is its own node (memo-error-resume); #291 merged without it.

## Added nodes

- must: dynamic-tag-rest-ref (done).
- should: setter-ref-forward, rest-ref-local-error, memo-error-resume, handler-code-wait, runtime-brand-checks.
- could: drop-unread-memos (outline), memo-guard, store-lens-spike (gated; re-evaluates "no `$store`").

## Notes

- Every code PR needed a second round. Real bugs found by review: a stale DOM after a handler throws (#292), a memo error sent to the browser as `undefined` (#291), a read slowdown in `settle` (#297).
- Worktrees under `.git/` make vitest skip files; worktrees now live in `.claude/worktrees/`. A fresh worktree needs `npx tsdown` before the vite tests. `pnpm` refuses a linked node_modules, so agents run the tools with `npx`; e2e cannot run in a worktree.
- The git stash list is shared by all worktrees; one worker popped another's stash. Agents no longer use `git stash`.
- A reviewer left test copies in a shared base worktree; give each reviewer its own base.

## Next

- `plan.py ready`: setter-ref-forward, rest-ref-local-error, memo-error-resume, handler-code-wait, runtime-brand-checks (core-correct, should), then the ui-0.1 nodes.
