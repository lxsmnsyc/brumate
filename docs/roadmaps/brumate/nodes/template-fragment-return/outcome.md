# Outcome: template-fragment-return

## Built

- `#template` functions clone their markup and return `$$b.rawNodes($$f, scope)` (`emitTemplate`, codegen/markup.ts). `rawNodes` (runtime/client/children.ts, exported from `client.ts`) holds a place for the clone in the HTML (`holdPlace`) and returns a `Raw` with the template's scope, so `insert`, `linkCalls` and the in-place update of `templateCall` work as before. A template with no markup, or markup that cannot clone, still returns `$$b.raw($$html, scope)`; no page in `test/render/` has one.
- Scope tracking (the cause the brief named): a clone writes `b-b` only on elements with an anchor or a handler, so `destroyNodes` and `inRange` did not find a template whose top element is static. `rawNodes` records the scope of each top node of the clone in `templateNodes` (runtime/client/state.ts, a WeakMap). `destroyNodes` (scopes.ts) and `inRange` (inserts.ts) read it. No attribute is added to the DOM.
- The constants of templates that `withTemplates` (codegen/client.ts) emits land in another part than the current one, so a module constant was missing there (`$$k0 is not defined`). That emitter now uses `shareConstant`: `$$b.shared(key, () => code)` (runtime/client/templates.ts), made once per key.
- A template whose top element is `<a>`, `<script>`, `<style>` or `<title>` (SVG has them too) keeps `$$b.raw($$html, scope)`: it can be called anywhere, and the insert parses the HTML in its own context (`hasAmbiguousTop`, codegen/markup.ts). A clone would take the namespace of the template, not of the insert. Page `tplSvgLink.brm`, test in resume.test.ts checks `namespaceURI`; `clone-bodies.test.ts` lists it by name (`RAW_TEMPLATES`) and scans the render module too.
- `$$b.shared` keys are a hash of the constant's code, so a hot edit makes a new key (test in clone-bodies.test.ts).
- `templateNodes` stays a WeakMap, with its reads behind `HAS_TEMPLATES`. A slot on the scope cannot answer `destroyNodes`: it starts from nodes in a range and needs their scope, so a slot would scan every scope on each replace.
- `features.ts`: `clientHTML` is on for `$$b.rawNodes(`; `templates` also matches `rawNodes($$f, `.
- Tests: `clone-bodies.test.ts` also fails on a `return $$b.raw(` in a page. `feature-flags.test.ts` expects `clientHTML` on for a template. Three snapshots updated (`render/blocks`, `list`, `template-update`).

## Proof

- base: a09f674e. The attempt in the clone-remaining-bodies outcome failed 8 resume tests (`tplInPlaceHost` 15 scopes, not 11). On this branch the same first try, before `templateNodes`, gave `tplInPlaceHost` 14 vs 11 and 15 failures in resume.test.ts. Todos: JS before `load` 35.3 kB / 14.6 kB gzip.
- branch: resume.test.ts 670 of 670 pass, `tplInPlaceHost` ends with the base scope count. Todos: 35.4 kB / 14.6 kB gzip (within 0.3 kB).

## Deviations

- The node folder (brief.md) is not in the batch branch (it is on main, f289a594). Read with `git show`; not copied.
- Edits outside the brief's lists: `packages/brumate/src/features.ts`, `packages/brumate/test/feature-flags.test.ts`, three snapshots under `test/__snapshots__/render/`.
- No changeset: no user-visible change.

## Stubs left

- HTML-string code that is still used: `$$b.raw` for a template with no clonable markup; `holdPlace` and the `<!--fN-->` parse in `parseHTML` (needs `clientHTML`), which now serve templates too; `insert`/`insertHTML` string paths for server markup and `children` from the server; `SERVER_SCOPES`/`indexMarkers` for server HTML.
- Now unused for templates: `return $$html` in `#template` functions of the browser (the `$$html` lines are dropped when the clone works).
- `rawNodes` still goes through `holdPlace` (a `<!--fN-->` string that `insertHTML` parses), so `clientHTML` is on for 61 of 680 render pages, against 12 on the base. For no-client-html, to remove it:
  - let `Raw` (or a client twin) carry a DocumentFragment;
  - let `insert`, `linkCalls` and the content and fill paths place nodes directly;
  - make `rawNodes` return the fragment;
  - delete `holdPlace`, `placed`, the `<!--fN-->` parse in `parseHTML`, and the `rawNodes(` clause in features.ts;
  - clone or remove the remaining `return $$html;` functions (render and update parts of awaitLoadingOn, blocks, refForward, textarea, twoTitles);
  - templates with an ambiguous top element still return `$$b.raw`: they need a clone chosen by the foreign context at the insert.

## Gotchas

- `clonedMarkup` and `holdPlace` are global: the insert must follow `rawNodes` at once. A `TemplateCall` render inside `insert` does.
- `hoist` of the emitter in `withTemplates` cannot use a module constant of the current part; use `shareConstant`.
- Under load (average above 10) differential-4 `ResolveGoneChild` failed once and passed alone.

## Proposed learnings

- Mark the top nodes of a clone with their scope in a WeakMap, not with `b-b` | an attribute adds DOM bytes and reads by `closest` and lists | packages/brumate/src/runtime/client | no

## Verification

- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`, `pnpm build`: pass.
- brumate: clone-bodies, resume, render, template, differential-1..4, feature-flags: pass after fixes and the review fixes (the first pass missed the `joinFeatures` expectation, line 71) (differential-4 once failed under load, passes alone).
- `pnpm --filter @brumate/ui exec vitest run`: 846 passed, 2 expected fail.
- `node e2e/run.mjs --only ui`: 61 passed. `--only browser-async`: 6 passed.
- `pnpm bench --only brumate --scenario todos`: 35.4 kB / 14.6 kB (base 35.3 / 14.6).

## Size

- Estimated M, actual M.
- Risk estimated medium, measured medium: `clientHTML` now turns on for pages with a template, and a template that cannot clone keeps the old path.
