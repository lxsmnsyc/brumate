# State

A part with state has one prop for it, such as `isSelected` of a `Checkbox` or `value` of a `TextField`. How you pass it picks who keeps the state. The four shapes below are all live. Each checkbox holds its own copy, except the last two, which share your signal. Lock it and the last one stops taking changes.

```brm demo StateShapesDemo

```

## The four shapes

```html
<!-- The part keeps its own state, which starts off. -->
<Checkbox>Subscribe</Checkbox>

<!-- The part keeps its own copy, which starts on. A new value from you replaces it. -->
<Checkbox isSelected>Subscribe</Checkbox>

<!-- The part writes your signal. -->
<Checkbox isSelected=$bind(subscribed)>Subscribe</Checkbox>

<!-- The part asks you. It shows what you keep. -->
<Checkbox isSelected=$bind(subscribed, (next) => { if (!locked) subscribed = next; })>Subscribe</Checkbox>
```

| Shape                    | Use it when                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| No prop                  | The part is the only one that cares, and a form reads it.                                        |
| A value with no `$bind`  | You know where it starts and do not need to read it back. This is `defaultValue` in other kits.  |
| `$bind(signal)`          | Other code reads or writes the state, such as a summary, a filter or a reset button of your own. |
| `$bind(signal, request)` | A change needs a check first, such as a lock, a limit of choices, or a confirm. You decide.      |

There is no `defaultSelected` or `defaultValue`: a `let` prop of brumate already does both. See [Props that the component writes](../docs/components.md#props-that-the-component-writes).

## Change callbacks

- Each part calls its change handler with the new value, in every shape: `onChange`, or `onSelectionChange` and `onOpenChange` for keys and overlays.
- With `$bind(signal)`, the handler runs after the signal is written. With `$bind(signal, setter)`, it runs right after your setter, at once and in the same event, with the value that the signal keeps. A setter that rounds gets the rounded value, and a setter that refuses gets no call, as a write that changes nothing. A setter that accepts later reports through the signal, not through the handler.
- A value of `null` is a value like any other, such as the `selectedKey` of a `Select` with nothing chosen.

## Form reset

A `reset` of the form gives every form field the value that it started with. Change the name, then press Reset:

```brm demo StateFormDemo

```

- These form fields reset: `TextField`, `SearchField`, `NumberField`, `TokenField`, `Checkbox`, `Switch`, `CheckboxGroup`, `RadioGroup`, `Select`, `ComboBox`, `Slider`, `ColorField`, `ColorSlider`, `ColorArea`, `ColorWheel`, `DateField`, `TimeField` and `DateRangePicker`. Their `data-*` attributes and their hidden input follow.
- The other parts are not form fields, since a form sends nothing of them, and they do not reset: `ToggleButton`, `ToggleButtonGroup`, `Calendar`, `RangeCalendar`, `Autocomplete`, `TagGroup`, `ListBox`, `Tabs` and the rest. Set their signal yourself on a reset.
- A reset that another listener prevents changes nothing.
- The reset is a write, as an edit is, so it follows the shape of the state. With `$bind(signal)`, the signal gets the start value back. With `$bind(signal, request)`, the request gets it like any new value, and a request that refuses it leaves the old value. A part with its own state or its own copy resets with no help.
- With a request that refuses, every form field shows what you keep, and so do its inputs, after an edit and after a reset. The exceptions are `TextField` and `SearchField`: the text that the user typed stays in the input until a reset, and the Escape key of `SearchField` does not clear it.
- The start value is the one that the part had when it rendered. A `Checkbox` in a `CheckboxGroup` and a `Radio` reset with their group.

## The server render

On the server nothing writes, so every shape renders the value that it starts with. The HTML is complete and a form works before the code loads. A part such as a Select that shows the text of its choice shows the key until the code loads, unless you give it a `render` template.

## The state props of every part

Each of these takes a plain value, or `$bind` as above. The change handler is named on the page of the part.

| Part                                                                                          | State props                           |
| --------------------------------------------------------------------------------------------- | ------------------------------------- |
| `ToggleButton`, `Checkbox`, `Switch`                                                          | `isSelected`                          |
| `TextField`, `SearchField`, `NumberField`, `TokenField`, `CheckboxGroup`, `RadioGroup`        | `value`                               |
| `Slider`, `ColorSlider`, `ColorArea`, `ColorWheel`, `ColorField`, `ColorPicker`               | `value`                               |
| `ColorSwatchPicker`, `DateField`, `TimeField`, `RangeCalendar`                                | `value`                               |
| `Calendar`                                                                                    | `value`, `focusedValue`               |
| `DatePicker`, `DateRangePicker`                                                               | `value`, `isOpen`                     |
| `Select`                                                                                      | `selectedKey`, `isOpen`               |
| `ComboBox`                                                                                    | `inputValue`, `selectedKey`, `isOpen` |
| `Autocomplete`                                                                                | `inputValue`                          |
| `Tabs`                                                                                        | `selectedKey`                         |
| `ListBox`, `GridList`, `Menu`, `TagGroup`, `ToggleButtonGroup`                                | `selectedKeys`                        |
| `Table`                                                                                       | `selectedKeys`, `sortDescriptor`      |
| `Tree`                                                                                        | `selectedKeys`, `expandedKeys`        |
| `NavigationTree`, `DisclosureGroup`                                                           | `expandedKeys`                        |
| `Disclosure`                                                                                  | `isExpanded`                          |
| `DialogTrigger`, `Popover`, `Modal`, `ModalOverlay`, `Sheet`, `MenuTrigger`, `TooltipTrigger` | `isOpen`                              |
| `PreviewTrigger`                                                                              | `isOpen`                              |
