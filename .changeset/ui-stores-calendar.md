---
'@brumate/ui': minor
---

Breaking for code that provides or reads these contexts itself. `CalendarContext`, `DatePickerContext`, `DateFieldContext`, `ColorThumbContext`, `ColorWheelContext` and `ColorPickerContext` hold `{ state, ...handlers }`: `state` is a `StoreLike` of the data they held before, and the functions are keys beside it, all optional. `DateRangeFieldContext` holds `startState` and `endState` stores and the handlers as flat `startStep`, `endStep` and so on. `CalendarGridContext` and `ColorSwatchContext` hold a `StoreLike` of the value they held. A plain value now throws "gives no store". To migrate, provide with `$setContext(Ctx, { state: $toStore(memo), onPress })` and read with `const given = $getContext(Ctx); const value = $store(given.state);`.
