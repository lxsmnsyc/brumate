# Outcome: ui-stores-fields

## Built

The field and form contexts of `packages/ui/src/contexts.ts` hold stores. The parts that read or provide them changed with them.

### The pattern

- Provider: a named memo of the value the context gave before, then `$toStore(memo)` as the value.
  - `const labelGiven = $memo({ id: labelId, for: id }); $setContext(LabelContext, $toStore(labelGiven));`
  - A memo must be declared at the top level (BRM132), so `$toStore($memo(...))` inline fails.
  - `FormContext` stores the memo `state` of Form directly.
- Reader: `$store(Ctx)` (one-way `const`).
  - `Label`, `FieldError`, `Group` and the `form` of every field: `const form = $store(FormContext);`.
  - A reader reads the same variable name as before (`context`, `state`, `form`), so the rest of the part did not change.
- Default: each of these contexts has `store(null)` as its default, so a part outside a field reads `null` as before. The six types are `Context<StoreLike<... | null>>`.
- `InputContext` and `TextAreaContext` hold `InputField`, `{ props: StoreLike<ContextValue<InputContextProps> | null> } & InputHandlers`. Attributes (and `isEnterPrevented`, `isEscapePrevented`) are in the store; the handlers (`onChange`, `onInvalid`, `onKeyDown`, `onFocus`, `onBlur`) are plain keys beside it. Input and TextArea do `const handlers = $getContext(InputContext); const context = $store(handlers.props);` and call `handlers.onChange?.(...)`.
- Checkbox forwards the label and the error of a CheckboxGroup: `const groupLabel = $store(LabelContext)`, then `const labelGiven = $memo(group ? groupLabel : { id: labelId })`, provided with `$toStore(labelGiven)`.
- What became props: nothing. What stayed plain: `TextContext` (a constant `{ slots: { description: { id } } }`, except the `aria-hidden` of Checkbox and Switch), the handler keys, ids.

### Files

- `packages/ui/src/contexts.ts`: the six contexts, `InputField`, `InputHandlers`.
- Readers: `Label`, `Input`, `TextArea`, `FieldError`, `Group`, and the `FormContext` read of `TextField`, `NumberField`, `ColorField`, `ComboBox`, `Select`, `DateField`, `DateRangePicker`, `TimeField`.
- Providers: `Form`, `TextField`, `SearchField`, `NumberField`, `Checkbox`, `CheckboxGroup`, `RadioGroup`, `Switch`, `Slider`, `TagGroup`, `TokenField`, `Meter`, `ProgressBar`, and (see Deviations) `ColorField`, `ColorSlider`, `ComboBox`, `Select`, `DateField`, `DatePicker`, `DateRangePicker`, `TimeField`.
- `packages/ui/test/fixtures/simple.brm` provides `LabelContext` with a store.
- `packages/ui/test/field-stores.test.ts`: for 26 parts, no `updateContext` of a field context reads state. The base fails it.
- `.changeset/ui-stores-fields.md` (`@brumate/ui` minor): the context shapes are public through `@brumate/ui/contexts.ts`.

## Result

Not an experiment node.

## Deviations

- Providers and `FormContext` readers in sibling-owned parts changed, at the lines of the six field contexts only: `ColorField`, `ColorSlider`, `DateField`, `DatePicker`, `DateRangePicker`, `TimeField` (calendar, date, color) and `ComboBox`, `Select` (collection, combobox, select). A reader of `$store(LabelContext)` needs a store from every provider, so the shared contexts could not move in halves. Their other `$setContext` calls and warnings are untouched.
- The brief's "no `updateContext` call from these parts" holds for changing values, not for handlers. A provider whose value holds a store and handlers still gets an `updateContext` in the client chunk (the handlers are read through a live `$getContext` slot, which static-contexts-final removes). The test checks that none of these calls reads state.
- `TextContext`, `FieldInputContext`, `CheckboxGroupContext`, `RadioGroupContext`, `SliderContext` and `TagGroupContext` were not moved (see Stubs left).

## Stubs left

