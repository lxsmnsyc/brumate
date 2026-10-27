# Checkpoint 2026-10-28, wave 10

## Merged

- template-context-types (#313): an untyped `#template` passed to a prop is written inline at each use, so its parameter takes the prop's type and errors map to the .brm. A mapped declaration keeps hover, definition and rename. The TypeScript plugin dedupes repeated diagnostics. The website demos are now type-checked. +0.03% instantiations.
- ui-date-i18n (#314): placeholders, segment names and labels of the date parts in English, German, French, Spanish, Japanese and Chinese (Simplified and Traditional). I18nProvider picks the strings on the server, so only the page's language ships. Calendar's today starts from the server's date in the app's zone, then follows the browser's. +130 to +472 B gzip, within 0.5 kB.
- dynamic-tag-types (#315): `<{tag}>` checks attributes, `ref`, handlers and spreads against an element name or a component's props. 58 of 59 `currentTarget as` casts are gone. Shared types moved to the internal types entry `brumate/check`, which brought the check time from +15% to +3%.

## Decisions

- DateField and DateRangePicker do not follow the browser's today after load (8 B over budget); a documented limit for now.
- Spread names on a dynamic tag, and spreads on a generic `AsTarget` tag, are not checked (cost or false errors). A union of tags accepts an attribute valid on any of them.

## Added nodes

- could: static-contexts (smaller-client): a context set once on the server should not count as live in the browser.

## Notes

- Type-check cost hides in places the instantiation count misses: a conditional alias in the per-file prelude cost 15% of check time at +0.8% instantiations. Measure check time and the assignability cache, not only instantiations.
- Measure a change where it applies: the first cost of #313 was taken in packages/ui, which had no untyped template.

## Next

- `plan.py ready`: camel-event-names, aria-types (types); changeset-review (ui-0.1); brumate-check, llms-txt (agent-skill); the core-correct should nodes.
