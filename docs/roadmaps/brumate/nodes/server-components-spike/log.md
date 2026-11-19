# Log: server-components-spike

## 2026-11-19

- Baseline: `batch/brumate-release-0.9` at 86b9bc5e (it holds `origin/release/0.9` 8cebc3ae and the 0.9.0 batch work). Branch `experiment/server-components-spike` from it. `pnpm install --frozen-lockfile && pnpm build` passed.
- Survey: one research agent read the prior-art files at the brief's SHAs. Findings are in the outcome, table "Prior art". Two expectations of the brief did not hold: the Astro file at the given path is a 3-line re-export (the source is `packages/runtime/src/internal/server/render/server-islands.ts`), and the Marko fixture `style-server-only-tree` has no user marker (it tests CSS through a stateless tree; `translate-server-only.js` is wired to internal core tags only).
- Probe of `#defer` (server.ts 1355-1400, `render` at 2833): a defer request renders the route again up to the block, so data the page loads before the block loads again (docs/async-data.md, "#defer"). The `$bS` swap removes its markers, so a body cannot be swapped twice. Not a base for a render again.
- Found the base instead: `render(Root, props, { base })` renders another root of the same page, with IDs above `base` and records under `b-root` (server.ts 2903, "Another root on the same page passes it as base"). The browser reads late records at once (`pushRecords` in client/resume.ts) and `removeRoot` removes a root's scopes. `brumate/testing` mounts this way. So the prototype needs no change to server.ts, defer.ts or the compiler.
- Prototype (first under `packages/brumate/test/spike-server-components/app`, later moved, see below):
  - `src/proto-runtime/server.ts`: `renderFragment(Root, props, frame)` calls `render` with `base`, and `kept(key)` reads the kept keys from an `AsyncLocalStorage`.
  - `src/proto-runtime/client.ts`: `rerender(box, ask)`: sends `base` (highest `b-next` on the page) and the kept keys, drops an older answer, moves the nodes of each `<!--k{key}-->…<!--/k-->` hole into the new HTML, keeps holes that left in a pool, runs the state script.
  - `src/proto/fragments.ts`: the two renders again as `'use server'` functions, which a compiler would write.
- Case pages: `/a-base`, `/a-proto`, `/b-base`, `/b-proto`. Case B has 1518 rows (headings of website/docs and website/ui, `scripts/make-entries.mjs`).
- Fixes during the run: `text={start}` is the object shorthand, not the value; `text=start` is right. Case B inputs such as `async d` and `async da` give the same rows, so the check waits for the rows of each input, not for a change.
- `node packages/brumate/test/spike-server-components/check.mjs`: PASS, three runs. Numbers in the outcome.
- Lines: `node docs/roadmaps/brumate/nodes/server-components-spike/count-lines.mjs`. Baseline 17 + 17. The designed syntax (`designed/`, not compiled) 18 + 18. The prototype as written 24 + 34.
- First view: proto JS before `load` +1120 B gzip on case A, +316 B on case B. Case B HTML is 27.5 kB gzip against 48.0 kB, because the baseline also sends the 1518 rows in its state.
- Gates 2 and 3 fail. The verdict is no-go.
- Bench: `pnpm bench --only brumate --scenario todos`, two runs. packages/brumate/src is unchanged, so the baseline and the prototype are the same build.
- Moved the app to `nodes/server-components-spike/app`: the typecheck of `packages/brumate` includes `test/`, and the app imports untyped `markdown-it` and the website's `highlight.ts`. `check.mjs` stays in `packages/brumate/test/spike-server-components/`. The check passes from the new place.
- Bench: 35 410 B raw, 14 686 B and 14 683 B gzip JS before `load`.
- `pnpm lint && pnpm format:check && pnpm typecheck` pass.
