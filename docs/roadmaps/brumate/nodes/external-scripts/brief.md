---
id: external-scripts
title: External scripts
status: active
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/external-scripts && node e2e/run.mjs --only scripts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent:
owns:
  - packages/brumate/test/external-scripts/**
  - e2e/suites/scripts.mjs
shared:
  - packages/brumate/src/parser.ts
  - packages/brumate/src/ast.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/check.ts
  - packages/brumate/src/features.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/boot.ts
  - packages/brumate/src/runtime/features.ts
  - packages/brumate/src/runtime/trusted.ts
  - packages/brumate/src/runtime/navigate.ts
  - packages/brumate/elements.d.ts
  - e2e/run.mjs
  - e2e/README.md
  - website/docs/navigation.md
  - website/docs/reference-security.md
  - docs/decisions.md
  - .changeset/*.md
reserves: [code BRM212, code BRM213, code BRM214, code BRM215, code BRM216]
provides: []
depends_on: []
---

> 2026-11-12: a must feature of 0.9.0 (docs/debates/0.9.0-cut/debate.md). Refined 2026-11-18.

# External scripts

## Goal

A `.brm` file can hold a script of another site, such as analytics, a chat widget or the loader of Google Tag Manager, and say when it loads: `<script src="…" trigger="idle|visible|interaction">`, or `<script inline trigger="…">` for code written in the file. Without `trigger` the script runs as HTML writes it. Scripts of other sites are often the heaviest code of a page, so a trigger keeps them from undoing what resume saves.

## Current state

- `<script>` in markup is an error: `parser.ts:235-238` ("must be at the top level or at the start of a block"). A top-level one takes only `module`, `generics` and `lang` (`parser.ts:722-728`, "Unknown <script> attribute"). The script of a block takes no attributes (`parser.ts:859-863`). Messages are in `error-catalog.ts:93,281,365`.
- `#head` blocks render through the `addHead` helper (`codegen/markup.ts:2942-2972`, `2959`). The browser keeps head elements whose HTML is the same after a navigation, and runs a script again only with `data-rerun` (`runtime/navigate.ts:512-545`, `updateHead`; `docs/decisions.md`, head-rerun-scripts).
- `runnable` copies a script so it runs, with the nonce of the loaded page, and passes its text through `trustedScript` (`navigate.ts:465-481`). A script with `src` in a swapped body is not run (`navigate.ts:~494-500`).
- The `brumate` Trusted Types policy has `createHTML` and `createScript` only (`runtime/trusted.ts`). A `script.src` under `require-trusted-types-for 'script'` needs `createScriptURL`.
- The nonce of a render is `getEvent().nonce` (`runtime/request.ts:160-163`, set in `server.ts:2865-2867`).
- The loader runs `$client` and `#defer` with the triggers `visible`, `idle` and `load` (`runtime/boot.ts:116-117,441-455`; `parser.ts:80`). `interaction` does not exist yet. The proposal says "the triggers of `$client`", which is not true for `interaction`.
- The loader's code is cut by build flags (`src/features.ts`, `runtime/features.ts`, `HAS_BLOCKS`, `HAS_LISTENERS`), so a page that does not use a feature ships none of its code.

## Prior art

Pinned SHAs: next.js `7ea592082e63`, astro `c7a2f1d16a08`, partytown `edfc4903af3e`, nuxt/scripts `8ad678b0775f`, qwik `da40f0f9916d`.

| Choice | Next.js | Astro | Partytown, Qwik | Nuxt Scripts | Decision |
| --- | --- | --- | --- | --- | --- |
| Mark | `<Script src strategy>` component ([script.tsx](https://github.com/vercel/next.js/blob/7ea592082e63e9a2af8ac388d6a24bc4d9373581/packages/next/src/client/script.tsx)) | plain `<script>` is bundled; `is:inline` keeps it as written ([docs](https://docs.astro.build/en/reference/directives-reference/#isinline)) | `type="text/partytown"` keeps the browser from running it ([snippet.ts](https://github.com/BuilderIO/partytown/blob/edfc4903af3e7031ba7bbe6f20ee1b6c408882ec/src/lib/main/snippet.ts)) | `useScript(src, { trigger })` composable ([useScript.ts](https://github.com/nuxt/scripts/blob/8ad678b0775ffe7a9190661368199320b183f71a/packages/script/src/runtime/composables/useScript.ts)) | The script tag with `src` or `inline`, as the proposal names. `trigger` is an attribute, since brumate has no script component. |
| Delay | `afterInteractive` after hydration, `lazyOnload` in `requestIdleCallback` | none built in | worker thread | `onNuxtReady`, `visible`, `interaction`, `idle`, a promise | `idle`, `visible`, `interaction` as the proposal says. `load` is also accepted, as for `$client`. The server writes the script inert, the loader starts it. |
| Inline | `<Script id>` with children; `id` dedupes | `is:inline` | the same tag with text | `useScript` has no inline form | `<script inline>`, the proposal's mark. |
| Run once | `id` or `src` in a load cache | none | none | the key of the script | Once per page by the resolved `src`, or by the text of an inline script. |
| Navigation | scripts stay in the document | `data-astro-rerun` opts in | none | the script stays loaded | The scripts stay (a page is one document). `data-rerun` is not combined with `trigger`. |
| Worker | `strategy="worker"` | none | Partytown | none | Not offered. A worker needs a proxy for the DOM, which is a project of its own. |

## Decisions

- Inline scripts (the proposal's open question): `<script inline>` marks a script written in the file. Its text is plain JavaScript that the compiler does not parse and does not interpolate, read up to `</script>`, so it is not the script of a component. It takes the same `trigger`. Astro's `is:inline` and Next's `<Script id>` with children show the same need; the mark is `inline` as the proposal writes it.
- `src` and `inline` together are an error. A `src` script with text inside is an error. A script with `trigger` and neither mark is the existing error. `trigger` must be a plain string. `visible` in `#head` is an error, since no element follows it. `trigger` with `data-rerun` is an error.
- The compile errors take the next free BRM codes from brumate-check.
- Other attributes pass on as written: `async`, `defer`, `type="module"`, `integrity`, `crossorigin`, `referrerpolicy` and `data-*`. They may be expressions, as on any element.
- In `#head` without `trigger`, the script renders as an element, with the nonce of the render, and `updateHead` keeps it by its HTML as it does today. Where the HTML needs it, `data-rerun` stays the opt-in to run again.
- With `trigger`, or anywhere in markup outside `#head` (also a script that has no `trigger`, where `load` is the default): the server writes `<template b-script="trigger">` with the script inside, with the nonce. A template is inert in the head and in a block that the browser clones, and it follows the `b-client` and `b-defer` pattern the loader already scans. The loader makes a script from it when the trigger fires, copies its attributes and nonce, and appends it to the head. `visible` watches the element after the template, as `$client` does (`boot.ts:430-448`).
- `interaction` fires on the first `pointerdown`, `keydown`, `touchstart` or `scroll` of the window (passive, once). It exists for scripts only; `$client` does not get it.
- A page runs a script once. The key is the resolved `src`, or the text of an inline script. A second template with the key, in another block or after a navigation, does nothing. A navigation to a page whose template is new fires its trigger; the loader scans the new head and body as it scans a rendered block.
- Trusted Types: the loader sets `script.src` through a new `createScriptURL` of the `brumate` policy, which passes the URL as it is, as the other two methods do. The policy method and the loader code are behind a build flag `scripts`, so a build without a script that has `trigger` or sits in markup has 0 added bytes. Sites with the policy already allow `trusted-types brumate`.
- The script of another site is outside the core's trust: brumate adds no `integrity`. `website/docs/reference-security.md` says so and points to `integrity` and `crossorigin`.
- No-JS readers: a triggered script does not run without the loader, which is the intent. An untriggered script in `#head` runs as plain HTML.

## Steps

- [ ] Parser and check: `<script src|inline>` in markup, `#head` and block bodies as an element node; the errors above; types for `trigger` in `elements.d.ts`.
- [ ] Server render: the plain element in `#head`, the `<template b-script>` form elsewhere, with the nonce.
- [ ] Browser render: the same template from a block that the browser renders; the `scripts` feature flag in `features.ts`.
- [ ] Loader: the three triggers and `load`, the once-per-page key, `createScriptURL`, a scan of the head after a navigation.
- [ ] Docs: a section "Scripts of other sites" in `website/docs/navigation.md` next to "Scripts in the head", `reference-security.md`, `docs/decisions.md`, a minor changeset.

## Acceptance

- [ ] `<script src="https://…" trigger="idle">` in `#head` renders `<template b-script="idle">` and no `<script src>`; the browser requests the file only after the page is idle. A test in a real browser (`e2e/suites/scripts.mjs`) reads the network log and a global the script sets.
- [ ] The same for `visible` (the file is requested only after the element after it scrolls into view) and `interaction` (only after the first pointer, key or scroll).
- [ ] An inline script with `trigger` runs once at its trigger, with the nonce; under a Content Security Policy with the nonce, `require-trusted-types-for 'script'` and `trusted-types brumate`, both forms run and nothing is refused.
- [ ] A script in a block that opens, in two blocks with the same `src`, and on two pages after a client navigation, runs once.
- [ ] A page without such a script has no `b-script`, no new loader code and no `createScriptURL`: `pnpm bench --only brumate --scenario todos` gives the same gzip JS as `release/0.9`, and the diff of the website build's client bundle is empty. Added bytes on a page that does not use the feature: 0.
- [ ] Each error above has a test that names the fix.
- [ ] An untriggered `<script src>` in `#head` runs as before and is kept by a client navigation; with `data-rerun` it runs again.
- [ ] Docs, `docs/decisions.md` and a minor changeset (new API).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`, then the tests of the node. Report the todos gzip size in the outcome.

## Sizing

M: parser, check, server and browser render, loader, Trusted Types and navigation, with errors and a real-browser test. One change, since each part is small and they share one template form.

## Notes for the worker

- `style-files` (another branch) also edits `navigate.ts` to wait for stylesheets before the swap. Keep your edit to `updateHead` and the scan after the swap; merge `release/0.9` before you open the PR.
- `head-rerun-scripts` (done) changed the same `updateHead`; read its test `packages/brumate/test/head-rerun.test.ts` first.
- `view-transitions` also edits `navigate.ts` and `elements.d.ts`; no edge, since the edits are in different functions.
