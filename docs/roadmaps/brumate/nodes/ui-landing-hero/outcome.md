# Outcome: ui-landing-hero

/ui is now a marketing page in the style of the home page, with no docs sidebar.

- `website/src/routes/ui/index.brm`: the page. Sections: hero (eyebrow, h1, lead, Get started and All parts, install line), a framed stage with live parts (button, switch, checkbox), "You pay for the parts you render" with the sizes as bars, rows for Unstyled (CSS), Accessible (live tabs and dialog) and Resumable (usage code), the card grid of every part at `/ui#parts`, and a closing call to action.
- The card grid moved here from `/ui/parts`. Every card has the same size and every preview area the same height and width, with the demo centered and clipped (`website/src/routes/ui/_layout.brm`). `website/ui/parts.md`, its sidebar entry and the Parts link of the header are removed. Links to the grid go to `/ui#parts`. `./index.md#parts` in Markdown resolves to it.
- `website/src/components/UiLandingSizes.brm`: the sizes as bars, loader and core in one color, parts in another. The numbers are in `website/src/ui-landing.ts`, from `node scripts/measure-ui-sizes.mjs`. They are static until someone runs the script.
- `website/src/styles.css`: the hero, section, row, browser frame, feature and cta rules moved here from `website/src/routes/index.brm`, so both pages share them. The home page looks the same; its screenshots differ only in the animated strips. `.eyebrow` is scoped to `.home`, since the REPL has its own.
- `website/src/components/DocsShell.brm`: a `bare` prop hides the sidebar at exactly `/ui`. An `#if` in the layout pulled every demo into the client build, so the shell stays and hides.
- `website/ui/index.md` is removed, and `Start` in `website/src/ui.ts` no longer lists it. The search index no longer has the old landing text.
- `e2e/suites/website.mjs`: the /ui flow checks the hidden sidebar, that a switch works, that all cards have one size, and runs axe on the page. Only `.button.primary` and `.brand-section` are excluded from axe, since their colors fail contrast and a separate fix from main corrects them.

Open: the sizes are static. The footer claim in the root layout is left to a separate fix. No changeset, since no published package changed.
