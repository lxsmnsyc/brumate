# Outcome: no-client-html

## Built

- A template that cloned its markup returns a `RawNodes` (runtime/client/children.ts): the fragment and the scope. `rawNodes` no longer holds a place in an HTML string. `insertOut(value, scope)` renders children, template calls, `RawNodes` and arrays as nodes (a fragment, or a string for text). `insert`, `linkCalls`, `setContent`, `putText`, `keepText`, `appendText` and the update write of an insert (`write` in inserts.ts) place nodes through it, so no insert of a clone goes through `holdPlace`, `placed` or the `<!--fN-->` parse. `TemplateCall` closures give `string | DocumentFragment`.
- `features.ts`: `clientHTML` now needs `return $$html;`; the `rawNodes(` clause is gone.
- The four render pages that still gave HTML clone now (`codegen/template.ts`):
  - A `<textarea>` or `<title>` with text and values (`a {initial} b`, `Page | {site}`) is one `content` write with `text: true`: `$$b.setText(element, [pieces])` (new `setText` in templates.ts, exported from client.ts). Text with `&` or `<` still needs HTML.
  - The reader reset `raw` only at the next start tag, so a component or a dynamic tag after `<template ...></template>` (a `$client` callback) did not clone. A closing tag now ends `raw`. This fixed `blocks.brm` and `refForward.brm`.
- `test/clone-bodies.test.ts` has a test that only `awaitLoadingOn.brm` turns `clientHTML` on. `feature-flags.test.ts` expects `clientHTML` off for a template. The `render/blocks` snapshot changed (clones now).

## Proof

- base: 750f653 (batch plus the current brief). `test/render` pages with `clientHTML` on: 61 of 681. Todos JS before `load`: pending: bench lock.
- branch: `clientHTML` on for 1 of 681 pages (`awaitLoadingOn.brm`). Todos JS before `load`: pending: bench lock. The flag is off on todos on the base already, and no code that todos runs changed except `insert` of children and templates, so the expected change is under 0.3 kB.

## Deviations

- Acceptance 1 is not met: the `CLIENT_HTML` flag stays. One kind of body still builds an HTML string: the body of a `#loading` that waits for an `await` (`awaitLoadingOn.brm`, `$$body0`). The start marker of the block (`<!--bN:0:1-->`) is written before `$$b.wait`, and the HTML of the marker and of the wait callback share one `$$html`, which `cloneLines` (one function level) cannot split. To drop it, the compiler must emit the markers of a `#loading` body as nodes around the range that `wait` returns. That is its own node.
- Acceptance 2 and 3 (sizes of the website, the ui example and todos) are pending: the bench lock was not free.
- Review fixes: `clientHTML` is also on for a template that returns `$$b.raw($$html` (its inserts hold places); `insert` throws when it gets nodes and the flag is off. A value first in a `<title>` or `<textarea>` no longer empties the template. A mixed array parses its strings in the context of the insert (SVG kept).
- The `clientHTML` gate for a raw template is a fact of the compile, not a scan of the code text: `plan.rawPlaces` (plan.ts), set by `emitTemplate` when a template that returns `raw` holds a place for nodes: a component, dynamic tag or block code part (checked on the code parts of the flushes, not on the text that markup writes), or an insert with a scope. `getFeatures` reads `result.plan.rawPlaces`, as it reads `plan.scripts`, so every path that has a compile result has it.
- Every template of the browser marks each insert whose value is not text (a literal, a template string, or a parameter typed `string`, `number` or `boolean`: `textParameters`, codegen/markup.ts) with `/*$$nN:ctx, scope*/`. `N` is the first number such that `$$nN:` is not in the source, so no text or comment of the component reads as a mark. `emitTemplate` decides after `cloneLines`: a clone strips the marks, and a template that returns `raw`, for any reason (ambiguous top, a refused clone, no `hoist`), turns them into the scope argument. clone-bodies.test.ts checks that no mark is left in any page. Pages `tplFunctionText` (a component and the text `function`) and `tplMarkText` (the old mark in a string and in a comment) guard both.
- No page makes `cloneLines` refuse a template with a non-ambiguous top: about 30 shapes were tried (blocks, portals, raw text elements, spreads, attributes) and all cloned. The refused-clone path uses the same code as the ambiguous one (`cloned` false), which `tplChildrenParam.brm` covers, but no page covers it on its own.
- Cheap way to clone ambiguous templates (not built): `$$b.raw` could carry the template instead of its HTML, and the insert would clone it with `findForeign(near)` choosing the namespace, as `parseTemplate` already parses a template inside `<svg>` for `foreign`. That removes the raw string and this gate.
- What stays, and why:
  - `holdPlace`, `placed`, `placedCount` and the `<!--f` parse in `parseHTML` (insert.ts), used only by the helpers that run inside an HTML-string body: `insert` (children.ts), `component`, `dynamic` (components.ts) and `nodes` (templates.ts). They serve that `#loading` body and any body that `cloneLines` still refuses (markup in a branch between flushes, two declarations of one name, a part it cannot read). The compiler cannot promise that none exists in user code, so the helpers stay behind `HAS_CLIENT_HTML`.
  - `$$b.raw($$html, scope)` for a template whose top element is `<a>`, `<script>`, `<style>` or `<title>` (page `tplSvgLink.brm`), so the insert parses it in its own namespace. `RAW_TEMPLATES` in clone-bodies.test.ts names it. The insert of its `Raw` string parses with `parseHTML(out, near)`.
  - Lazy indexing of HTML inserts (`unindexed`, `indexInserts`, `HAS_CLIENT_HTML` in `insertHTML` and `findElement`) stays for the same reason.
- Edits outside the brief's lists: none besides `packages/brumate/test/__snapshots__/render/blocks.txt` (under `test/**`).
- No changeset: no user-visible change (same output, fewer runtime paths).
- The JS before `load` of the website and of the ui example is not recorded: the bench lock was not free, and a base build would need a scratch worktree. fixed-walks or the orchestrator should run it.

## Stubs left

- The `#loading` body that waits (above), and `$$b.raw` for ambiguous top elements: `$$b.raw` could clone with the namespace of the insert, chosen at the insert (a `Raw` that carries a template and the insert clones it with `findForeign`).

## Gotchas

- `insertOut` returns a string for text and a fragment for nodes. A caller in HTML must use `insert`, which holds a place for nodes; a caller of nodes must use `insertOut` or `insertNodes` (templates.ts).
- `clonedMarkup` is still global. A mixed array (HTML next to nodes) calls `markCloned` and parses its strings.
- `reader.raw` ended only at the next start tag before; code in codegen/template.ts that reads it now sees it end at a closing tag.

## Proposed learnings

- A value that can be nodes goes through `insertOut`, never through a string that holds a place for it | a place in HTML costs a parse and a map | packages/brumate/src/runtime/client | no

## Verification

- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`, `pnpm build`: pass.
- brumate: clone-bodies, feature-flags, render, template, differential-1..4 (1293 tests), resume (671): pass.
- `pnpm --filter @brumate/ui exec vitest run`: 846 passed, 2 expected fail.
- `node e2e/run.mjs --only ui`: 61 passed. `--only browser-async`: 6 passed.
- Not run: `pnpm bench` (lock held by another node).

## Size

- Estimated M, actual M.
- Risk estimated medium, measured medium: every insert of children and templates changed its path, and two compiler rules changed (`<textarea>`/`<title>` text, the end of `raw`). The suites above pass.
