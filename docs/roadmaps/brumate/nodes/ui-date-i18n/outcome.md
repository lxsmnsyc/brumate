# Outcome: ui-date-i18n

## Built

- `packages/ui/src/date-strings.ts`: `DateStrings`, a table for en, de, fr, es, ja and zh, `stringsOf(locale)`, and `DateStringsContext`. Placeholders follow what browsers show in their date inputs. Segment names come from `Intl.DisplayNames` with English as the fallback. A language with no table shows English.
- `I18nProvider` takes `timeZone` and `strings`. It looks up the table on the server and sets `DateStringsContext`. `strings` replaces the whole set.
- DateField, TimeField, DateRangePicker, DateSegment, DatePicker and Calendar read the strings from the context. English words stay as fallbacks outside a provider.
- Calendar takes `timeZone`. Today starts as the server's date in that zone (or the I18nProvider's, or the server's own). `watchToday` in calendar.ts then sets the browser's date on idle, when the tab shows, and at each minute, so the highlight moves at midnight.
- `packages/ui/test/date-i18n.test.ts` and `test/fixtures/date-i18n.brm`: 11 tests. Docs: `website/ui/date-field.md`, `calendar.md`, `i18n-provider.md`. Changeset `.changeset/ui-date-i18n.md`.

## Deviations

- The timer wakes at each minute boundary and not at a computed midnight. It moves the date within 50 ms of midnight in any zone, and it saves 65 B gzip.
- Only the Calendar tracks today in the browser. DateField and DateRangePicker start an empty segment at the date of the server, in the I18nProvider's time zone when it has one. A signal in each field cost about 0.4 kB.
- `timeZone` is a prop of Calendar and RangeCalendar and of the I18nProvider, not of DatePicker. A Calendar in a DatePicker takes it from the I18nProvider or its own prop.
- Only the Calendar cell labels, Buttons and segment texts are localized. The `Text` and `Label` of a page stay the app's own.

## Stubs left

- None.

## Gotchas

- A part must never call `stringsOf` or import the table in code that runs in the browser: every `$getContext` value counts as changeable on the client, so the call would ship all languages. Only `I18nProvider` calls it.
- `$effect` does not run at load. Use `$client(fn, 'idle')` for work that must start on load.
- `getLocalTimeZone()` caches the zone of the browser. A test changes it with `setLocalTimeZone`.
- A non-Gregorian calendar, and a label overridden one at a time, are still out of scope.

## Proposed learnings

- A string that a part shows in the user's language comes from a context set by a provider on the server, never from a table looked up in the part | a part that reads a context ships the code of everything it calls | packages/ui/src | no
- Fake only `Date` when a test needs a mocked clock with a mount | faking `setTimeout` stops the loader and `waitFor` | packages/ui/test | no

## Verification

- `npx vitest run test/date-i18n.test.ts` in packages/ui: 11 pass.
- Page with an I18nProvider (`de-DE`), a DatePicker and a Calendar, built with `npx vite build`: no German, French, Spanish, Japanese or Chinese word in any chunk.
- Other checks are listed in the pull request.

## Size

- Estimated M, actual M.
- gzip of the chunks of a DatePicker page: +482 B (budget 500 B).
