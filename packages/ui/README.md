# @brumate/ui

Accessible, unstyled components for brumate. They follow the WAI-ARIA patterns for behaviour, and the API of [Terracotta](https://github.com/lxsmnsyc/terracotta). The plan is in [Headless UI components](../../docs/proposals.md#headless-ui-components).

Install it with brumate, which it needs as a peer:

```sh
pnpm add @brumate/ui brumate
```

The brumate Vite plugin finds the parts in the package, so a page imports them as `import Button from '@brumate/ui/Button.brm'`.

- The parts render markup, ARIA attributes and `data-*` state, and no CSS of their own, except what a part needs to work, such as the styles that hide the content of `VisuallyHidden`.
- A part uses a feature of the platform only when at least 95% of global usage supports it.
- A part can have a `.stories.ts` file for the workbench of the dev server, at `/__brumate/workbench`.

## Parts

The docs of [each part](../../website/ui) have a demo, its props and its keys. The parts by kind:

### Buttons

- `Button`: presses with a pointer, Enter, Space or a screen reader. Its state is in `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled` and `data-pending`.
- `ToggleButton`: a button that stays pressed, with `aria-pressed` and `data-selected`.
- `ToggleButtonGroup`: ToggleButtons with one selection, as radios, or several, as a toolbar.
- `Link`: a link that presses as a button does, with `data-current`. A disabled link has no address.
- `FileTrigger`: opens the file picker from a Button inside, and calls `onSelect` with the files.
- `DropZone`: an area that takes drops and pastes of text and files.

### Forms

- `TextField`: a field of a Label, an Input or a TextArea, a description and a FieldError. The browser checks it on a submit, and `field` takes a field of `createForm`.
- `Input` and `TextArea`: the input of a field, with `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled` and `data-invalid`.
- `Label` and `Text`: the label of a field, and its text, such as its description. Each takes the `id` that the field gives, and a Label the `for`.
- `SearchField`: a search input with a button that clears it. Escape clears it, and Enter calls `onSubmit`.
- `TokenField`, `Token` and `TokenInput`: text with mentions and tags that the user types.
- `NumberField`: a field for a number, in the format of the locale.
- `Slider`, `SliderTrack`, `SliderThumb` and `SliderOutput`: a value, or a range of values, on a track.
- `Checkbox`: a label around a native checkbox, with `data-selected`, `data-indeterminate`, `data-pressed` and the focus and hover of its label.
- `CheckboxGroup`: checkboxes with one value, a list. With `isRequired`, the browser asks for a box on a submit.
- `RadioGroup` and `Radio`: native radios with one name, so the arrow keys move the choice.
- `Switch`: a native checkbox with `role="switch"`.
- `Fieldset` and `Legend`: a group of fields that a disabled state reaches.
- `FieldError`: the errors of a field, while it is invalid.
- `Form`: a form that tells its fields how to validate, and gives them the errors of the server by name.

### Colors

- `ColorPicker`: one color, shared by the color parts inside it.
- `ColorSwatch`: a sample of a color, named for screen readers.
- `ColorSlider`: a slider for one channel of a color.
- `ColorArea` and `ColorThumb`: two channels of a color on a plane.
- `ColorWheel` and `ColorWheelTrack`: a circular track for the hue of a color.
- `ColorField`: a field for a color, as hex or as one channel.
- `ColorSwatchPicker` and `ColorSwatchPickerItem`: a list of color swatches, to pick one.

### Dates

- `Calendar`, `CalendarGrid`, `CalendarCell` and `CalendarHeading`: the days of a month, to pick a date.
- `RangeCalendar`: the days of a month, to pick a range of dates.
- `DateField`, `DateInput` and `DateSegment`: a date that the user types segment by segment.
- `TimeField`: a time of day that the user types segment by segment.
- `DatePicker`: a date field with a button that opens a calendar.
- `DateRangePicker`: two date fields and a button that opens a range calendar.

### Overlays

- `Dialog` and `DialogTrigger`: a dialog in an overlay, named by a Heading with `slot="title"`, and closed by a Button with `slot="close"`.
- `Popover`: an overlay beside its trigger, in a layer of its own. It is modal unless `isNonModal`, closes on Escape and a press outside, and takes `transition`.
- `PopoverGroup`: popovers that share focus, such as the menus of a nav bar.
- `OverlayArrow`: an arrow from a Popover to its trigger.
- `ModalOverlay` and `Modal`: a dialog over the page. The page is inert and does not scroll while it is open. Escape closes it, and a press outside does with `isDismissable`.
- `Sheet`: a Modal along an edge of the window, with `data-side`.
- `TooltipTrigger` and `Tooltip`: a description of a Button, on hover after a delay and on focus from the keyboard.
- `PreviewTrigger`: a Popover of a Link or a Button, on hover, on keyboard focus and on a long press. It is not modal, and Tab moves into it.
- `Toast`, `ToastContent` and `ToastRegion`: notices from a queue, `toastQueue()` of `@brumate/ui/toast.ts`, in a landmark that F6 reaches. A timeout stops while the pointer or focus is in it.

### Collections

- `ListBox`, `ListBoxItem`, `ListBoxSection` and `Header`: a list of options with single or multiple selection, the arrow keys, typeahead and ranges. It reads its items from the page, so they can come from any markup.
- `GridList` and `GridListItem`: rows with buttons and checkboxes, to select and act on.
- `Menu`, `MenuItem`, `MenuSection`, `MenuTrigger` and `SubmenuTrigger`: actions and options that open from a button, with submenus.
- `Select` and `SelectValue`: a field that picks one item from a list.
- `ComboBox`: a text field with a list of suggestions that filters as you type.
- `Autocomplete`: a search field that filters a menu or a list next to it.
- `Tabs`, `TabList`, `Tab` and `TabPanel`: tabs that show one panel at a time.
- `TagGroup`, `TagList` and `Tag`: tags that the user can select and remove.
- `SelectionIndicator`: a mark of the selected item, which moves with the selection.

### Data

- `Table`, `TableHeader`, `TableBody`, `Column`, `Row`, `Cell`, `ColumnResizer` and `ResizableTableContainer`: rows and columns that the user can select and sort.
- `Tree` and `TreeItem`: rows that nest and open and close, such as files in folders.
- `NavigationTree`, `NavigationTreeItem` and `NavigationTreeItemLink`: a tree of links that shows the page that the user is on.
- `Virtualizer`: thousands of rows that render as they come into view.
- `listData` and `treeData` of `@brumate/ui/data.brm.ts`: the items of a collection that an app adds, moves and removes, with their selection.

### Navigation

- `Disclosure`, `DisclosurePanel` and `DisclosureGroup`: content that expands and collapses. A collapsed panel is `hidden="until-found"`. `transition` on the panel lets CSS animate it, with `--disclosure-panel-height`, and `unmount` decides what happens to its content while it is collapsed.
- `Breadcrumbs` and `Breadcrumb`: an `<ol>` of links. `isCurrent` marks the step of the current page.
- `Toolbar`: the arrow keys move focus between its items, and Tab stops at one of them.

### Status

- `Meter` and `ProgressBar`: a value in a range, with its text in the locale and `--percentage` for CSS.
- `Alert`: a message that a screen reader announces as it appears.

### Layout and animation

- `Group`: parts that belong together, with `data-focus-within`, `data-hovered`, `data-disabled` and `data-invalid`.
- `Separator`: an `<hr>`, or a vertical separator.
- `Heading`: a heading of a level, which a context can set.
- `Transition` and `TransitionChild`: animate content in and out, with `data-closed`, `data-enter` and `data-leave`, and keep it until its leave ends. Each step waits for the animations of the element, and a child moves with its parent.

### Utilities

- `VisuallyHidden`: hides its content from sight and keeps it for screen readers.
- `Keyboard`: a keyboard shortcut, left to right in every language.
- `I18nProvider`: gives the parts inside it a locale and its direction. The default is `en-US`.
- `ColorScheme`: the light, dark or system choice of the page, kept in a cookie. `colorScheme()` of `@brumate/ui/color-scheme.brm.ts` reads and changes it.

## Writing a part

A part is a `.brm` component in `src`, with a test in `test`, a section in `examples/ui`, and a `.stories.ts` file when it needs one. It follows the WAI-ARIA pattern of the same name, and its tests are its specification. `Button.brm` shows each step.

### Props

- Name the props `isDisabled`, `onPress`, `onHoverChange`.
- Export `<Name>Props` from `<script module>`, and use it in `$props<NameProps>()`, so apps can import it. See [Props types](../../website/docs/typescript.md#props-types).
- Take `as`, and render `<{as ?? 'button'} …>`, so the caller can pick the element. Its type is `AsProps` of `src/as.ts`, as `ButtonProps` shows: the other props are those of the element or the component.
- End the element with `{...rest}`, so the caller's attributes come last. Its `class` adds to the part's, and its handlers run after the part's own.
- Show state as `data-*` attributes, with `undefined` for false, so `[data-pressed]` matches only a pressed part.

### State

Give each state one `let` prop, typed `Bindable`, such as `let { pressed = false } = $props<ToggleProps>()`, with `pressed?: Bindable<boolean>` in `ToggleProps`. Write it, and call `onChange`:

- `pressed` alone starts the part's own copy as on.
- `pressed=$bind(signal)` writes the caller's signal.
- `pressed=$bind(signal, setter)` lets the caller refuse the value.

There is no `defaultPressed`. See [Controlled and uncontrolled](../../docs/proposals.md#controlled-and-uncontrolled).

### Contexts and slots

A part that holds other parts provides their props in the context of each part type, in `src/contexts.ts`. A context value is static. What changes goes in a store, and the functions go beside it as literal keys, since a store cannot hold a function.

- A context that changes gives `{ state: $toStore(memo), ...handlers }`. A part reads it with `const given = $getContext(Ctx); const value = $store(given.state);` and calls `given.handler?.()`. A context with no handler is the store alone, read with `$store($getContext(Ctx))`.
- `ButtonContext` and `LinkContext` give `{ state, handlers }`. Each is a props value, or `{ slots: { name: props } }`, with the same slot names in both. `state` holds the attributes and states, `handlers` the `on...` functions. Read them with `slotProps($store(given.state), slot)` and `slotHandlers(given.handlers, slot)`.
- A part that works without a provider reads the context with `const given = $getContext(Context, undefined)` and its store with `given ? $store(given.state) : undefined`, so a handler from it may be missing: the part calls it with `?.`, or with `!` where a provider always gives it.
- `LocaleContext` and `DateStringsContext` are stores. Read the locale with `$store($getContext(LocaleContext, store(DEFAULT_LOCALE)))`, which falls back to `en-US` without an `I18nProvider`, and `?? DEFAULT_LOCALE` for a provider's `null`.
- A memo cannot hold handlers. Read them from the context in a function when a handler runs, and call the context's handler before the part's own.
- Spread the attributes of the context, from `contextAttributes`, before `{...rest}`, so the caller wins.

### Interactions

`press.brm.ts`, `hover.brm.ts` and `focus.brm.ts` return state and a function for each event. Call them from the handlers of the element. Two modules that need the same event, such as `onKeyDown`, share one handler that calls both.

- A handler runs after the browser has moved on from the event. `preventDefault` in a handler is too late. Wrap the handler in `prevent(handler, 'Space')`, which the loader applies by key.
- A press keeps its pointer with pointer capture, so its `pointerup` reaches the element even outside it. A listener on the document would be added too late to see it.
- Plain helpers go in a `.ts` file, such as `interactions.ts`. Every export of a `.brm.ts` file is a module function that a component calls at the top of its script.

### Tests

- Test the behaviour of the pattern, with the helpers of `test/interact.ts`: `pointer`, `pressWith`, `press` and `tab`.
- The handlers of a fixture run after their code loads, so wait for what they log with `page.waitFor`.
- Add a step to `e2e/suites/ui/` for what happy-dom does not do, such as pointer capture, scrolling and `:focus-visible`. The suite runs axe-core on the page.
