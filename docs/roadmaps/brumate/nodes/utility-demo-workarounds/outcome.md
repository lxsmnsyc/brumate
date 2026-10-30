# Outcome: utility-demo-workarounds

## Built

- `website/ui/demos/I18nProviderLocaleDemo.brm`: one `I18nProvider` takes its locale from a signal; three Buttons set it.
- `website/ui/demos/I18nProviderDemo.brm`: static `ar-EG` Meter again, so the page has one locale switch.
- `website/ui/i18n-provider.md`: no text about the `#if` workaround; the intro links to "A locale switch".
- `website/ui/demos/SelectionIndicatorToggleDemo.brm`: `transition-timing-function: cubic-bezier(0.2, 0, 0, 1)`, as the `.ui-indicator` rule.

## Deviations

- The top demo of the page lost its buttons (the brief allowed "merge or drop the duplicate"). It could not be the one kept, since the e2e step clicks `de-DE` in the use-case demo.
- No changeset: `website` is in the ignore list of `.changeset/config.json`.

## Stubs left

- None.

## Gotchas

- Other pages (date-field, date-picker, calendar) still say "Two/Three providers give ... locales to one signal". They are about their own demos and were not touched.

## Proposed learnings

- None.

## Verification

- `pnpm --filter website check:samples`: 65 samples, 0 problems. `pnpm --filter website build`: pass.
- `pnpm lint` (warnings only, none in my files), `pnpm format:check`, `pnpm typecheck`: pass.
- `node e2e/run.mjs --only website`: see the pull request.

## Size

- Estimated S, actual S.
