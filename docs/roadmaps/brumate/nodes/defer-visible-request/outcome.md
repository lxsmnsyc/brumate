# Outcome: defer-visible-request

## Built

- A diagnosis and a reproduction in `nodes/defer-visible-request/repro/`. No code changed.

## Diagnosis

### Symptom

- Reported: on tracker over Nitro, a page with `#defer ('visible')` showed its body in Playwright with no `x-brumate-defer` request and no `defer-*.js` chunk. curl with a valid session cookie got only the fallback.
- Seen at: ec91f0da (release/0.10 with feat/client-scripts), production Nitro build of `examples/tracker`, Playwright Chromium 156 headless.

### Loop

- Command: `node repro/probe.mjs direct headless`, after copying `repro/later.brm` to `examples/tracker/src/routes/` and building the tracker.
- loop.py: tight, 5/5 red. The same command with `chrome` (the agent without `Headless`) is green 5/5.
- Minimal reproduction: a page with one `#defer` block, opened by a browser whose `User-Agent` contains `HeadlessChrome`. The trigger, the session and Nitro do not matter: a plain `fetch` with that agent also gets the body inline.

### Hypotheses

| #   | Hypothesis                                                              | Prediction                                                                       | Probe                                                  | Result                                                 |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| 1   | The server treats Playwright as a crawler and renders the body in place | Replacing `HeadlessChrome` in the agent brings back the fallback and the request | `probe.mjs direct chrome`, and `fetch` with each agent | confirmed                                              |
| 2   | A client navigation carries the body in its page payload                | A direct `goto` sends the request                                                | `probe.mjs direct headless`                            | ruled out: no request on a direct load either          |
| 3   | Nitro or the story's server entry changes the render                    | The flag lives in the host                                                       | read `render`; same `BOTS` on `main` (server.ts:3330)  | ruled out: the choice is in `render`, for every host   |
| 4   | The request log misses the fetch                                        | The same listener stays empty with a real agent                                  | `probe.mjs direct chrome`                              | ruled out: it logs `GET /later x-brumate-defer: 1 1:0` |
| 5   | A shell page fills the body in its own response                         | `/about` sends no request under any agent                                        | `fillHoles` in server.ts:4747; `shell-sheet.mjs`       | confirmed, by design; see finding C                    |

### Cause

- Flaw: test setup. `BOTS` in `packages/brumate/src/runtime/server.ts:3586-3587` contains `headlesschrome`, and `rendersInOrder` (server.ts:3590-3604, called at server.ts:3189) uses it when `inOrder` is `'bots'`, the default. Playwright's headless Chromium sends `HeadlessChrome/156...`, so every e2e page renders its `#loading` and `#defer` bodies in place. The pattern dates from 5c1f02c8. Chrome launches at `e2e/run.mjs:116` with no user agent override.
- Why it gives this symptom: a page rendered in order has the body and no `<template b-defer>`, so the loader never imports `defer.ts` or sends a request. curl's agent is not in `BOTS`, so it gets the fallback.
- Same flaw elsewhere: every e2e suite whose server keeps `inOrder: 'bots'` tests in-order rendering, not streaming and not `#defer` requests. The tracker steps "/about" and "/team" pass for that reason. The "#defer body waits for its stylesheet" step needs the request, so it failed under the headless agent.
- Confirmed by: the `chrome` agent turns the loop green, and the `headless` agent turns it red again.

### Two bugs found with the real agent

These are real bugs, not test setup. Both break "A `#defer` body waits for its stylesheets before it shows" (`website/docs/styles.md:220`).

