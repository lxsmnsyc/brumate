# Checkpoint 2026-10-28, wave 11

## Merged

- ui-landing (#316): /ui is a landing page with two live demos and a table of the JS a page ships per part. The introduction moved to /ui/introduction and the grid of cards to /ui/parts. `website/scripts/measure-ui-sizes.mjs` makes the table: JS only, gzip, first server render. The first cut missed a part bundled into the page's own chunk (Checkbox +0.04 kB, really +4.3 kB); the review caught it.
- camel-event-names (#317): handlers of multi-word events are camel case only. The lower-case form is a compile error (now BRM180) whose message names the camel form. `ElementEventNames` names custom events (`itemaction: 'ItemAction'`). 92 events, checked against the DOM event maps by a type-level test. `createForm` attrs has `onFocusOut`. -31% instantiations in packages/ui (7.77M to 5.33M), check time about 10 s to 8 s.
- brumate-check (#318): `brumate check [--json]` prints compile and type errors, one JSON line each, with a code and a link. Every catalog entry has a stable code (BRM001 to BRM180), pinned by test/error-codes.json. The language server sets the LSP `code` and its link. Links go to https://brumate-docs.vercel.app/docs/errors, a generated page.

## Decisions (the maintainer)

- element-types v1.3: camel-case handlers only, `ElementEventNames` exported.
- The docs domain for error links is brumate-docs.vercel.app, in one constant (`DOCS_SITE`).
- A break in a 0.x package is a minor bump. The orchestrator should not ask about it.

## Follow-ups (not yet nodes)

- `brumate check` spawns brumate-tsc and parses its text; an in-process API in packages/tsc would replace it.
- `onDOMContentLoaded` compiles to `domcontentloaded`, which the browser never fires (on main before #317).
- Website e2e fails on main: a /docs/control-flow sample logs "Not connected", and /ui/calendar, list-box, grid-list and tree have scrollable regions that cannot take focus (axe `scrollable-region-focusable`). CI does not run e2e.
- The sizes table on /ui is static.

## Notes

- A failed `pnpm build` in a worktree (from `e2e/run.mjs` without `--no-build`) rewrote the root shims to point into that worktree. Run e2e in a worktree with `--no-build` after building by hand.
- Two PRs that each add a catalog entry collide on the next code; the second to merge renumbers its own entry.

## Next

- `plan.py ready`: aria-types (types); changeset-review, ui-skill (ui-0.1); llms-txt (agent-skill); search-params; the core-correct should nodes.
