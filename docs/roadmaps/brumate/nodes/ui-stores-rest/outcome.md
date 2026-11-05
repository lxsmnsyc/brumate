# Outcome: ui-stores-rest

## Built

Every context in `packages/ui` that carried a changing value now carries it in a store. The ui build (`vite build` of `examples/ui`) prints 0 "context value reads" warnings; it printed 66 on 1739a254.

- `packages/ui/src/locale.ts`, `date-strings.ts`: `LocaleContext` is a `StoreLike<Locale | null>` and `DateStringsContext` a `StoreLike<DateStrings | null>`, both with `store(null)` as default. `I18nProvider` gives one store per context (`$toStore` of its memos). The 28 readers of the locale do `const localeStore = $store(LocaleContext); const locale = $memo(localeStore ?? DEFAULT_LOCALE)` (`DEFAULT_LOCALE` is `en-US`, exported from `locale.ts`), so the rest of each part still reads `locale.locale`. The 4 readers of the strings use `$store(DateStringsContext)` and keep the name `strings`.
- `packages/ui/src/contexts.ts`:
  - `ButtonContext` is `ButtonGiven` (`state` store of `ContextValue<ButtonStateProps>`, `handlers` of `ContextValue<ButtonHandlers>`, same slot names). `LinkContext` is `LinkGiven` the same way (`LinkStateProps`, `LinkHandlers`). `ButtonContextProps` and `LinkContextProps` stay as the union of both.
  - `TextContext` is a store of `ContextValue<AttributeProps>`; all 20 providers give it with `$toStore`.
  - `{ state, ...handlers }`: `CheckboxGroupGiven`, `RadioGroupGiven`, `ToggleGroupGiven`, `DisclosurePanelGiven`, `DisclosureGroupGiven`, `OverlayTriggerGiven`, `DialogGiven`. Their state types lost the functions, which are `CheckboxGroupHandlers`, `RadioGroupHandlers`, `ToggleGroupHandlers`, `DisclosurePanelHandlers`, `DisclosureGroupHandlers`, `OverlayTriggerHandlers`, `DialogHandlers`.
- Other files: `slider.ts` (`SliderGiven`, `SliderHandlers`), `tags.ts` (`TagGroupGiven`), `token-field.ts` (`TokenFieldGiven`, and `TokenContext` as a store), `tabs.ts` (`TabsGiven`), `tooltip.ts` (`TooltipTriggerGiven`), `selection-indicator.ts`, `transition.ts`, `table.ts` (`ColumnContext`), `tree.ts` (`TreeRowContext`), `virtualizer.ts`, `toast.ts` (`ToastRegionContext`): stores. `slots.ts`: `slotHandlers`.
- Providers and readers: about 70 `.brm` files. `ModalOverlay`, `Popover` and `Tooltip` clear `ButtonContext`, `LinkContext`, `OverlayTriggerContext` with `{ state: store(null) }`.
- `packages/ui/test/field-stores.test.ts`: two tests added. One scans every part's compiled `updateContext` for a changing value (more than 40 updates, more than 20 contexts, more than 5 of `ButtonContext`). One compiles every part and asserts no "context value reads" warning (more than 100 parts). Both fail on 1739a254 and pass here.
- Fixtures `buttonContext.brm`, `simple.brm`, `Locale.brm` follow the new shapes. `packages/ui/README.md` ("Contexts and slots") describes them. `.changeset/ui-stores-rest.md` (`@brumate/ui` minor).

## Result

Not an experiment node.

## Deviations

- The 66 warnings undercount the live path: the compiler warns only for a local `$signal`, `$memo` or `let`, not for a prop or a `$bind` value. I converted every context whose compiled update read state outside a function (about 80 before), not only the 66. That reached contexts such as `OverlayTriggerContext` of `MenuTrigger` and `DialogTrigger`, `TreeRowContext`, `ColumnContext`, `VirtualizerContext`.
- `ButtonContext` and `LinkContext` split into `state` and `handlers` objects, not flat keys, because the slot names are the caller's. A nested object of handlers beside a store works (probe in the log); the earlier note about "nested fails" does not cover a nested literal of arrow functions.
- Files outside packages/ui and this folder: none.

## Stubs left

Contexts still on the live path, and why each is safe for static-contexts-final:

