# Log: ui-stores-calendar

- 2026-11-05: Read the story, the store API and the fields outcome. Contexts in scope: Calendar, CalendarGrid, DatePicker, DateField (DateField, TimeField, DateInput, DateRangePicker), ColorThumb, ColorWheel, ColorPicker, ColorSwatch.
- Shape: `{ state: store, ...handlers }` as in `InputField`. The handlers are literal keys.
- A default value of a context cannot hold a function (the server names the slot: "holds a Function"), because the browser reads the default through the slot. The first try had no-op handlers in the defaults and 37 tests failed. The handlers are optional in the types and the readers call `given.handler?.()`.
- A nested object of handlers (`start: { step }`) fails the same way, so `DateRangeFieldContext` has flat `startStep`... keys. DateInput forwards the handler of its slot through closures.
- `$store(range.start.state)` is not a source (a key of a key), so `DateRangeFieldContext` has two stores, `startState` and `endState`.
- DatePickerContext: `pickerGiven.isDateUnavailable` read in a function that CalendarCell calls while a browser-rendered Calendar mounts throws, because the slot of a `$getContext` value is not set yet. `pickerGiven?.isDateUnavailable` keeps the base behavior (on the base the optional chain on `picker?.` hid the same gap). Not fixed here.
- The field-stores test: handlers read state in their body, so the scan for the new contexts flags only a key whose value is a direct read of state (`isDisabled: $$b.get(...)`), except the forwarded `isDateUnavailable`. It fails on 8ad33cbf (many keys) and passes here.
- Left: ButtonContext of Calendar (previous, next), the ListBoxContext of ColorSwatchPicker, the SliderContext of ColorSlider, LocaleContext, DateStringsContext, TextContext, OverlayTriggerContext, which other nodes or no ui node own.
