# State

A part with state has one prop for it: `isSelected` of a `Checkbox`, `value` of a `TextField`, `selectedKey` of a `Select`, `isOpen` of a `Popover`. How you pass it picks who keeps the state.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Checkbox from '@brumate/ui/Checkbox.brm';

  let subscribed = $signal(false);
  let locked = $signal(false);
</script>

<!-- The part keeps its own state, which starts off. -->
<Checkbox>Subscribe</Checkbox>

<!-- The part keeps its own copy, which starts on. A new value from you replaces it. -->
<Checkbox isSelected>Subscribe</Checkbox>

<!-- The part writes your signal. -->
<Checkbox isSelected=$bind(subscribed)>Subscribe</Checkbox>

<!-- The part asks you. It shows what you keep. -->
<Checkbox isSelected=$bind(subscribed, (next) => { if (!locked) subscribed = next; })>Subscribe</Checkbox>
```

| Shape                    | Use it when                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| No prop                  | The part is the only one that cares, and a form reads it.                     |
| A plain value            | You know where it starts and do not need it back. It replaces `defaultValue`. |
| `$bind(signal)`          | Other code reads or writes the state: a summary, a filter, a reset button.    |
| `$bind(signal, request)` | A change needs a check first: a lock, a limit of choices, a confirm.          |

- There is no `defaultValue` and no `defaultSelected`. A plain value is the start, and a new value from you replaces the part's copy.
- Never pass a signal without `$bind`. `value=name` passes the current value, once.
- `$bind` is imported from `brumate/signals`. On an element it needs no import for `ref`, but on a component it does.
- `null` is a value: `selectedKey` is `null` with nothing chosen. Type the signal: `$signal<Key | null>(null)`, with `Key` from `@brumate/ui/collection.ts`.

## Refused writes

With `$bind(signal, request)`, the part calls your request with the next value. The request decides by writing the signal or not.

- The part shows what you keep. A request that does not write leaves the old value on screen, in the inputs and in the `data-*` attributes.
- The request runs at once, in the event. A request that accepts later reports through the signal, not through the handler.
- A request that rounds gets the part showing the rounded value.
- `TextField` and `SearchField` are the exception. After a refused edit the typed text stays in the input until a reset, and the Escape key of a `SearchField` does not clear it. The signal keeps the old text.

## Change handlers

`onChange`, `onSelectionChange` and `onOpenChange` get the new value in every shape.

- A part calls the handler only when the kept value changed, and with the kept value. A refused write, and a write that changes nothing, calls nothing.
- With `$bind(signal)` the handler runs after the signal is written. With a request, it runs right after the request, with the value that the signal keeps.
- A handler does the work of an event: a log, a request to the server. Do not copy the value into another signal with it: use the bound signal.
- `onPress` is the handler of a `Button`, `Link` and the like. `onAction` is for a `Menu` item, `onRowAction` for a `Table` row.

## Form reset

A `reset` of a form gives every form field the value that it started with, as a write: with `$bind(signal, request)`, your request can refuse it.

- Form fields that reset: `TextField`, `SearchField`, `NumberField`, `TokenField`, `Checkbox`, `Switch`, `CheckboxGroup`, `RadioGroup`, `Select`, `ComboBox`, `Slider`, the color fields and sliders, `DateField`, `TimeField` and `DateRangePicker`.
- `ToggleButton`, `Calendar`, `ListBox`, `Tabs`, `TagGroup` and the other parts that a form sends nothing of do not reset. Set their signal yourself.
- The start value is the one the part had when it rendered.

## The server render

On the server nothing writes, so every shape renders the value it starts with. The HTML is complete, and a form works before the code loads.

## The state props

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
