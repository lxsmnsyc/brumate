# @brumate/ui

## 0.2.0

### Minor Changes

- d19bc57: Add `Fieldset` and `Legend`. A disabled `Fieldset` disables every field and button inside it, and its fields post nothing. `Form` takes `isDisabled` too. Every field part reads the disabled state with its own `isDisabled`.
- e9ed491: A Popover sets its `max-height` to the room that is left, unless your CSS sets one. It reads `--anchor-gap`, `--anchor-offset` and `--anchor-padding` for `offset`, `crossOffset` and `containerPadding` when the prop is not passed.
- e87e290: No context of the package has a default, as `createContext(key)` in `brumate` now takes only a key. Reading one with no provider throws. The parts still render alone: each reads these contexts with `$getContext(Context, undefined)` and guards on the value, and a part outside an `I18nProvider` still uses `en-US`, with `$store($getContext(LocaleContext, store(DEFAULT_LOCALE)))`. Code that reads these contexts itself does the same. The contexts are `ButtonContext`, `LinkContext`, `ToggleButtonContext`, `ToggleGroupContext`, `ToolbarContext`, `HeadingContext`, `TextContext`, `LabelContext`, `SeparatorContext`, `GroupContext`, `LocaleContext`, `LayerContext`, `InputContext`, `TextAreaContext`, `FieldInputContext`, `FieldErrorContext`, `FormContext`, `CheckboxGroupContext`, `RadioGroupContext`, `ListBoxContext`, `ListBoxGivenContext`, `CollectionFocusContext`, `SectionContext`, `SelectValueContext`, `VirtualizerContext`, `MenuTriggerContext`, `MenuContext`, `SubmenuContext`, `DialogContext`, `TreeContext`, `TreeRowContext`, `TokenFieldContext`, `TokenContext`, `TableContext`, `TableRowContext`, `TableResizeContext`, `ColumnContext`, `NavigationTreeContext`, `NavigationLinkContext`, `DisclosurePanelContext`, `DisclosureGroupContext`, `OverlayTriggerContext`, `ModalOverlayContext`, `ColorSwatchContext`, `ColorPickerContext`, `DatePickerContext`, `CalendarContext`, `CalendarGridContext`, `DateStringsContext`, `DateFieldContext`, `DateRangeFieldContext`, `ColorThumbContext`, `ColorWheelContext`, `TransitionContext`, `TabsContext`, `TagGroupContext`, `SliderContext`, `TooltipTriggerContext`, `ToastRegionContext`, `ToastContext` and `SelectionIndicatorContext`.
- b132783: Breaking for code that provides or reads these contexts itself. `CalendarContext`, `DatePickerContext`, `DateFieldContext`, `ColorThumbContext`, `ColorWheelContext` and `ColorPickerContext` hold `{ state, ...handlers }`: `state` is a `StoreLike` of the data they held before, and the functions are keys beside it, all optional. `DateRangeFieldContext` holds `startState` and `endState` stores and the handlers as flat `startStep`, `endStep` and so on. `CalendarGridContext` and `ColorSwatchContext` hold a `StoreLike` of the value they held. `CalendarState` and `DatePickerState` lost their function members, which are now `CalendarHandlers` and keys of `DatePickerGiven`; `ColorThumbState`, `DateFieldState`, `ColorWheelState` and `ColorPickerState` lost theirs the same way. A plain value now throws "gives no store". To migrate, provide with `$setContext(Ctx, { state: $toStore(memo), onPress })` and read with `const given = $getContext(Ctx); const value = $store(given.state);`.
- 1739a25: Breaking for code that provides or reads these contexts itself. `ListBoxContext`, `ListBoxGivenContext`, `CollectionFocusContext`, `MenuContext`, `MenuTriggerContext`, `SubmenuContext`, `TableContext`, `TableResizeContext` and `TreeContext` hold `{ state, ...handlers }`: `state` is a `StoreLike` of the data they held before, and the functions (`select`, `action`, `setActive`, `closeAll`, `sort`, `toggle` and so on) are optional keys beside it. `SelectValueContext`, `FieldInputContext`, `NavigationTreeContext` and `NavigationLinkContext` hold a `StoreLike` of the value they held. The state types (`ListBoxState`, `ListBoxGiven`, `CollectionFocus`, `MenuState`, `MenuTriggerState`, `SubmenuState`, `TableState`, `TableResizeState`, `TreeState`) lost their function members, which are now `ListBoxHandlers`, `ListBoxGivenHandlers`, `CollectionFocusHandlers` and keys of `MenuGiven`, `MenuTriggerGiven`, `SubmenuGiven`, `TableGiven`, `TableResizeGiven` and `TreeGiven`. Type a custom provider against `ListBoxProvided`, `ListBoxGivenProvided`, `CollectionFocusProvided`, `TableGiven`, `TableResizeGiven`, `TreeGiven`, `MenuGiven`, `MenuTriggerGiven` and `SubmenuGiven`. A plain value now throws "gives no store". To migrate, provide with `$setContext(Ctx, { state: $toStore(memo), onPress })` and read with `const given = $getContext(Ctx); const value = $store(given.state);`. To clear a context for the parts inside, provide `{ state: store(null) }` (or `store(null)` for the four plain ones).
- 8ad33cb: Breaking for code that provides or reads these contexts itself. `LabelContext`, `GroupContext`, `FieldErrorContext`, `FormContext` hold a `StoreLike<...>` of the value they held before, and a plain value now throws "gives no store". `InputContext` and `TextAreaContext` hold `InputField`, the `props` store plus the handlers, and `InputContextProps` lost its handlers to `InputHandlers`. To migrate, provide with `$setContext(LabelContext, $toStore(memo))` and read with `$store($getContext(LabelContext))`.
- 987c675: Breaking for code that provides or reads these contexts itself. The last contexts that changed through the live context path now hold stores. `LocaleContext`, `DateStringsContext`, `TextContext`, `SelectionIndicatorContext`, `TransitionContext`, `TokenContext`, `ColumnContext`, `TreeRowContext`, `VirtualizerContext` and `ToastRegionContext` hold a `StoreLike` of the value they held. `ButtonContext` and `LinkContext` hold `{ state, handlers }`: `state` is a `StoreLike` of the props that are not functions, and `handlers` is a props value or `{ slots }` of the `on...` functions, with the same slot names. `CheckboxGroupContext`, `RadioGroupContext`, `ToggleGroupContext`, `DisclosurePanelContext`, `DisclosureGroupContext`, `OverlayTriggerContext`, `DialogContext`, `SliderContext`, `TagGroupContext`, `TokenFieldContext`, `TabsContext` and `TooltipTriggerContext` hold `{ state, ...handlers }` with the functions (`toggle`, `select`, `open`, `close`, `expand`, `setThumb` and so on) as optional keys beside the store. The state types lost their function members. Type a custom provider against the new `ButtonGiven`, `LinkGiven`, `CheckboxGroupGiven`, `RadioGroupGiven`, `ToggleGroupGiven`, `DisclosurePanelGiven`, `DisclosureGroupGiven`, `OverlayTriggerGiven`, `DialogGiven`, `SliderGiven`, `TagGroupGiven`, `TokenFieldGiven`, `TabsGiven` and `TooltipTriggerGiven`, and the matching `...Handlers` types. `ButtonStateProps`, `LinkStateProps` and `ButtonHandlers` split `ButtonContextProps` and `LinkContextProps`, and `slotHandlers` reads the handlers of a slot. A plain value now throws "gives no store". To migrate, provide with `$setContext(Ctx, { state: $toStore(memo), onPress })` and read with `const given = $getContext(Ctx); const value = $store(given.state);`. For `ButtonContext`, move the functions of each slot to `handlers: { slots: { name: { onPress } } }`. To clear a context for the parts inside, provide `{ state: store(null) }`, or `store(null)` for a context that is a store alone.

  `LocaleContext` holds `null` outside an `I18nProvider`. `DEFAULT_LOCALE` (new export of `locale.ts`, `en-US`) is the fallback, so a custom reader does `$store($getContext(LocaleContext, store(DEFAULT_LOCALE))) ?? DEFAULT_LOCALE`.

