---
id: head-rerun-scripts
title: A head script can ask to run again after each client navigation
status: active
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.8.0
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/head-rerun.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
spent:
owns:
  - packages/brumate/test/head-rerun.test.ts
shared:
  - packages/brumate/src/runtime/navigate.ts
  - website/docs/navigation.md
  - e2e/suites/website.mjs
  - docs/decisions.md
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# A head script can ask to run again after each client navigation

## Goal

A `<script data-rerun>` in the head of a page runs again after every client navigation to a page that has it, once the new page is in place. Other head scripts keep their behavior. The attribute is an opt-in, like `data-reload` and `data-prefetch` on links (website/docs/navigation.md).

```brm
{raw(`<script data-rerun>document.documentElement.dataset.visits = String(Number(localStorage.visits || 0) + 1)</script>`)}
```

## Context

- `updateHead(next)` (packages/brumate/src/runtime/navigate.ts:509-535) keys the current head children by `outerHTML`, keeps an element whose HTML the next page has too, adds the ones that are new (`adoptNode`), and removes the ones the next page lacks, except scripts with `src` and `b-bundle` elements. A kept inline script is not run again. The call site is navigate.ts:832, before the body is replaced.
- A script moved with `adoptNode` from the `DOMParser` document may not run at all: `runnable(script)` (navigate.ts:464-483) exists because "scripts from a parser that has no window do not run", and the body paths use it (navigate.ts:254, 502, 846). Probe in a real browser what a new, changed head script does today; do not change it for scripts without the attribute.
- In `.brm`, `<script>` is not valid markup (BRM010 and the top-level script rules, parser.ts:235-241). A head script comes from `raw(html)`, as the theme script does (website/src/scripts.ts:5, website/src/routes/_layout.brm:68). So the attribute is written inside an HTML string and no compiler or type change is involved. `data-*` is open in `GlobalAttributes` (packages/brumate/elements.d.ts:527), and brumate's own loader attributes are plain `data-*` (`data-reload`, `data-prefetch`, `data-navigating`). Event attributes are camelCase (docs/decisions.md, camel-case entry); that rule does not apply to an attribute.
- The case that found it (html-attributes-navigation, done, 2026-10-30): the page-state script did not run again after a navigation. That node now keeps `<html>` attributes that scripts set, so a theme script is not the main user; scripts that read per-page state (a preference, the user, `document.body`) are.
- Prior art, checked 2026-11-09:
  - Astro opts in with `data-astro-rerun`: [`deselectScripts` in withastro/astro](https://github.com/withastro/astro/blob/a87d458a893f6444c2cfe1ec82bb5edab12a6544/packages/astro/src/transitions/swap-functions.ts) marks a script of the new page as executed unless it has the attribute. Docs: https://docs.astro.build/en/guides/view-transitions/#script-behavior-with-the-client-router.
  - Turbo runs every script of a new page and opts out with `data-turbo-eval="false"`: [`activateScriptElement` in hotwired/turbo v8.0.23](https://github.com/hotwired/turbo/blob/v8.0.23/src/util.js). Head elements that match the old head stay and do not run again, as in brumate today.
  - SvelteKit has no script attribute: code that must run after each navigation uses `afterNavigate` from `$app/navigation` (https://svelte.dev/docs/kit/$app-navigation#afterNavigate). Brumate's equivalent is `$navigation()` in a component; it cannot reach a script that has to run before first paint, which is why a script attribute is needed.
  - Qwik City: the worker confirms (https://qwik.dev/docs/) and notes whether any attribute exists; none was found when this brief was written.
- Chosen form: an opt-in attribute, not an event. An event would need a listener that the first script adds once, which works but cannot run a script that sets state before paint on a page whose script is new. The attribute also reads in the HTML the server sends, with no JavaScript API. `data-rerun` follows `data-reload`. The name is shorter than Astro's `data-astro-rerun` because brumate's loader attributes carry no prefix.

## Steps

- [ ] Probe in Chrome on `release/0.8` (an e2e step against the website build): navigate between two pages that share an inline head script, and between two that differ. Log whether each runs. Put the answer in the log; it decides whether `updateHead` needs more than the rerun.
- [ ] `updateHead`: a script with `data-rerun` in the next head is never kept. The old copy leaves the head, and a copy made with `runnable` is appended after the body of the new page is in place (so the script reads the new body), in document order, before the focus and scroll step. With `src`: the copy is re-requested from the cache; a module script does not run again (the browser keeps modules by URL), and the docs say so.
- [ ] Docs, e2e step, decision, changeset.

## Acceptance

- [ ] `packages/brumate/test/head-rerun.test.ts` (fails on main): a navigation to a page whose head has `<script data-rerun>` with the same HTML runs it again, once, after the new body is in the page; a script without the attribute is kept and does not run again; two pages that both have it run it on each navigation; a page without it removes it as before; the nonce handling of `runnable` is used.
- [ ] An e2e step in `e2e/suites/website.mjs` in Chrome: link, then back button, with a counter that the script writes to `window`. It runs on the link and on the back button.
- [ ] Docs: section "Scripts in the head" in website/docs/navigation.md: how to write it with `raw()`, when it runs, that a module script does not run again, and that the first load runs scripts as the browser does.
- [ ] docs/decisions.md has one entry with the form and the prior art above.
- [ ] A minor changeset for `brumate` (`.changeset/head-rerun-scripts.md`).
- [ ] The client size of the loader or core is unchanged for a page without the attribute within 50 B gzip (state the figure in the outcome; `navigate.ts` loads on the first navigation only).
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/head-rerun.test.ts test/navigate.test.ts`. Then `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `node e2e/run.mjs --only website`.

## Sizing

S. All low except uncertainty medium (script execution of adopted nodes differs in the browser and in the test DOM, so the e2e step proves it). One source file, one test file, docs.

## Notes for the worker

- Test DOMs (jsdom, happy-dom) may not run inserted scripts. Spy on `runnable`'s output or on the element that was appended, and let the e2e step prove the execution.
- Do not touch the body scripts or the `STATE` scripts.
- The `#head` block inserts markup with `insertHTML` on the client (runtime/client/page.ts:30-33); that path is not part of this node.
- Do not change the website's theme script; it does not need the attribute.
