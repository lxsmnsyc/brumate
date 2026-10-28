# Outcome: camel-event-names

## Built

- The parser reports the lower-case form of a multi-word handler (`onKeydown`, `onFocusout`) on an element, `<window>` and `<document>`: `"onKeydown" is not an event name. Write "onKeyDown"`, at the attribute, also for the `{onKeydown}` shorthand. Catalog entry added in src/error-catalog.ts, errors.md regenerated. The list of events is packages/brumate/src/event-names.ts.
- packages/brumate/elements.d.ts: the `CamelEvent` union is now `ElementEventNames`, an exported interface from the lower-case event to its camel word (`keydown: 'KeyDown'`). `Handlers` is one mapped type with one key per event, so `onKeydown` is no longer an attribute in the types either (a dynamic tag and a spread report it as an unknown attribute).
- Custom events: an app merges `ElementEventNames { itemaction: 'ItemAction' }` next to `ElementEvents`. `@brumate/ui` does it for `itemaction` and `toastchange`. An event with no entry keeps its one-word name.
- Renamed: `onFocusout` in createForm attrs (public API, in the changeset), website Search.brm and forms.md; `onItemaction` and `onToastchange` in ui. `git grep` finds no lower-case multi-word handler left.
- Tests: tsc fixture EventCase.brm (camel names, merged event, `<window>`), EventCaseKeydown.brm and EventCaseFocusout.brm (the compile error, asserted on stderr); parser tests; test/event-names.test.ts keeps the compiler list equal to the interface; elements-types.ts has `@ts-expect-error` for `onKeydown` and the lower-case custom event.

## Decisions

- Compiler error, not only types: the message names the camel form at the attribute, which the TS error ("does not exist in type") does not. Components and dynamic tags are not checked by the parser: a component takes any prop name, and a dynamic tag's names go through the types.
- The compiler list is static, so a custom event's lower-case form is a type error only. Recorded in docs/decisions.md.

## Numbers

`brumate-tsc --noEmit --extendedDiagnostics` in packages/ui, origin/main elements.d.ts against this branch:

- Instantiations 7,770,809 to 5,332,985 (-31%). Types 235,792 to 231,576.
- Check time, three runs each (machine shared): main 8.83, 8.35, 9.74 s; branch 6.81, 7.86, 6.94 s. The old `Handlers` had two mapped types, one with a conditional per camel name.

## Follow-ups

- A custom event with no `ElementEventNames` entry still takes the lower-case attribute (`onItemaction`).
- `$$on` in the generated check code checks the lower-cased event name, so a plain element accepts a custom camel name even without an entry.