### Patch Changes

- Updated dependencies [7fa3213]
- Updated dependencies [846e25f]
- Updated dependencies [ac11f29]
- Updated dependencies [a503508]
- Updated dependencies [bee0883]
- Updated dependencies [72b1aab]
- Updated dependencies [364089d]
- Updated dependencies [058e073]
- Updated dependencies [84fd338]
- Updated dependencies [c74bba5]
- Updated dependencies [ffd26e0]
- Updated dependencies [050e7fe]
  - brumate@0.7.0

## 0.1.3

### Patch Changes

- 51eb398: `TextField` and `SearchField` now show the kept text when the setter of `$bind(signal, setter)` refuses an edit. Before, the input kept the typed text until a reset. A setter that returns refuses at once. A setter that decides later, such as after an async check, leaves the typed text in place until its promise settles, and the field puts the kept text back only if the value did not take what was typed. A later keystroke cancels the check of an earlier one, and the caret stays where it still fits.
- Updated dependencies [c9f505b]
- Updated dependencies [d4a108d]
- Updated dependencies [749e1d1]
- Updated dependencies [ea40983]
- Updated dependencies [d1296f4]
- Updated dependencies [16d9787]
- Updated dependencies [11b1f41]
- Updated dependencies [51eb398]
- Updated dependencies [2c6662d]
- Updated dependencies [87700cd]
- Updated dependencies [4dc4d6d]
- Updated dependencies [7b500e2]
  - brumate@0.6.1