Live-context uses (providers that still warn, readers that still use `$getContext`) in packages/ui after this node, in the parts that belong to no ui-stores node:

- `TextContext` (Text reader): `hidden` in Checkbox and Switch; the rest is constant.
- `CheckboxGroupContext` (Checkbox reader; providers CheckboxGroup, and GridListItem, Row, TableHeader, TreeItem of the collections node), `RadioGroupContext` (Radio, RadioGroup), `SliderContext` (Slider, SliderThumb, SliderTrack), `TagGroupContext` (Tag, TagList, TagGroup), `TokenFieldContext` (TokenField, TokenInput, Token), `ToggleGroupContext`, `DisclosureGroupContext`, `DisclosurePanelContext`, `TransitionContext`, `OverlayTriggerContext`, `ButtonContext` of NumberField, `LinkContext` of Breadcrumb(s), `LayerContext`, `TooltipTriggerContext`, `PreviewTrigger`, `Popover`, `ModalOverlay`, `Toolbar`, `Tabs`.
- `FieldInputContext` (read by Input and TextArea; provided by Autocomplete with changing attributes and by ComboBox, ListBox and Menu with `null`). The collections node should convert it with Autocomplete and change the two readers.
- Warnings in the ui build: 203 before, 152 after.
- `LocaleContext` has 28 readers and is a calendar/i18n matter.

## Gotchas

- A function in a store value cannot be sent to the browser (the server names the slot: `holds a Function`). Keep handlers as plain keys beside the store.
- A handler reaches the browser as a reference only when it is a literal key of the `$setContext` object. `{ props, ...handlers }` fails with the same message for the spread function.
- `$memo` must be a top-level `const` (BRM132), so `$toStore($memo(x))` in the call fails.
- `$memo({ ... } as T)` fails when the memo is live on the client: the client part gets `() => { a: ..., b: 2 } as Record<string, unknown>` with no parentheses around the object, so the vite transform reports PARSE_ERROR. Repro: a `.brm` with `<script>import { $memo, $signal } from 'brumate/signals'; let n = $signal(1); const p = $memo({ a: n, b: 2 } as Record<string, unknown>);</script><button onClick=(() => n++)>{p.a}</button>`, compiled with `compile()` (the client part shows the arrow) and loaded by vite in a vitest run. A static memo is pruned, so a bare `compile()` of the one-line file looks fine. Use `$memo<T>({ ... })`.
- A `$memo` of an object with generic props can give a `$$Sendable` type mismatch (SearchField); `$memo<InputContextProps>` fixes it.
- A part that reads and provides the same context (Checkbox) reads the context above, so `const groupLabel = $store(LabelContext)` is the group's store, not its own.
- A fixture or a test that provides a field context must give a store (`$toStore(memo)`), or `$store` throws "gives no store".

- Constant providers tried with a plain `store({ id: labelId })` from `brumate/store` in 13 parts: the tests pass, but the ui example is the same size (200,683 B against 200,682 B), because the compiler already prunes a constant memo. In DateField `labelId` is a memo, so the plain store got an `updateContext` that builds a new store; that would be a bug. Not used.

## Proposed learnings

- Give a context that carries changing values and handlers `{ store, handlerA, handlerB }` with the handlers as literal keys | a function in a store value is not sent, and a spread hides the function from the compiler | packages/ui/src | no

## Verification

- `pnpm lint` (exit 0, warnings only), `pnpm format:check` (pass), `pnpm typecheck` (pass, all packages).
- `npx vitest run` in packages/ui, all files except `bind-kept-writes` and `token-field-sync`: 73 files, 766 pass, 1 expected fail. The two excluded files alone: 7 pass.
- Ui example JS (vite build of `examples/ui`, gzip -9 per file, summed): base 199,153 B, now 200,682 B (+1,529 B); the Index chunk 154,106 to 154,652 B. No earlier outcome records this figure, so this is the first. It is the eager client code, not a measure of `load`.
- ui e2e (`node e2e/run.mjs --only ui`): 55 passed, 0 failed.

## Size

- Estimated M, actual M.
