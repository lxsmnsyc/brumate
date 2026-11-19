# Outcome: server-components-spike

Verdict: **no-go** for the story `server-components`. Gate 1 (works), gate 4 (no tax) and gate 5 (small enough) pass. Gate 2 (simpler) and gate 3 (equal size) fail. The two cases come out longer and load more JS than the baseline of `$memo` of a server function. The one measured gain is case B's first-view HTML. It is not a gate, and the outcome names a cheaper way to it below. The maintainer decides.

## Built

- Branch `experiment/server-components-spike` from `batch/brumate-release-0.9` at 86b9bc5e (it holds `origin/release/0.9` 8cebc3ae). The patch is `nodes/server-components-spike/prototype.patch`. Nothing in `packages/brumate/src` changed.
- `nodes/server-components-spike/app`: a Vite app with four routes, copied from `examples/browser-async`. It lives in the node folder because the typecheck of `packages/brumate` includes `test/`, and the app imports the website's untyped `markdown-it` and `highlight.ts`.
  - `/a-base`, `/b-base`: the baseline, server functions and `$memo`, in the form that `website/docs/async-data.md` teaches.
  - `/a-proto`, `/b-proto`: the prototype, a server component rendered again on the server.
- `app/src/proto-runtime/server.ts` (40 lines): `renderFragment(Root, props, frame)` calls the existing `render(Root, props, { base })`, which renders another root of the page. `kept(key)` tells the render which client parts the browser keeps.
- `app/src/proto-runtime/client.ts` (95 lines): `rerender(box, ask)`. It does these things:
  - It sends `base`, the highest `b-next` on the page, and the kept keys.
  - It drops an answer older than the latest request.
  - It moves the nodes of each `<!--k{key}-->…<!--/k-->` hole into the new HTML, and keeps the holes that left in a pool.
  - It runs the state script. The core reads it as a new root, as it does for the records of `#defer`.
- `app/src/proto/fragments.ts`: the two renders again, as `'use server'` functions. A compiler would write these.
- `check.mjs`: the browser check of gate 1 and the measures (Chrome through playwright-core of `e2e/`).
- `designed/`: the two cases in the syntax that a story would build (`<script server>`). They are not compiled, and only the line count reads them.

## Result

- result: **missed**. Gate 2 and gate 3 fail.
- reproduce:
  ```bash
  cd docs/roadmaps/brumate/nodes/server-components-spike/app
  mkdir -p node_modules/@twinkleplop   # links: see "Gotchas"
  node scripts/make-entries.mjs        # 1518 rows
  node node_modules/vite/bin/vite.js build --outDir dist/client
  node node_modules/vite/bin/vite.js build --ssr src/server.ts --outDir dist/server
  node ../../../../../../packages/brumate/test/spike-server-components/check.mjs   # PASS, prints the numbers below
  node ../count-lines.mjs <files>
  ```

### Gates

| Gate            | Result   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Works        | pass     | `check.mjs` PASS in 3 runs. Both cases run on the production server in Chrome. Ten inputs show the new HTML. Case A keeps the count (3, and it still counts to 4) and the text of an input passed as children. Case B keeps a starred row, and a row that left and came back still toggles. A response delayed 600 ms never replaces a newer one. With scripts off, the view of each version is the same HTML as its baseline, without markers and `b-` attributes.              |
| 2. Simpler      | **fail** | Lines: baseline 17 + 17 = 34. Designed syntax 18 + 18 = 36 (1.06x, limit 0.85x), and each case is one line longer than its baseline. The prototype as written: 24 + 34 = 58 (1.71x). The shared helpers (Counter, RowButton, markdown.ts, entries.ts: 39 lines) are the same in both and are left out. Counting them gives 73 against 75. APIs: baseline `$signal`, `$memo`, `'use server'`, `raw` (4). Designed: `$signal`, `$props`, `raw`, `<script server>`, `children` (5). |
| 3. Equal size   | **fail** | gzip JS before `load`: A 17 218 to 17 426 B baseline (the `Counter` chunk lands before or after `load`), 18 338 to 18 345 B prototype (+919 to +1 120). B 17 876 to 17 884 B, 18 192 to 18 194 B (+310 to +316). The prototype adds the `rerender` runtime and an effect. The baseline already has `$memo` in the core.                                                                                                                                                          |
| 4. No tax       | pass     | `packages/brumate/src` unchanged, so the todos build is the same. Two runs: 35 410 B raw, 14 686 B and 14 683 B gzip JS before `load` (14.3 kB). 0 B more.                                                                                                                                                                                                                                                                                                                       |
| 5. Small enough | pass     | Design below: 4 M and 1 S, under one XL. No new render path in the browser: it inserts HTML and resumes a root, as `#defer` and navigation do.                                                                                                                                                                                                                                                                                                                                   |

