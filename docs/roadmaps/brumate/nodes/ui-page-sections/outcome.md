# Outcome: ui-page-sections

## Built

- Section order for part pages: Anatomy, Props, Data attributes, Keyboard, Controlled and uncontrolled, Styling, Use cases, then sections about the part (website/ui, 22 pages moved).
- `website/test/ui-sections.test.ts`: fails on a part page out of order (concept pages are skipped), on the headings Style, Rows from data and Keys and screen readers, and on a `brm` fence in ui or docs.
- Headings: Rows from data to Items from data (grid-list, table); Rows to Items (grid-list, tree); Keys and screen readers to Focus and keys (color-area); Style to Custom properties (color-area).
- Fences: the maintainer chose `brm` (2026-11-03). Every `.brm` sample fence in website/ui and website/docs is `brm` (686 fences, plain and demo, anatomy, styled, live), none `html`. llms.ts and its test emit `brm`; anatomy.test.ts reads `brm`. README files keep `html` for GitHub. The test fails on an `html` fence in ui or docs.
- Introduction: install line and a note that `brumate` is a peer dependency.

## Deviations

- Edited website/test/anatomy.test.ts, website/plugins/llms.ts and website/test/llms.test.ts (llms.ts is shared; the test is not listed) and website/docs/*.md (not listed) for the fence language.
- No "Accessibility" heading: Keyboard and Focus and keys cover it.

## Stubs left

- Missing Data attributes, Anatomy pictures and styled examples (dialog, file-trigger, form, color-picker, data, i18n-provider, keyboard and others) are not added: those parts have little to show. Not audited one by one.

## Gotchas

- `ModalContent` is internal (Modal's inner wrapper, one `children` prop, not documented); no props table.
- Special fences like `brm demo X` are matched as `(brm|html)` by the plugins, so both still work.

## Proposed learnings

- A new part page follows the section order of SECTIONS, then Use cases | ui-sections.test.ts fails otherwise | website/ui | yes
- `.brm` samples use brm fences | ui-sections.test.ts | website | yes

## Verification

- `pnpm lint` (warnings only), `pnpm format:check`, `check:samples` (66 samples, 0 problems), website tests (336 pass), `pnpm --filter website build` pass.

## Size

- Estimated M, actual M.
