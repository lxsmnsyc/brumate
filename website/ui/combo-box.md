# ComboBox

A text field with a list of suggestions, which shows the items that match what was typed.

```brm demo ComboBoxDemo

```

```html
<ComboBox name="animal" selectedKey=$bind(animal)>
  <Label>Favorite animal</Label>
  <Input />
  <Button />
  <Popover>
    <ListBox>
      <ListBoxItem id="cat">Cat</ListBoxItem>
      <ListBoxItem id="dog">Dog</ListBoxItem>
    </ListBox>
  </Popover>
</ComboBox>
```

- A `ComboBox` holds a `Label`, an `Input`, a `Button`, a `Popover` with a [ListBox](./list-box.md), and can hold a `Text` with `slot="description"` and a `FieldError`.
- `selectedKey` is the key of the selected item, or `null`. `inputValue` is the text in the input. Each starts its own state, or binds with `$bind`. See [State](./state.md).
- `onSelectionChange`, `onInputChange` and `onOpenChange` get each change.
- The ComboBox shows `data-open`, `data-disabled`, `data-invalid` and `data-required`.

## Anatomy

```html
<ComboBox>
  <Label />
  <Input />
  <Button />
  <Text slot="description" />
  <FieldError />
  <Popover>
    <ListBox>
      <ListBoxItem />
    </>
  </>
</>
```

The `Text` and the `FieldError` are optional.

## Props

```props ComboBox

```

The [Label, Input, Text and FieldError](./text-field.md#props) are those of a TextField, the [Button](./button.md#props) is a Button, the [Popover](./popover.md) is a Popover, and the [ListBox](./list-box.md#props) holds the items.

## Data attributes

| Attribute       | When                   |
| --------------- | ---------------------- |
| `data-open`     | The list is open.      |
| `data-disabled` | The field is disabled. |
| `data-invalid`  | The field has errors.  |
| `data-required` | The field is required. |

The input and the items show their own attributes, and the items [those of a ListBoxItem](./list-box.md#data-attributes).

## Keyboard

Focus stays in the input. `aria-activedescendant` names the active item.

| Key         | Action                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `Tab`       | Moves focus to the input. The Button is skipped. Leaving closes the list.                              |
| `ArrowDown` | Opens the list with all its items, and moves the active item down, round the ends.                     |
| `ArrowUp`   | Opens the list with all its items, and moves the active item up, round the ends.                       |
| `Enter`     | Picks the active item. With no active item, closes the list. While the list is closed, sends the form. |
| `Escape`    | Closes the list, and puts back the text of the selected item, or clears the input.                     |
| `a` to `z`  | Types in the input, which opens the list and filters the items.                                        |

## Controlled and uncontrolled

`selectedKey` holds the key of the selected item, or `null`, and `inputValue` holds the text in the input. `selectedKey=(key)` and `inputValue=(text)` start the field's own state, and `$bind(signal)` writes your signal. `isOpen` holds whether the list is open in the same way. `onSelectionChange`, `onInputChange` and `onOpenChange` get each change. See [State](./state.md).

## Styling

Style the field with the data attributes above, such as `[data-open]` and `[data-invalid]`. The input, the Button and the items show their own attributes. See [Styling](./styling.md).

## Typing and choosing

- Typing opens the list, and it shows the items whose text contains what was typed, in any case. The list closes when no item matches.
- `defaultFilter` decides when an item matches, such as `(text, input) => text.startsWith(input)`.
- `menuTrigger="focus"` opens the list when the input gets focus, and `"manual"` opens it only with the keys and the Button.
- ArrowDown and ArrowUp open the list with all of its items, and move through its items, and go round at the ends. Focus stays in the input, and `aria-activedescendant` names the active item. The pointer makes an item active too.
- Enter and a press pick an item. Its text goes in the input, and the list closes. With no active item, Enter closes the list as Escape does. While the list is closed, Enter sends the form.
- The Button opens and closes the list, with all of its items, and focus stays in the input. It is out of the order of Tab, as the keys of the input do the same.

## Closing

- Escape closes the list, and puts the text of the selected item back in the input, or clears it when nothing is selected. It never clears the selection. An Escape with nothing to undo goes on to the element around, such as a Dialog.
- Focus that leaves the field does the same.
- `allowsCustomValue` keeps what was typed. Text that is not the text of the selected item clears the selection.
- `isRequired` makes the input required, with `aria-required`.

## Forms

`name` sends the key of the selected item with its form, or the text of the input with `allowsCustomValue`. `formValue="key"` or `"text"` chooses. The value goes with the form also before the code of the page loads. A server error for the `name` in a [Form](./form.md) shows in the FieldError until the selection changes.

## How it filters

The items are on the page while the list is open, so the ComboBox hides those that do not match, and the keys skip hidden items. A section with no item left is hidden too. To filter the items yourself, such as from a server, bind `inputValue` and render only the items that you want in a `#for`.