- B. A block `<style>` of a `#defer` body is lost after a client navigation. `pruneSheets` (`packages/brumate/src/runtime/navigate.ts:247-255`, called from `replaceRoutes` at navigate.ts:328, since c401cfb7) removes each link whose scopes no element uses. The block's rules use the block scope `b-c-<hash>-<n>`, which only the body has, and the page shows the fallback at that time. So the route's CSS link goes, and the defer answer does not link it again, because it is the route's own file. Repro: `node repro/probe.mjs link chrome`, tight 5/5 with the message "body shown without its stylesheet". Keeping only that removal (a probe that skips `remove()` for that link) makes the body red, as styled. A styled component in the body works (`PROBE_PATH=/later2`): the answer carries its `<style b-style>`.
- C. A `#defer` body that a shell fills does not wait for its stylesheet. On a prerendered shell (tracker's `/about`), `fillHoles` (server.ts:4747) streams each `load` or `idle` body in the same response. The `$bS` swap (server.ts:3399) moves the template in at once, while `loadDeferred` waits through `preloadSheets` (`defer.ts:66`). A body component whose CSS is a file links it in the body markup (server.ts:1431-1443), so that body shows unstyled until the sheet loads. Repro: `node repro/shell-sheet.mjs chrome` (the dropped e2e step on the shell path): the body shows with its link not loaded (`pending: 1`), with either agent.

### Evidence

- Failing tests: `repro/probe.mjs direct headless` (setup), `repro/probe.mjs link chrome` (B), `repro/shell-sheet.mjs chrome` (C), all red on ec91f0da.
- Seam: e2e. `e2e/suites/tracker.mjs` with a non-headless agent for A and B, and the restored stylesheet step on `/about` for C. A unit seam for B is `navigate.ts` under happy-dom with a pending `template[b-defer]`. happy-dom does not load sheets, so the e2e step is the proof.

### Fix options

| Option                  | Change                                                                                                                                                                                                                                                   | Reach                                                    | Cost                                                                                           | Undo                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| A1 (recommended, setup) | `e2e/run.mjs` gives every context the browser's agent without `Headless`, and one tracker step checks that a crawler agent still gets the body in place                                                                                                  | all e2e suites                                           | none at run time. Steps that relied on in-order rendering may start to fail and show real bugs | reverts alone                                |
| A2                      | Drop `headlesschrome` from `BOTS`                                                                                                                                                                                                                        | every user's headless prerender tools and link previews  | public behaviour                                                                               | reverts alone, but changes what crawlers get |
| B1 (recommended)        | In a `#defer` target answer, the server links the CSS file that holds a block style used by the body, as it does for component files ("its links go in its markup, whether or not the page has them", server.ts:1431). `preloadSheets` then waits for it | server stylesheet output for block styles in a target    | one `<link>` per answer, cached URL                                                            | reverts alone                                |
| B2                      | `pruneSheets` skips pruning while the page has a `template[b-defer]` that has not loaded                                                                                                                                                                 | navigate.ts only                                         | keeps unused CSS until the next navigation                                                     | reverts alone, coarse                        |
| C1 (recommended)        | `$bS` moves the links of the template to the head and swaps after each loads or fails, capped at the navigation wait (4 s)                                                                                                                               | the inline swap of `#loading` and filled `#defer` bodies | a few bytes in the swap script, once per page; not measured                                    | reverts alone                                |
| C2                      | `fillHoles` marks its bodies so the loader swaps them through `preloadSheets`                                                                                                                                                                            | fillHoles and defer.ts                                   | loader must be ready before the stream; more moving parts                                      | reverts alone                                |

- Not recommended: a sleep or `waitForTimeout` in the e2e step, or forcing `inOrder: false` in the tracker only. Both hide the setup gap for the other suites.

### Verdict

- verdict: not-a-bug for the reported symptom (test setup), plus fix-large for B and C.
- cause: `packages/brumate/src/runtime/server.ts:3586` (`BOTS` matches `HeadlessChrome`), since 5c1f02c8. B: `packages/brumate/src/runtime/navigate.ts:247`, since c401cfb7. C: `packages/brumate/src/runtime/server.ts:3399` with `fillHoles` at 4747.
- reproduction: `nodes/defer-visible-request/repro/` (`later.brm`, `later2.brm`, `LaterBox.brm`, `probe.mjs`, `shell-sheet.mjs`, `doc.mjs`).
- Next: one fix node, "Fix: #defer bodies keep their stylesheets in e2e and after navigation", size M. It owns `e2e/run.mjs`, `e2e/suites/tracker.mjs`, `packages/brumate/src/runtime/navigate.ts` or the stylesheet output in `server.ts`, the swap script in `server.ts`, and their tests. It sets the agent (A1), fixes B (B1) and C (C1), and restores the step "#defer body waits for its stylesheet". The e2e agent change could go first as an S node, because it can surface other failures across suites.

## Deviations

- The brief says to check the page on `main` with the old Node server. Not run: the cause sits in `render` and is the same on `main` (`main:packages/brumate/src/runtime/server.ts:3330`), so no host changes it.
- The brief's page reads `{user.name}`. The tracker's user is a string, so the repro reads `{user}`.

## Stubs left

- None.

## Gotchas

- Any Playwright test of streaming or `#defer` against a server with the default `inOrder` gets the in-order render. Check the agent first.
- On a shell page, `load` and `idle` bodies never send a request. Only `visible` and other triggers do. The old e2e step that intercepted the request cannot pass there.

## Proposed learnings

- An e2e harness sets a user agent without `Headless` | brumate renders in order for `HeadlessChrome`, which hides streaming and `#defer` | e2e | yes, one step can assert a `#defer` request
- A stylesheet whose rules use only block scopes counts as used while a body that can hold them is pending | pruning removes CSS that a later body needs | packages/brumate/src/runtime | yes, e2e

## Verification

- `python3 .../root-cause/scripts/loop.py --runs 5 --symptom 'SYMPTOM: body shown without' -- node probe.mjs direct headless`: tight, 5/5 red. Same with `chrome`: green, 5/5.
- `loop.py --runs 5 --symptom 'SYMPTOM: body shown without its stylesheet' -- node probe.mjs link chrome`: tight, 5/5 red.
- `node shell-sheet.mjs chrome` and `headless`: both red (`pending: 1`).
- Probe files in `examples/tracker` removed. `git status` shows only this node's folder.

## Size

- Estimated S, actual S. The two extra bugs took most of the time.
- Risk estimated low, measured low for this node. The fix node is medium: the e2e agent change touches every suite.
