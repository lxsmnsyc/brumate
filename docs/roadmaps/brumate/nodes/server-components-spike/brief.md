---
id: server-components-spike
title: "Spike: server components"
status: todo
priority: must
type: experiment
story:
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: M
spike: true
hypothesis: docs/roadmaps/brumate/nodes/server-components-spike/brief.md (Gates)
verify:
exclusive: [bench]
fulfilled_by:
gate: true
added: 2026-11-12
spent:
owns:
  - docs/roadmaps/brumate/nodes/server-components-spike/**
  - packages/brumate/test/spike-server-components/**
shared: []
reserves: []
provides: []
depends_on: []
---

> 2026-11-18: made a must of 0.9.0 by the maintainer, after mcp-server was deferred (docs/debates/0.9.0-cut/debate.md, amendment 2026-11-18).

> 2026-11-12: should in 0.9.0 (docs/debates/0.9.0-cut/debate.md). Order step 6 of the proposals waited for the smaller client, which ended with the no-go of values-spike. The maintainer decides go or no-go from the outcome.

> 2026-11-18: refined. The navigation debate (docs/debates/navigation/debate.md, approved 2026-11-18) rejected a component router partly because server-only components cannot run in the browser (J6, J7), and said server components could change that. Question 6 answers it.

# Spike: server components

## Goal

Build a throwaway prototype of a server component and `#server` that renders again on the server when an input changes in the browser. Write two cases of the website with it (a Markdown preview and a filtered list), write the same two cases with server functions, `$memo` and `refresh`, and measure both. The outcome says go or no-go for the backlog story `server-components`, and if go, gives its design with sizes.

## Why

[Server components](../../../../proposals.md#server-components) says brumate already has most of what React gets from them. A component that needs no client code ships no JS, `#defer` asks the server for a body and gets HTML and state records, and server functions and memos keep code and data on the server. What is missing is a render on the server when an input changes in the browser. It is a large feature (XL), so it needs evidence that it beats what exists before anyone plans it. The decision "server functions use `'use server'`" and the memo rules in `docs/decisions.md` already cover data, so the spike must show what a render adds.

## Current state

- A component that renders only on the server ships no code. `await` in its script waits on the server, and the client resumes from state and never runs it (docs/decisions.md, "Components run on the server only").
- A component that the browser renders again (inside an `#if`, a `#for` row, a changed prop) needs its render code and data in the browser. A browser render of `await $memo(...)` splits at the await (`$$b.wait`, browser-await). A promise `await` renders on the server only.
- `#defer` renders its body on the server in a later request: `packages/brumate/src/runtime/defer.ts` on the client and the defer body path in `packages/brumate/src/runtime/server.ts`. The answer holds HTML and state records. This is the nearest base for a prototype.
- Server function calls go through `rpc.ts` and `calls.ts` (serialization, origin check, rate limits, skew protection). `refresh(fn)` loads the memos that read `fn` again, and `refreshes.ts` lists the functions a project refreshes.
- The REPL (`website/src/repl/`) highlights code in the browser with `website/src/repl/highlight.ts` (twinkleplop languages), so the highlighter ships to the browser today. `website/src/components/Search.brm` is a filtered list whose index loads in the browser (`search-indexes.ts`).

## Prior art

Read the source at these SHAs, cite file and line in the outcome, and copy no API without a diff against it (memory: prior art carries its API).

- React Server Components, Flight format: [`ReactFlightServer.js`](https://github.com/facebook/react/blob/6ff257439b3919fc8dcc643b635e09d62fa74d0e/packages/react-server/src/ReactFlightServer.js), [`ReactFlightClient.js`](https://github.com/facebook/react/blob/6ff257439b3919fc8dcc643b635e09d62fa74d0e/packages/react-client/src/ReactFlightClient.js), [`ReactFlightDOMServerNode.js`](https://github.com/facebook/react/blob/6ff257439b3919fc8dcc643b635e09d62fa74d0e/packages/react-server-dom-webpack/src/server/ReactFlightDOMServerNode.js), [`ReactFlightDOMClientBrowser.js`](https://github.com/facebook/react/blob/6ff257439b3919fc8dcc643b635e09d62fa74d0e/packages/react-server-dom-webpack/src/client/ReactFlightDOMClientBrowser.js). Questions: how client components inside a server tree keep state when the tree is fetched again (reconciliation by position and key), what the wire format carries, how long a render takes before the first byte.
- Next.js app router: [`app-render.tsx`](https://github.com/vercel/next.js/blob/7ea592082e63e9a2af8ac388d6a24bc4d9373581/packages/next/src/server/app-render/app-render.tsx) and [`fetch-server-response.ts`](https://github.com/vercel/next.js/blob/7ea592082e63e9a2af8ac388d6a24bc4d9373581/packages/next/src/client/components/router-reducer/fetch-server-response.ts). Questions: what a navigation asks for, what the response holds, and how a kept layout stays mounted (the partial render that the navigation debate parked).
- Marko 6 server-only components: [`runtime-tags` fixtures `style-server-only-tree`](https://github.com/marko-js/marko/tree/c3232721ebc39beed903bfbd307e41d3ba312f63/packages/runtime-tags/src/__tests__/fixtures/style-server-only-tree) and the Marko 5 translator [`translate-server-only.js`](https://github.com/marko-js/marko/blob/c3232721ebc39beed903bfbd307e41d3ba312f63/packages/runtime-class/src/translator/taglib/core/translate-server-only.js). Questions: Marko marks a tag server-only and never renders it in the browser, and has no render again. That is the case brumate has now.
- Qwik `server$`: [`server-functions.ts`](https://github.com/QwikDev/qwik/blob/da40f0f9916999e1e74348f4b7f4b380d565ee75/packages/qwik-router/src/runtime/src/server-functions.ts). Question: a function that runs on the server and is called from the browser, which is the server-function baseline.
- Astro server islands: [`server-islands.ts`](https://github.com/withastro/astro/blob/c7a2f1d16a08bab8c9e2d380e0991fb22a5bafc1/packages/astro/src/runtime/server/render/server-islands.ts). Question: `server:defer` fetches the HTML of a component with its props once, which is `#defer` today. Does it render again on a prop change? (It does not, to our knowledge. Check.)
- Solid and SolidStart `"use server"`: [`packages/start/src/fns`](https://github.com/solidjs/solid-start/tree/68784294b16692adf687c25bcd58c16c8a625cb3/packages/start/src/fns). Question: server functions that return data, not markup.
- silmaril, [lxsmnsyc/silmaril](https://github.com/lxsmnsyc/silmaril/tree/910f4c1052b6be5ff5eb15690b21ede42ef06886): read only if its README or code has a server render again. It has no server component to our knowledge, so expect nothing.

## Questions to answer

1. Does a server component render again with only its inputs (as in "A render again" of the proposal) on top of the `#defer` path, with no page data loaded again, and what is the change to `server.ts`, `defer.ts` and the compiler (files, sizes)?
2. Do children keep their state (a `Counter`, the text of an input) across a render again, one level and nested, and children that the component passes on? Does a context that the server component provides reach them without a render?
3. What state inside the server component itself (focus, the text of a field, what is open) is lost, and does a morph or keyed parts fix it at a size worth paying?
4. For the two website cases, what does the server component version save over server functions, memos and `refresh`, in lines of app code, concepts, client bytes, bytes per update and round trips? What does `refresh(fn)` of a server component add that a memo does not?
5. What does it cost a page that uses none of it (todos bytes, flag per build as in browser-await)?
6. Does it change the navigation picture? With server components, is a server-only component in a route page something the browser can ask for, so that a component router (rejected as J6 and J7) no longer needs it to run in the browser? Say which of the two objections stays: J7 (server-only components cannot run in the browser) and J6 (it ships every page component, and adds a render path beside resume). Answer from the prototype and the prior art. No router is built.
7. Which marker: `<script server>`, a `server` attribute or another form (the proposal says "to choose")? Decide it from the survey, by who does what.

## Gates (fixed before the run)

The baseline is `release/0.9` at a commit named in the outcome before the prototype starts. The two cases are fixed here:

- Case A, Markdown preview: a `<textarea>` bound to a signal and a preview that shows the Markdown rendered with the highlighter of `website/src/repl/highlight.ts` for its fenced code, and a `Counter` as the children of the preview wrapper. The renderer may be any one Markdown library already in the repo's lock file, or a 40-line one if none is, the same in both versions.
- Case B, filtered list: a search input and a list of the docs and UI entries of `website/src/search-indexes.ts` (at least 300 rows), filtered by the input, each row with a button that keeps its own state.

Each case is written twice on the same page:

- Baseline: server functions, `$memo` and `refresh` only, with the best form the docs teach.
- Prototype: a server component or `#server`.

Go needs all of:

1. Works: both cases run in the prototype on a real server and in the browser. A change of the input shows the new HTML, children keep their state (one `Counter` count, one input text) across ten renders again, a slow response never replaces a newer one (last input wins), and the first render is the same HTML with scripts off. The test lives in `packages/brumate/test/spike-server-components/`.
2. Simpler: the sum of the app lines of the two cases (`.brm` and helper `.ts` they need, no blank lines or comments, no imports of types) is at most 0.85 times the baseline, and neither case is longer than its baseline. The count of distinct brumate APIs the two cases use (`$memo`, `refresh`, `'use server'`, `await`, `$signal` and so on, listed in the outcome) is no larger than the baseline's.
3. Equal size or smaller: the gzip JS that each case page loads before `load`, runtime added by the prototype included, is no larger than the baseline's (GOAL.md: size is recorded, not a gate, and at equal size simpler wins). The bytes of the update (request and response, gzip) and the round trips are recorded, not gated.
4. No tax: `pnpm bench --only brumate --scenario todos` shows 0 B more JS before `load` than the baseline, with the prototype behind a flag per build, two runs each.
5. Small enough to plan: the design in the outcome has children that each fit S or M, and the sum of its sizes is at most one XL story. A design that needs a new render path in the browser beside resume is a no-go (a server component renders only on the server, and the browser only replaces a range, as for `#defer` and navigation).

Anything else is a no-go, with the reason. A partial go is allowed when the outcome names the split. For example: `refresh` re-renders a `#defer` body ("refreshable defer") without children handling. The maintainer decides after the outcome.

Question 6 does not gate. It is answered either way.

## Measure

Commands and commits go in the outcome.

- Lines: `scripts` of the two versions, counted with one script written in the node folder and run on both.
- Bytes: the website build on the baseline and on the prototype, the two case pages as separate routes in a scratch copy of the website under the node folder or in the test fixtures: JS, CSS and HTML raw and gzip, first view. JS before `load` as the bench reports it. Rebuild `packages/brumate` dist before the website build.
- Per update: request and response bytes raw and gzip for the same ten inputs in both versions, with `curl` or the network log of the test.
- Round trips: counted in the test for the ten inputs, in both versions.
- Latency, for the record: the time from input to new HTML on a local server, median of ten, in both versions.
- Todos: `pnpm bench --only brumate --scenario todos` on the baseline and on the prototype with the flag off, nothing else running. Never the full bench.

## Acceptance

- [ ] `outcome.md` has the answers to the seven questions, the measurements with their commands and commits, the results of the five gates, a go, partial go or no-go, and, for a go, a design of the story `server-components` as nodes with sizes and the files each touches. Prior art claims cite files at the SHAs above.
- [ ] The prototype lives on a local branch named in the outcome and as a patch in the node folder. It is not merged. The two cases and the test live in `packages/brumate/test/spike-server-components/` and the node folder.
- [ ] If go, the outcome lists what to amend: the proposal "Server components" section (marker chosen, children rules), `docs/decisions.md` entries to write, and whether the navigation debate's rejection of a component router is reopened (it is not reopened without the maintainer).
- [ ] Fast check passes on what is committed: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: time-boxed to about 0.6M tokens (the cases and the prior-art survey are more than the 0.4M of style-files-spike, and the render again is the only new server path). Spend at most 0.15M on the survey and the baseline versions, 0.3M on the prototype and the test, and 0.15M on measures and the outcome. Stop and write the outcome when the box runs out. A prototype that is not working at 0.45M spent is a no-go on gate 1, with what was learned.

## Notes for the worker

- Start from `#defer`, not from a new path. Probe it first (CLAUDE.md of the roadmap): a page where a `#defer` body renders with inputs and the server answers for them.
- Make the baseline versions as good as the docs teach, with `$memo` of a server function and `refresh` where it helps. A weak baseline makes the result worthless.
- Keep GOAL comments off value lines. Use the `brumate` skill for the `.brm` files.
- Do not write product code on `release/0.9`. Work on a local branch from `release/0.9`.
