---
goal: Restructure and simplify the brumate client runtime and its browser render path, so fixes stop adding special cases, while the client keeps shrinking; weighed together with direct-update-calls and values-spike/values-build
date: 2026-11-02
rounds: 3 of 3
status: approved
roadmap: docs/roadmaps/brumate
supersedes: none
decision: docs/decisions.md (the client restructure entry, 2026-11-02)
---

# Debate: restructure and simplify the client

Options weighed: one write path for the first render and updates as its own L node (P1, P3), a values spike first that answers both (O4, P10), removing the special cases one at a time (O5), a differential test of both render paths (P6), and keeping both paths (P8).

## Settled structure

The browser render and later updates should share one write path. Each value that changes gets one function: a browser render calls it directly, a later write queues it (P10, following Marko 6, O2). Whether that pays is decided by a spike with fixed gates, not by building it first (O4, O3). In order:

0. **Before 0.5.0, in the sync of `main` (0.4.2) into `feat/browser-async`: one settled-memo mechanism** (O12, amended by O16). #419's `fillSettled`/`settledMemos`, with #421's extension to block headers, props and function reads (O17), is rewritten onto `waits.ts` (`settledSlots`, `fillRange`) from browser-await, or the reverse, with the #419 and #421 tests as proof. About 0.3-0.5M tokens. Until values-build lands, the browser-async children keep pending and fallback state in scope slots, not in new inline writes or hold-back helpers (P14).
1. **After the 0.5.0 must line, on one worker: drop-unread-memos** (O5, narrowed by O14). The browser follows the server: a memo that nothing reads does not run (Q2). Removes `unreadMemo` and `watchUnreadMemos` (#415, #417). About 0.3M.
2. **no-html-string-fallback**, a small node of its own: no body that the browser renders falls back to an HTML string (Q4, O13). About 0.2M.
3. **The differential test** (P6, sized by O6): renders the test pages both ways, server render plus resume against a browser render, and compares DOM, slot values and where errors go. Each divergence is a special case or an accepted difference. Size M, about 0.4M.
4. **values-spike, re-aimed** (O4, P10), with these gates, measured on `next` after step 0 (P17 a-c, O15):
   - net todos JS gzip before `load`, app modules included, at least 1.0 kB below `next`, from a bench run with nothing else running;
   - brumate's own script time from `profile-rows.mjs` at most 1.2x `next` for rows create and replace, back to back, and the click within 10% (O8);
   - the 9 diamond fixtures from ordered-updates/outcome.md pass through a minimal codegen path (O9);
   - a result under 1.0 kB but no larger than `next` is a go only if it lowers the step 3 divergence count and the count of browser-only runtime exports, from a baseline commit fixed after step 0 (O15, Q3).
     About 0.6M, a three-day box.
5. **On a go, values-build** (P5, P11): the two-mode value functions replace `g`, `pass`/`queueWrite`/`drain` and the settled-memo mechanism. Its acceptance includes the full ordered-updates set (107 cases, O9). About 1.5-2M. **On a no-go**, both render paths stay (P8), and steps 1-3 remain the guard.

About 1.8-2.0M tokens before the go decision (O16).

## Budget

- device: one worker at a time for these nodes; the bench runs alone (J1, J10).
- time: no date for 0.5.0 (Q3). Only step 0 runs before 0.5.0; steps 1-5 follow its must line.
- tokens: about 1.8-2.0M up to the go decision, values-build 1.5-2M more on a go (O16, J7).
- size: the spike's go needs net todos gzip -1.0 kB against `next` (13.5 kB, J6); every node reports todos within 0.3 kB.
- maintenance: at equal size, simpler wins (Q3). Simpler is counted by the step 3 divergence count and browser-only runtime exports, not by `options.mode` branches (O15).

## Rejected

- One write path as its own L node before the values work (P1, P3): the values work replaces the same queue, so most of it is thrown away, and it lengthens the 0.5.0 must line on one worker (O3, O2).
- Deleting the code-loading waits as step 0 (P2): already shipped on `next` by #407 (O1, judge measured).
- drop-marker-index in 0.5.0 (P4): it saves almost nothing on todos (its own audit); the user moved it later (Q4, O7).
- The first spike gates (P12, P17): a 5% timing gate is under the noise, the ordered-updates set cannot run on a prototype, and branch and line counts can be met without the change (O8, O9, O10, O15).
- The HTML-string rule inside values-build (P13): on a no-go no node would carry it (O13).

## Scope changes

- merge direct-update-calls into values-spike and values-build: both compile the update table into direct calls (P7).
- park drop-marker-index off the 0.5.0 must line; its HTML-string rule becomes the node no-html-string-fallback (O7, O13, Q4).
- move drop-unread-memos from 0.6.0 to right after the 0.5.0 must line (O5, Q2).
- add nodes: settled-memo merge (step 0, in the 0.4.2 sync), no-html-string-fallback, the differential test; re-aim values-spike and values-build.

## Proofs

- none.

## Prior art

- Marko 6.4.6 dist: a browser-rendered branch queues its setup on the render queue, and value functions run directly while rendering and queue only for later writes (P1, O2; evidence/marko-one-write-path.txt).
- Marko's runtime-tags fixtures: 1543 fixtures run as browser render and as server render plus resume, with per-fixture snapshots and about 75 opt-outs (O6, checked on GitHub).
- perf-pass-0.4 on this machine: timing gaps under about 10% are noise (O8).

## Open risks

- The spike misses its gates (O4, P8): accepted. Both render paths stay and steps 1-3 keep the special cases in check.
- The differential test finds divergences that are accepted behavior, not special cases (O6): accepted. Each one is recorded as accepted or as a case to remove.
- Step 0 grows while 0.4.2 is open (O17): already happened with #421; covered by O16's estimate.

## Answers from the user

- Q2, should a browser render follow the server exactly: yes. A memo nothing reads does not run in the browser either.
- Q3, a date or budget for 0.5.0, and size against simplicity: no fixed date or budget; the restructure may go after 0.5.0. At equal size, simpler wins.
- Q4, must the marker index go in 0.5.0: no. Move drop-marker-index later and keep only the rule that no browser-rendered body falls back to an HTML string.
- Q1 was not asked: moot after P3 was rejected.

## Overruled

- none

## Cost of this debate

- 3 rounds, about 220k tokens of a 300k budget.
