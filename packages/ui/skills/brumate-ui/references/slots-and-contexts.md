# Slots and contexts

A part that holds other parts provides props for each type of part in a context. A part reads its context and merges the props: its own win. This is how a `Label` knows the ID of its input, and how a `Button` inside a `NumberField` steps the number.

## `slot`

A `slot` picks which props a part takes from a context that has several parts of one type:

| Slot                     | Part        | Inside                                                                                                                                                                                                                  |
| ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description`            | `Text`      | `TextField`, `SearchField`, `NumberField`, `DateField`, `TimeField`, `ColorField`, `Select`, `ComboBox`, `DatePicker`, `DateRangePicker`, `TokenField`, `CheckboxGroup`, `RadioGroup`, `TagGroup`, `Checkbox`, `Switch` |
| `label`, `description`   | `Text`      | `ListBoxItem`, `MenuItem` (needs `hasLabel` or `hasDescription` on the item); `label` alone in a `DropZone`                                                                                                             |
| `title`, `description`   | `Text`      | `ToastContent`                                                                                                                                                                                                          |
| `errorMessage`           | `Text`      | `Calendar`, for an invalid value                                                                                                                                                                                        |
| `title`                  | `Heading`   | `Dialog`                                                                                                                                                                                                                |
| `close`                  | `Button`    | `Dialog`, `Toast`                                                                                                                                                                                                       |
| `trigger`                | `Button`    | `Disclosure` (also in a `DisclosureGroup`)                                                                                                                                                                              |
| `increment`, `decrement` | `Button`    | `NumberField`                                                                                                                                                                                                           |
| `previous`, `next`       | `Button`    | `Calendar`, `RangeCalendar`                                                                                                                                                                                             |
| `chevron`                | `Button`    | `TreeItem`                                                                                                                                                                                                              |
| `drag`                   | `Button`    | `GridListItem`, in a `GridList` with `onReorder`                                                                                                                                                                        |
| `remove`                 | `Button`    | `Tag`                                                                                                                                                                                                                   |
| `selection`              | `Checkbox`  | `GridListItem`, `TreeItem`, `Row` and `Cell`, `Column`                                                                                                                                                                  |
| `start`, `end`           | `DateInput` | `DateRangePicker`                                                                                                                                                                                                       |

```brm
<script>
  import Button from '@brumate/ui/Button.brm';
  import Group from '@brumate/ui/Group.brm';
  import Input from '@brumate/ui/Input.brm';
  import Label from '@brumate/ui/Label.brm';
  import NumberField from '@brumate/ui/NumberField.brm';
</script>

<NumberField minValue=(0) step=(5)>
  <Label>Width</Label>
  <Group>
    <Button slot="decrement">-</Button>
    <Input />
    <Button slot="increment">+</Button>
  </Group>
</NumberField>
```

- A slot that the context does not have throws: `The slot "x" is not valid. Valid names are ...`. A part that needs a slot and has none throws `A slot prop is needed. Valid names are ...`. A typo fails at once, so fix the name.
- `slot={null}` opts a part out of its context: it takes no props from the parts around it.
- A part with no `slot` takes the default slot of its context.

## Contexts

- A context is a value in `brumate/context`: the parts create theirs, and a part gives a value to its children. You rarely write one for a part.
- A context value is the props of one part, or `{ slots }` with the props of each slot.
- A part outside its group works alone: a `Button` with no group around it needs no context, and a `Checkbox` outside a `CheckboxGroup` keeps its own state.
- Groups that provide contexts: the fields, `Select`, `ComboBox`, `DatePicker`, `DialogTrigger`, `MenuTrigger`, `TooltipTrigger`, `Calendar`, `ColorPicker`, `TagGroup`, `Table`, `Tree`, `Tabs`.
- A `ColorPicker` renders no element. It gives its color to the `ColorArea`, `ColorSlider`, `ColorWheel`, `ColorField`, `ColorSwatchPicker` and `ColorSwatch` inside it. A part with a `value` of its own keeps it.
- A context holds through your own components: a `Label` inside a component of yours that sits in a `TextField` still finds the field. When you wrap a part, pass its props by name. A spread onto a component (`<Part {...rest}>`) makes the children of that component live.
