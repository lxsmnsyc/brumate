# Outcome: dock-docs

## Built

- `website/docs/inspect.md`: the Devtools section is rewritten. It covers the grip, opening and closing, sides and resizing (edge and split handles, kept between pages), the header (Search, Pick, Outline updates, footer), the four workspaces (Inspect with Values and Graph, Activity, Issues, Page), server call details with the security note on `x-brumate-dev`, and the canvas outlines. The rest of the page is unchanged.
- `.changeset/new-dev-dock.md`: `brumate`, minor.

## Deviations

- `website/docs/reference-server.md`: "devtools button" became "devtools grip" (one word).

## Stubs left

None.

## Gotchas

- The Page workspace has no components table, and the old Report, Timeline, Effects, Navigation and Server tabs are gone. The page names none of them.

## Verification

- `pnpm --filter website build`: pass (after `pnpm --filter brumate build`). `pnpm format:check`: pass.
- plain-writing checker: warnings for sentences over 25 words only; the page's older sections have the same.

## Size

- Estimated S, actual S.