- Handlers. Every provider that gives a function keeps an `updateContext` in its client part, because the function is read through a live `$getContext` slot. The functions are literal keys, so the browser gets a reference. After the live path goes, the slot is set once and the handlers still work. This is the same for all `{ state, ...handlers }` contexts.
- Forwarded handlers: `Autocomplete` gives `filter` and `DatePicker` and `DateRangePicker` give `isDateUnavailable` as stable wrappers that read the prop when called, so a later change applies without the live path (a test checks it). `FORWARDED` keeps `Calendar` `isDateUnavailable` (its own prop, read when called) and `setActive` of `ListBox` and `Menu`, which is Autocomplete's stable `(key) => activate(key)`.
- Constants: `HeadingContext`, `SectionContext` (`headerId`), `ToastContext` (ids), `LayerContext` (id), `ModalOverlayContext` (`close`), `ToolbarContext` (`true`), `TableRowContext` (`cells.count` is a counter the cells advance while rendering), `SeparatorContext`, `ToggleButtonContext` (no provider in the library, only the reader).
- `$route` and `$navigation` are runtime contexts and stay.

## Gotchas

- The `LocaleContext` default of `store(null)` plus the `?? DEFAULT_LOCALE` memo in 28 readers is a workaround for the core repair compare (`subscribeSlot`). A story node will fix that compare. After it, `LocaleContext` can default to a store of the en-US locale and the 28 reader memos can go.
- A context default store must hold `null` (or another value that is identical in the browser), not an object. The resume of a reader writes its slot when `found.get()` is not `Object.is` the value sent by the server (`subscribeSlot` with `repair`, `packages/brumate/src/runtime/client/context.ts`). A default `store(createLocale('en-US'))` is a new object in the browser, so every reader of the locale wrote its slot at load. That write ran a context pass that changed the skip link of the ui example: `<VisuallyHidden as="a" class="skip" focusable>` lost `visually-hidden focusable` from its `class` (the e2e step "the skip link shows on focus" failed: 137 px wide before focus). With the `null` default the e2e passes. I did not reproduce the lost class with a vitest mount (a click and a default object store did not do it), so I make no claim about a core bug; a later node that uses a non-null default store should run the ui e2e.

- Read a store from a context in two statements: `const given = $getContext(Ctx); const value = $store(given.state);`. A context that is a store alone is `$store(Ctx)`. Mixing them up fails at render with "gives no store".
- `.brm` files are not formatted by `oxfmt`. Keep a long import on one line only if the file already does; the formatter will not wrap it.
- `slotProps` throws for a slot the value lacks. `ButtonContext` reads the state with `slotProps` and the handlers with `slotHandlers`, which gives `{}`, so a slot with state and no handler is fine.
- A trigger that wraps another (`TooltipTrigger`, `PreviewTrigger`) spreads the parent's state and forwards the parent's handlers it does not own (`onPress`, `onPressUp`, `onPressChange`, `onHoverChange`) by calling them. A new handler key on the parent needs a forward there.
- The test's first assertion on `updates` counts handler updates, so it must be lowered when `updateContext` goes.

## Proposed learnings

- Give a context with slots `{ state, handlers }` with the same slot names | a store cannot hold a function and the caller names the slots | packages/ui/src | no
- Check the live path by compiling every part and looking for a changing read in `updateContext`, not by the warning | the warning ignores props and `$bind` values | packages/ui/test | yes (field-stores test)

## Verification

- `pnpm lint` (exit 0, warnings only), `pnpm format:check` (pass), `pnpm typecheck` (pass, all packages).
- `npx vitest run` in packages/ui, 73 files in four groups, all pass (1 expected fail), excluding `bind-kept-writes` and `token-field-sync`, which pass alone (2 and 5 tests). Includes `i18n-locale-change`, `date-i18n` and `I18nProvider`.
- field-stores on 1739a254 `packages/ui/src`: the two new tests fail; here: pass.
- Ui example JS (vite build of `examples/ui`, gzip -9 per `.js` file under `dist`, summed): base 1739a254 203,136 B, now 207,214 (+4,078 B, +2.0%) B. Not a measure of `load`.
- ui e2e (`node e2e/run.mjs --only ui`): 55 passed, 0 failed (after the locale fix below; the first two runs failed the VisuallyHidden skip link step).

## Size

- Estimated L, actual L.