### Measures

Commands: `node packages/brumate/test/spike-server-components/check.mjs`, on 86b9bc5e plus the prototype. The figures are from the first run. A later run gave the same bytes within 10 B, except for the Counter chunk of A base. Per update: ten inputs, each request and response gzipped one by one, summed.

|                                         | A base          | A proto         | B base           | B proto          |
| --------------------------------------- | --------------- | --------------- | ---------------- | ---------------- |
| JS before `load`, raw / gzip            | 43 003 / 17 218 | 44 973 / 18 338 | 44 104 / 17 876  | 44 670 / 18 192  |
| JS after `load`, gzip                   | 200 (Counter)   | 0               | 0                | 0                |
| HTML, raw / gzip                        | 2 067 / 927     | 1 851 / 893     | 397 083 / 47 971 | 341 801 / 27 520 |
| CSS                                     | none            | none            | none             | none             |
| Round trips, ten inputs                 | 10              | 10              | 10               | 10               |
| Sent, raw / gzip, ten inputs            | 1 080 / 1 118   | 2 173 / 1 587   | 655 / 789        | 278 908 / 39 213 |
| Received, raw / gzip, ten inputs        | 4 950 / 2 189   | 8 740 / 4 187   | 131 008 / 15 738 | 102 965 / 14 323 |
| Latency, median of ten, ms (three runs) | 15, 82, 31      | 26, 41, 31      | 8, 50, 25        | 6, 50, 24        |

- Latency is noise on a local server. No version is faster.
- Case B prototype sends the 1518 kept keys with each request (28 kB raw). A design must send less, see "Design".
- Case B baseline HTML is 20 kB gzip larger, because the page state holds the 1518 rows that the browser `#for` would need. That is the one gain of the prototype, and it is not a gate.

## Answers

### 1. A render again with only its inputs

Yes, but not on the `#defer` path. A `#defer` request renders the route again up to the block, so data the page loads before it loads again. That is documented in `website/docs/async-data.md`, "#defer". Its swap `$bS` (server.ts 2557) also removes its markers, so a range cannot be swapped twice. The base is another path that already exists: `render(Root, props, { base })` (server.ts 2833, and `root = options.base` at 2903) renders one component as another root of the page. Its records carry `b-root`, the browser reads late records at once (`pushRecords`, client/resume.ts 88), and `removeRoot` (client/resume.ts 330) removes a root's scopes. No page data loads again: the request holds only the props.

Changes in the prototype: none to server.ts, defer.ts or the compiler. The runtime is 40 lines on the server and 95 in the browser, about 0.7 kB gzip with its stubs (the `fragments` chunk is 1.36 kB raw, 0.73 kB gzip). A story needs the compiler work listed under "Design".

### 2. Children

- One level: yes. Case A passes `<Counter />` and an `<input>` as children. Ten renders keep the count and the text, because the browser moves the same nodes into the new hole. The scopes stay in their first root and never resume again.
- The component's own client parts, by key: yes. Case B keeps the `RowButton` of each row by `row.id`. Rows that leave go to a pool, and they come back with their state.
- Nested server components, and children that a server component passes on to another: not tested. The hole protocol is the same at any depth, but the keys must be unique on the page (a path of keys).
- Context: a context that the server component provides does not reach a kept child again. The child is not rendered again and keeps the values it resumed with. A child new in the fragment gets the context in the server render, inside the fragment's root. A context that the page provides above the server component does not reach the fragment render at all, because the render starts at the component. React has the same rule: a server component cannot read client context.

### 3. State inside the server component

Everything that is not in a hole is lost on each render: focus, the selection, the scroll of an inner box, the open state of a `<details>`, and the text of a field in its markup. `replaceChildren` drops them. Holes fix this only for client parts. A morph of the DOM (as Turbo or htmx do, through idiomorph) would keep plain DOM state. It was not built or measured. It adds a second way to update the DOM beside the compiled updates, which is the path gate 5 rules out. A rule is cheaper: no stateful element in the markup of a server component, and the compiler reports one (a form field without a hole, `<details>`, `autofocus`).

### 4. What it saves over server functions, memos and `refresh`

