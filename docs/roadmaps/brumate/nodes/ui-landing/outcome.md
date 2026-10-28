# Outcome: ui-landing

/ui is now a landing page. The introduction and the grid of cards moved to their own pages.

- `website/ui/index.md`: the landing page, with two live demos (press, switch and checkbox; tabs with a dialog), what unstyled, accessible and resumable mean, and a table of what a part ships.
- `website/ui/introduction.md`: the old introduction. It said the first press loads the code of a part. The page code loads at start, so the text now says so.
- `website/ui/parts.md`: the grid of cards.
- `website/src/ui.ts`: the Start group lists Overview, Introduction and All parts. The search index reads the new Markdown files by itself. The header link "Parts" goes to `/ui/parts`.
- `website/scripts/measure-ui-sizes.mjs`: measures the gzip JS that a page loads for a part. Numbers on the landing page: no part 23.3 kB, Checkbox +0.04, Button +4.6, Tabs +10.4, closed Dialog +14.3, closed Select +25.2 kB.

Open: the sizes are a static table, so they go stale until someone runs the script. The demo sources on the landing page are long. No changeset, since no published package changed.
