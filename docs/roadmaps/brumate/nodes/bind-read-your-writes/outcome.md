# Outcome: bind-read-your-writes

## Built

- Runtime: a write to a prop bound with `$bind(signal, fn)` reads back the kept value in the same turn. `callNow` in `packages/brumate/src/runtime/client/references.ts` runs a loaded setter at once, in a pass, when no earlier call waits. `set` in `client/updates.ts` then calls `flush()`, so the update of the prop runs before the write returns.
- Test: `bound props read their writes` in `packages/brumate/test/resume.test.ts`, with `test/render/bindReadYourWrites.brm` and `BindReadChild.brm`. It fails on main (the child reads `0`, not the rounded `2`) and passes now.
- @brumate/ui: the parts with a change handler (TextField, SearchField, NumberField, ColorField, ColorPicker, ColorSlider, ColorArea, ColorWheel, DateField, DatePicker, DateRangePicker, TimeField, Slider, Switch, Checkbox, CheckboxGroup, RadioGroup, ToggleButtonGroup, TokenField, Select, ComboBox, Tabs, ListBox, GridList, Table, Tree, TagGroup, Menu) call the handler with the kept value, only when it differs from the value before the write, at once and in the same event.
- TokenField: `setValue` bumps `revision` when the setter kept other segments, so the box shows the kept ones. The refused-edit test in `token-field-sync.test.ts` is `it`, not `it.fails`.
- `change-handlers.test.ts`: rounding gives the rounded value, refusing gives no call, and an accepting setter reports like an own state. `combobox-fixes.test.ts` (c) expects no handler call on a refused pick.
- Docs: `docs/decisions.md` (the handler rule), `website/ui/state.md`, `website/ui/token-field.md`. Changeset `.changeset/bind-read-your-writes.md` (patch).

## Deviations

- The brief says `afterWrite` in `fields.ts` keeps its synchronous branch. `afterWrite` no longer exists on main (it was dropped in ui-refused-write-sync), so `fields.ts` is unchanged.
- TextField and SearchField keep the exception in `website/ui/state.md` and `docs/decisions.md`: the native input keeps the typed text after a refused edit. Writing the kept text back would drop the typing of a setter that accepts later. The brief names only TokenField.
- The brief's ui change is wider than a few parts: 28 parts changed, because every part with a handler had the "value that was asked for" rule.

## Stubs left

- None.

## Gotchas

- A setter that throws now throws into the code that wrote the prop, not into an unhandled promise.
- The update of the prop runs at the write of a setter-bound prop, not at the end of the handler. Writes after it in the same handler see it.
- `window.event` is not set in happy-dom, so the test compares an accepting setter with an own state, not with `input`.

## Proposed learnings

- Read the value back after a write to a bound prop, and report the kept value | a `$bind` setter decides what is kept | packages/ui/src | no

## Verification

- `pnpm lint` (no new warnings; the ones in updates.ts and resume.test.ts are on main), `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter brumate test`: 61 files, 1247 tests pass. `packages/ui` all 71 files pass (1 expected fail in as-controls, unrelated).
- Todos scenario, client JS in dist: 79.8 kB / 28.5 kB gzip, main 79.6 kB / 28.4 kB gzip (+0.1 kB gzip).

## Size

- Estimated M, actual M.