## 0.1.2

### Patch Changes

- Updated dependencies [6e1fcb3]
- Updated dependencies [e9dd2f9]
- Updated dependencies [5bf701f]
- Updated dependencies [1d03636]
- Updated dependencies [e40ba94]
- Updated dependencies [fcfe216]
- Updated dependencies [d61aa37]
  - brumate@0.6.0

## 0.1.1

### Patch Changes

- Updated dependencies [db63624]
- Updated dependencies [87ddc16]
- Updated dependencies [cbe48a5]
- Updated dependencies [7f07cfb]
- Updated dependencies [3b62101]
- Updated dependencies [b4f8ec8]
- Updated dependencies [6c4cee2]
- Updated dependencies [db63624]
  - brumate@0.5.0

## 0.1.0

### Minor Changes

- c6134ea: @brumate/ui is published to npm, under the MIT License. It takes brumate as a peer dependency. It has parts for buttons, forms, collections, data, colors, dates, overlays, navigation, status, layout, animation and utilities.
- 54d4852: Every part exports its props type from `<script module>`, such as `ButtonProps` from `Button.brm`. The parts that render an element take `as`, the name of an element or a component, and the other props are those of the target, so `<Button as="a" href="/docs">` is valid and `<Button as="a" foo>` is an error. They forward `ref`, and the signal is typed from the target: `<Button ref=$bind(b)>` gives `HTMLButtonElement | undefined`, and `<Button as="a" ref=$bind(link)>` gives `HTMLAnchorElement | undefined`. `@brumate/ui/as.ts` has the types `AsProps` and `AsTarget` for a part of your own.
- e92ffd3: `GridList`, `ListBox` and `Table` take `items`, as `Tree` does, and render each with an `item` template. With `rowHeight`, or in a `Virtualizer`, they render only the rows in view, and their keys read the data of all the items. Home, End, the page keys, Ctrl+A, the box in the header of a `Table`, ranges with Shift and letters reach rows that are out of view, and a move to one scrolls it into view, then focuses it. `getTextValue` gives the text of an item for letters.
- 789a184: The date parts speak the language of the I18nProvider. The placeholders of the segments follow what browsers show in their date inputs (`tt.mm.jjjj` in German), the segment names come from `Intl.DisplayNames`, and the labels of the Calendar and the DatePicker have a table for English, German, French, Spanish, Japanese and Chinese. An I18nProvider takes `strings` to replace the whole set, and `timeZone`. The server writes only the strings of its language into the page. Today follows `timeZone` of the Calendar or the I18nProvider.
- b1e8aca: Drag and drop. A `DropZone` takes drops and pastes of text and files. The rows of a `GridList` move with a drag of the pointer or from the keys with `onReorder`, and drag out to a DropZone with `getItems`. Every module of the package can be imported, such as `@brumate/ui/data.ts`.
- 457a4d9: ListBox, GridList, Table, TableBody, Tree, TreeRow and NavigationTree take a type `V` for their items, so `item` and `getTextValue` get the type of `items` and a wrong field is an error. ToastRegion takes `V` for the content of a toast. The props types take the value first, then the target: `ListBoxProps<V, T>`.
- 4b77183: A skill for the parts, `skills/brumate-ui`, ships in the package. It has a `SKILL.md` and references for composition, slots and contexts, state with `$bind`, `as` and `ref`, templates, `data-*` styling, collections, overlays, dates and colors, and i18n. To use it, copy it into the skills of a project: `cp -r node_modules/@brumate/ui/skills/brumate-ui .claude/skills/`.

### Patch Changes

- Updated dependencies [859f9b9]
- Updated dependencies [fdc0e73]
- Updated dependencies [2f62fba]
- Updated dependencies [c519c4a]
- Updated dependencies [14ced48]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [296a8ce]
- Updated dependencies [f80f134]
- Updated dependencies [393688f]
- Updated dependencies [c251b27]
- Updated dependencies [54d4852]
- Updated dependencies [d939be1]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [b4faafb]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [043532f]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [9b476e6]
- Updated dependencies [6405647]
- Updated dependencies [54d4852]
- Updated dependencies [3cd7155]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [95504b2]
- Updated dependencies [88b9ac7]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [67a64f7]
- Updated dependencies [54d4852]
- Updated dependencies [54d4852]
- Updated dependencies [39f4baf]
- Updated dependencies [3b451bb]
  - brumate@0.4.0
