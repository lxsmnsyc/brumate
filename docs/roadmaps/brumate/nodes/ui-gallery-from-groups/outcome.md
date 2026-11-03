# Outcome: ui-gallery-from-groups

## Built

- Each part page in `website/ui/*.md` (63) has `summary:` in its front matter. `website/plugins/front-matter.ts` reads it (`splitFrontMatter`); `Page.summary` carries it.
- `website/src/ui.ts` no longer has `gallery` (-440 lines); `ui-landing.ts` builds `kinds` from `sections`, which now carry `summary`.
- `groups` is in `website/src/ui-groups.ts`.
- The `brm gallery` fence is gone from markdown.ts, llms.ts, DocPage.brm; `.ui-gallery` is gone from `_layout.brm`.
- `website/test/ui-groups.test.ts`: fails for a page in no group or in two, a name in a group without a page, a part without a summary. llms test checks no front matter in the Markdown.

## Deviations

- `groups` moved to the new `website/src/ui-groups.ts` (shared path `website/src/**`); the brief kept it in `ui.ts`. Reason: ui.ts cannot load in the Node tests. Adding a part still touches one line in `groups`.
- Also edited `website/plugins/llms.ts` and `search.ts` (outside the owned list): they read the raw files and must skip front matter.
- Front matter field is `summary`, not `description`.

## Stubs left

- None.

## Gotchas

- `:global(.ui-card*)` rules in `routes/ui/_layout.brm` are now unused; left for ui-preview-center, which edits that file.
- Front matter is plain `key: value` or a JSON string, not full YAML.

## Proposed learnings

- A new part page needs `summary:` in its front matter | the card reads it | website/ui | yes (ui-groups.test.ts)

## Verification

- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm --filter website check:samples` (65 samples, 0 problems), website tests (all pass), `pnpm --filter website build` pass.
- Built `dist/client/ui/index.html`: all 63 summaries and links present, in group order. Compared against the old `gallery` data, not a browser screenshot.

## Size

- Estimated S, actual S.