|                         | Case A                                                                    | Case B                                  |
| ----------------------- | ------------------------------------------------------------------------- | --------------------------------------- |
| App lines               | 18 against 17 (designed)                                                  | 18 against 17 (designed)                |
| Concepts                | trades `$memo` and `'use server'` for `<script server>` and the hole rule | same                                    |
| Client JS before `load` | +919 to +1 120 B gzip                                                     | +316 B gzip                             |
| Bytes per update, gzip  | 5.8 kB against 3.3 kB                                                     | 53.5 kB against 16.5 kB (the kept keys) |
| Round trips             | same, 10                                                                  | same, 10                                |
| First view HTML, gzip   | same                                                                      | 27.5 kB against 48.0 kB                 |

The baseline is already a render on the server when an input changes: `$memo(preview(text))` with `raw()` sends HTML for case A, and `$memo(search(query))` sends rows. A server component adds markup with client parts inside it. Case A does not need that, because its `Counter` can sit beside the HTML. Case B needs it only to avoid the browser `#for`, which saves the rows in the first page state and nothing else.

`refresh(fn)` of a server component would render it again when a server function changes its data. A memo that reads `fn` already loads again through `refresh(fn)`. The server component gains only that the markup, not the data, comes back. This is the same trade as the table.

### 5. The cost to a page that uses none of it

0 B. The prototype changes no file of `packages/brumate/src`, so todos is the same build (gate 4). In a design, `rerender` is a module that only the pages with a server component import, as `defer.ts` is today. It needs no flag.

### 6. The navigation picture

It changes one of the two objections.

- J7 (server-only components cannot run in the browser): answered. The browser never runs them. It asks the server for the component with its props, as `/a-proto` does, and resumes the answer as a root. Next.js does this for a route: the request names the router state (`NEXT_ROUTER_STATE_TREE_HEADER`, fetch-server-response.ts 107-117), and the server renders from the first segment that changed (`renderComponentsOnThisLevel`, walk-tree-with-flight-router-state.tsx 143-154). The layouts above it are not sent, so they stay mounted.
- J6 (it ships every page component, and adds a render path beside resume): the first half goes away for server components, which ship no code. The second half stays for every route page that is not a server component, which is most of them today. Brumate's navigation already replaces a route's range and resumes it (`leaveRoutes`, client/resume.ts 321). A component router of server components would be that same request with props in place of a URL.

So J6 stays, J7 does not. The rejection is not reopened without the maintainer.

### 7. Which marker

`<script server>` on the definition. The table shows who does what.

| Framework  | Marker                                                                                                                                                                                                        | Where          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| React      | `'use client'` marks the client side, and the server is the default. Client parts go over the wire as module references (`I` row, `serializeClientReference`, ReactFlightServer.js 3158-3210), never as code. | the file       |
| Astro      | `server:defer`, seen by the runtime as the prop `server:component-directive` (server-islands.ts 19-21)                                                                                                        | the use site   |
| Qwik       | `server$(fn)` (server-functions.ts 513), a function, not a component                                                                                                                                          | the definition |
| SolidStart | `'use server'` on a function or module, which returns data (`serializeToJSONStream`, handler.ts ~262)                                                                                                         | the definition |
| Marko 6    | none. `translate-server-only.js` removes internal core tags from the browser build                                                                                                                            | none for users |

Brumate components are resumable by default, so the marker goes on the server side, as React's goes on the client side. It belongs on the definition: the guarantees (the imports never ship, the script may read secrets) hold for the component, not for one use of it. That is how `'use server'` already works in brumate. `<script server>` matches `<script module>`. A `server` attribute at the use site, as Astro does it, would build every component for both sides and let one use leak what another hides. `'use server'` in the instance script would mean "an endpoint that returns data", which is its meaning today.

## Prior art

All at the brief's SHAs. A research agent read the files and quoted lines. The full notes are in `log.md`.

- React Flight. Rows are `<hex id>:<json>\n` (ReactFlightServer.js 4823). The tags are `I` (module), `H` (hint), `E` (error), `T` (text) and others (ReactFlightClient.js 5301). Elements are `["$", type, key, props]` (ReactFlightClient.js 2729, 3026-3032). `$L` is lazy and `$@` is a promise (ReactFlightServer.js 3055-3071).
  - The client builds plain element objects (`createElement`, ReactFlightClient.js 1493-1525) and hands them to React. State survives because React reconciles by type, position and key. That code is in React core and was not read.
  - The response streams before the tree finishes: `startWork` runs in a microtask (6752), and `flushCompletedChunks` (6521) writes as chunks complete.
- Next.js: see question 6. `createFullTreeForNavigation` (app-render.tsx 637-660) is used only in development.
- Astro. The real source is `packages/runtime/src/internal/server/render/server-islands.ts`, and the brief's path is a 3-line re-export.
  - The export, props and slots are encrypted (~175-197) and fetched from `/_server-islands/<id>`, by GET when the URL is short enough and by POST otherwise (~203-237).
  - The replacer runs once per page load (~248-274). It never fetches again on a prop change. This is `#defer` today.
