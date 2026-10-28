# Outcome: ui-landing-hero

/ui is now a marketing page in the style of the home page, with no docs sidebar.

- `website/src/routes/ui/index.brm`: the page. Sections: hero (eyebrow, h1, lead, Get started and All parts, install line), a framed stage with live parts (button, switch, checkbox), "You pay for the parts you render" with the sizes as bars, rows for Unstyled (CSS), Accessible (live tabs and dialog) and Resumable (usage code), a grid of what the parts cover, and a closing call to action.
- `website/src/components/UiLandingSizes.brm`: the sizes as bars, loader and core in one color, parts in another. The numbers are in `website/src/ui-landing.ts`, copied from `node scripts/measure-ui-sizes.mjs` (the same numbers as ui-landing). They are static until someone runs the script.
- `website/src/routes/ui/_layout.brm` and `DocsShell.brm`: a `bare` prop hides the sidebar at exactly `/ui`. An `#if` in the layout pulled every demo into the client build, so the shell stays and hides.
- `website/ui/index.md` is removed, and `Start` in `website/src/ui.ts` no longer lists it. The search index no longer has the old landing text.
- `e2e/suites/website.mjs`: the /ui flows wait for the hero, check that there is no sidebar and that a switch works, run axe on the page (color-contrast off, since the white-on-accent primary button fails on the home page too), and read the sidebar links from `/ui/introduction`.

Open: the hero, section, row, browser frame and feature styles are copied from `website/src/routes/index.brm`, because they are scoped to that component. Moving them to `styles.css` would let both pages share them. No changeset, since no published package changed.
