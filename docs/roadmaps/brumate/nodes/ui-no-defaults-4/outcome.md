# Outcome: ui-no-defaults-4

## Built

- Twenty-two contexts lost their default, in `packages/ui/src`:
  - `contexts.ts`: `DisclosurePanelContext`, `DisclosureGroupContext`, `OverlayTriggerContext`, `ModalOverlayContext`, `ColorSwatchContext`, `ColorPickerContext` (and the `noPicker` constant, now unused, is gone).
  - `calendar.ts`: `DatePickerContext`, `CalendarContext`, `CalendarGridContext`. `date-strings.ts`: `DateStringsContext`. `segments.ts`: `DateFieldContext`, `DateRangeFieldContext`.
  - `color-thumb.ts`, `color-wheel.ts`, `transition.ts`, `tabs.ts`, `tags.ts`, `slider.ts`, `tooltip.ts`, `toast.ts` (`ToastRegionContext`, `ToastContext`), `selection-indicator.ts`.
  - No `createContext` in `packages/ui` passes a default now.
- Readers (37 `.brm` files: Calendar, CalendarCell, CalendarGrid, CalendarHeading, ColorArea, ColorField, ColorSlider, ColorSwatch, ColorSwatchPicker, ColorThumb, ColorWheel, ColorWheelTrack, DateField, DateInput, DatePicker, DateRangePicker, DateSegment, TimeField, Dialog, Modal, ModalOverlay, Popover, Disclosure, DisclosurePanel, SliderOutput, SliderThumb, SliderTrack, Tab, TabList, TabPanel, Tag, TagList, Toast, ToastContent, Tooltip, Transition, SelectionIndicator): each read is `$hasContext(C) ? $getContext(C) : undefined` or `... ? $store(C) : undefined`, and each `$store(x.state)` of a guarded `x` carries the same guard. `$hasContext` is added to the `brumate/signals` import. Handlers read `x?.handler`.
- Fallbacks: none is built and no module-scope constant is added. A reader without a provider sees `undefined` where the old default gave `null` or `{ state: store(null) }`.
- Three readers needed a value, not a `?.`:
  - `Calendar.brm`: `strings: strings ?? null` (the state expects `null`); `autoFocus: Boolean(picker)` (it was `picker !== null`, which is true for `undefined`).
  - `DateInput.brm`: the `field` memo ends with `?? null`, so `$toStore(field)` stays `StoreLike<... | null>`.
  - `ColorField.brm`: `given!.setValue!(...)` under `picker && ...`; a picker store exists only with its given.
- `.changeset/ui-no-defaults-4.md`: `@brumate/ui`, minor.

## Result

Not an experiment node.

Example client JS (`examples/ui`, `vite build --outDir dist/client`, gzip -9 summed over every `.js`): 203,362 B on the base (675423f8, rebuilt), 203,374 B after (+12 B).

Across the four groups: 203,133 B before group 1, 203,374 B after group 4 (+241 B). Group 3 measured 203,132 B and 203,352 B by its own build; this run's base reads 203,362 B, so the sums differ by about 10 B between runs.

## Deviations

- `node e2e/run.mjs --only ui` runs `pnpm build` first, which this machine must not run (and pnpm refuses the linked `node_modules`). I built `packages/brumate`, `packages/language-core` and `packages/tsc` with `npx tsdown`, then `examples/ui` with the two `vite build` steps of its `build` script, and ran the suite with `--no-build`. No file outside the shared paths changed.

## Stubs left

- `examples/tracker/src/user.ts` still passes a default: `createContext<string | undefined>('user', undefined)`. Its typecheck fails with TS2554. It is outside `packages/ui`; the context-docs node or a follow-up must fix it.
- `packages/vscode` typecheck fails with TS2307 on `@brumate/language-server` (its `dist` is not built here); not related to this node.

## Gotchas

- A script handled the 22 `createContext` edits and the reader rewrite; `brumate-tsc` then listed every handler to change as TS18048, and a second script turned `x.` into `x?.` at the reported columns.
- A comparison to `null` on a guarded variable is wrong without a provider (`undefined !== null`); `grep` for `=== null` and `!== null` on each one. Only `Calendar.brm` had one.

## Proposed learnings

- None new beyond ui-no-defaults-1's.

## Verification

- `brumate-tsc --noEmit` in `packages/ui`: 0 errors (22 TS2554 before). Typecheck of every other package and example that has the script: pass, except `examples/tracker` (above) and `packages/vscode` (above).
- `npx vitest run` in `packages/ui`: 75 files; in the full run `table` and `preview` failed one test each; both pass alone. `token-field-sync` and `bind-kept-writes` passed in the full run and alone; `generics-markup` passes.
- `node e2e/run.mjs --only ui --no-build`: 55 passed, 0 failed.
- `npx oxlint`: 0 errors (warnings only). Root `npx oxfmt --check`: pass.

## Size

- Estimated M, actual M: 37 readers, 13 `.ts` files, a changeset.
