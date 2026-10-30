# Outcome: i18n-locale-change

## Built

- `packages/ui/src/NumberField.brm` and `packages/ui/src/ColorField.brm`: an effect on a locale memo rewrites the input text in the new format.
- `packages/ui/test/i18n-locale-change.test.ts` with `fixtures/i18n-locale-change.brm`: one provider switches to de-DE; checks Meter, ProgressBar, NumberField, Slider output and thumb, ColorField, Calendar heading.
- `website/ui/demos/I18nProviderDemo.brm` switches the locale of one provider; `website/ui/i18n-provider.md` says the locale can change.
- `.changeset/i18n-locale-change.md` (patch).

## Deviations

- The brief says a Meter did not follow. On main a Meter in a provider with a signal locale already follows it (probe passed). Only NumberField and ColorField failed, so only they changed. The earlier report was likely the demo's static locale prop.

## Stubs left

- None.

## Gotchas

- A part that keeps formatted text in a signal needs an effect on the locale; memos follow it by themselves.

## Proposed learnings

- A part that formats into a signal must rewrite it when the locale memo changes | memos follow the context, signals do not | packages/ui/src | yes

## Verification

- `npx vitest run test/i18n-locale-change.test.ts` in packages/ui: fails on main, passes.
- lint, format:check, typecheck: see the pull request.

## Size

- Estimated S, actual S.
