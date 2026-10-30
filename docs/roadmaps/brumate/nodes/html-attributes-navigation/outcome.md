# Outcome: html-attributes-navigation

## Built

- `packages/brumate/src/runtime/navigate.ts`: a navigation removes only the `<html>` attributes that the `b-html` of the current page names and the next lacks, and sets the next page's attributes. Attributes that scripts added stay.
- Test "the attributes of <html>" in `packages/brumate/test/navigate.test.ts`. It fails on main.
- E2e step "/docs: the theme survives client navigation" in `e2e/suites/website.mjs` (link, then back button).
- Docs: `website/docs/navigation.md`, section "The attributes of `<html>`".
- Changeset `.changeset/html-attributes-navigation.md` (patch, brumate).

## Deviations

- The server adds `b-html` to the `<html>` tag (`packages/brumate/src/runtime/server.ts`, `nameHtmlAttributes`), listing the attribute names it sent. The client reads it from the current page and holds no state, so the first navigation removes the first page's attributes too. Cost: about 15 bytes per page (` b-html="lang"`, longer with scope attributes); the client is smaller than the first version.
- The docs are in `website/docs/navigation.md`, which the brief's paths do not list. `server.ts` and `test/render.test.ts` are outside the brief's paths too.

## Stubs left

- None.

## Gotchas

- A value that a script changed on an attribute the pages send is replaced by the next page's value.

## Proposed learnings

- None.

## Verification

- Unit test fails on main, passes on the branch.
- E2e website suite on main: the new step fails ("the theme is undefined after a link"). On the branch: 70 passed, 1 failed (known flake `/docs/control-flow: 10 live samples render`).
- `pnpm lint` (no new warnings), `pnpm format:check`, `pnpm typecheck` pass. `pnpm --filter brumate test`: one run had 3 failures in one file, a rerun showed none.
- Todos client JS: 80.0 kB / 28.6 kB on both. Unit tests for the first navigation and for `b-html` in `render.test.ts`.

## Size

- Estimated S, actual S.