- Qwik `server$`: a POST with `X-QRL`, `application/qwik-json` arguments, and data back (server-functions.ts 401-508). This is the server-function baseline.
- SolidStart: a POST to `_server` with `X-Server-Id` and seroval arguments (client.ts 18-100), and data back. Skew reloads the page (client.ts ~139-147).
- silmaril: the README has three lines, and no server render.

## Design (not to build: no-go)

If the maintainer still wants the story, these are its nodes:

1. `server-script` (M): compiler. Add `<script server>`, report signals, handlers, effects and stateful elements in it, and write the render-again server function of the component. Touches `analyze.ts`, `compile.ts`, `error-catalog.ts`, `codegen/`.
2. `server-use-site` (M): compiler. At a use with live props, write range markers and an effect that calls `rerender` with the props. Children and client parts become keyed holes. Touches `analyze.ts`, the server codegen, `runtime/server.ts` (hole markers).
3. `server-fragment` (M): runtime. `render` with `base` and kept keys, through the `rpc.ts` and `calls.ts` path (origin, rate limits, skew). Send kept keys as a digest or let the server answer with a hole for every client part, so case B does not send 28 kB. Touches `runtime/server.ts`, `rpc.ts`.
4. `server-rerender` (M): browser runtime. `rerender` with last-input-wins, the pool, and `removeRoot` of the component's own old roots. Kept holes must move to a root that outlives the fragment, or the old roots must stay. Touches a new `runtime/server-component.ts` and `client/resume.ts`.
5. `server-docs` (S): docs and skill.

Sum 4 M and 1 S, under one XL.

## Deviations

- The render again uses `render` with `base`, not the `#defer` path that the brief said to start from. The probe showed that a defer request renders the route again up to the block. Question 1 asks for no page data loaded again.
- The prototype is hand-wired: an `$effect` calls `rerender`, and the server component writes its hole markers with `raw()`. Gate 2 is judged on the designed syntax (`designed/`), which is the better case for the prototype. It still fails.
- The case pages live in a test app in the node folder, `app/`, not in a copy of the website. The pages import `website/src/repl/highlight.ts` and the website's `markdown-it`. `check.mjs` lives in `packages/brumate/test/spike-server-components/`.
- The check is a Node script (`check.mjs`), not a vitest file. Vitest of `packages/brumate` runs in happy-dom, and gate 1 needs Chrome and a real server.
- The baseline has no `$debounced`, so both versions make a call per input.

## Stubs left

- `app/src/proto/fragments.ts` and the `raw('<!--k…-->')` markers stand in for compiler output (design nodes 1 and 2).
- The prototype never removes old roots. The state scripts of ten renders stay in `<body>`, and the scope of `Preview` is added again each time.

## Gotchas

- The app is not a workspace package. `app/node_modules` holds links, made by hand:
  - `brumate` links to `packages/brumate`.
  - `vite` links to `examples/browser-async/node_modules/vite`.
  - `markdown-it` and `@twinkleplop/*` link to those of `website/node_modules`.
- `text={start}` is the object shorthand `{ start }`, not the value. Write `text=start`.
- `render(…, { base })` needs the page's highest `b-next`, or the scopes of the answer clash with the page's.
- The baseline of case A duplicates the HTML: the memo value is in the page state too (`a-base` state holds the rendered Markdown).

## Proposed learnings

- A render again of one component goes through `render(Root, props, { base })` and a new root, not through `#defer` | a defer request renders the route up to the block | packages/brumate/src/runtime | no
- A `$memo` of a server function that returns HTML through `raw()` is the baseline any server-markup feature must beat | it already renders on the server when an input changes | docs/proposals.md | no

## Verification

- `node packages/brumate/test/spike-server-components/check.mjs`: PASS, 3 runs.
- `pnpm bench --only brumate --scenario todos`, two runs: 14 686 B and 14 683 B gzip JS before `load`, the same build as the baseline (`git diff 86b9bc5e -- packages/brumate/src` is empty).
- `pnpm lint && pnpm format:check && pnpm typecheck`: pass (lint warnings only, none new as errors).

## Size

- Estimated M, actual M (about 0.33M of the 0.6M box, the survey agent's 0.09M included).

> 2026-11-19: no-go accepted by the maintainer after a fresh review confirmed gates 2 and 3. The prototype stays on the local branch `experiment/server-components-spike` (867d27ff). The server-components story is parked.
