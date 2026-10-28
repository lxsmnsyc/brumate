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

```brm anatomy ComboBoxAnatomy
`Label`: Names the field.
`Input`: Holds the text. Focus stays here, and it has `role="combobox"`. The badge is on a wrapper.
`Button`: Opens and closes the list. It is out of the order of Tab.
`Text` with `slot="description"`: Describes the field. Optional.
`FieldError`: Shows the errors of the field while it is invalid. Optional.
`Popover`: Places the list by the field. The part sets `--trigger-width`, which a stylesheet can use for its width.
`ListBox`: Holds the items.
`ListBoxItem`: One suggestion. Its `id` is its key.
```

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

The picture draws the Popover in place, open, so that it can carry a number. The real Popover opens in a layer at the end of the page.

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

`selectedKey` holds the key of the selected item, or `null`, and `inputValue` holds the text in the input. How you pass them picks who keeps them. Type in a field, pick an item, then press Reset the form:

```brm demo ComboBoxStateDemo

```

- `selectedKey` and `inputValue` alone, or nothing, make the field keep its own state. `selectedKey=('cat')` and `inputValue=('Cat')` are where it starts. Pick another item and the field keeps the pick.
- `$bind(signal)` writes your signal. Change the signals and the field follows, as the third button shows. Set the key and the text together, since the text in the input is its own value.
- `selectedKey=$bind(signal, (next) => ...)` asks you first. The field shows what you keep, so a request that you ignore leaves the old key. Press Lock and pick an item in the last field: the key stays, but the input keeps the text of the item that was picked, since the text is a state of its own. It also stays after the field loses focus when the old key is not `null`.
- `isOpen` holds whether the list is open in the same way.
- `onSelectionChange`, `onInputChange` and `onOpenChange` get each change, in every shape.
- A ComboBox is a form field. A reset of its form gives back the key and the text that it started with, and closes the list. With `$bind`, the reset is a write to your signal, and a setter can refuse it. See [State](./state.md#form-reset).
- The server renders the hidden input with the key, so the value goes with the form before the code loads.

## Styling

Style the field with the data attributes above, such as `[data-open]` and `[data-invalid]`. The input, the Button and the items show their own attributes. See [Styling](./styling.md).

This stylesheet styles the box, the Button and the list: rest, hover, focus in the input, open, invalid, and the items with hover, the active item, selected and disabled. Its tokens are at the top, and they follow the color scheme. Focus stays in the input, so the active item shows `data-focused`. Press Save with the field empty to see the invalid look. The page sets `isInvalid` itself.

```brm styled ComboBoxStyled

```

## Use cases

### A required field in a form

`isRequired` makes the input required, and `name` sends the key of the selected item. The browser blocks the submit of an empty field and shows its own message on the input. The ComboBox does not copy that message into the FieldError. An error of your own is `isInvalid` with a message in the FieldError, as the demo does for Japan, and the demo clears it when the selection changes. Reset gives the field its start state back.

```brm demo ComboBoxFormDemo

```

### A name that is not on the list

`allowsCustomValue` keeps what was typed, and the form gets the text. `menuTrigger="focus"` opens the list when the input gets focus. Typed text that differs from the selected item clears the selection when the field commits (blur, Enter with no active item, or Escape), or when the text becomes empty. The demo tells a team member from a guest by the key.

```brm demo ComboBoxCustomDemo

```

## Typing and choosing

- Typing opens the list, and it shows the items whose text contains what was typed, in any case. The list closes when no item matches. Clearing the text clears the selection.
- `defaultFilter` decides when an item matches, such as `(text, input) => text.startsWith(input)`.
- `menuTrigger="focus"` opens the list when the input gets focus, and `"manual"` opens it only with the keys and the Button.
- ArrowDown and ArrowUp open the list with all of its items, and move through its items, and go round at the ends. Focus stays in the input, and `aria-activedescendant` names the active item. The pointer makes an item active too.
- Enter and a press pick an item. Its text goes in the input, and the list closes. With no active item, Enter closes the list as Escape does. While the list is closed, Enter sends the form.
- The Button opens and closes the list, with all of its items, and focus stays in the input. It is out of the order of Tab, as the keys of the input do the same.

## Closing

- Escape closes the list, and puts the text of the selected item back in the input, or clears it when nothing is selected. It never clears the selection. An Escape with nothing to undo goes on to the element around, such as a Dialog.
- Focus that leaves the field does the same.
- `allowsCustomValue` keeps what was typed. When the field commits, text that is not the text of the selected item clears the selection.
- `isRequired` makes the input required, with `aria-required`.

## Forms

`name` sends the key of the selected item with its form, or the text of the input with `allowsCustomValue`. `formValue="key"` or `"text"` chooses. The value goes with the form also before the code of the page loads. A server error for the `name` in a [Form](./form.md) shows in the FieldError until the user picks an item. An error that arrives after a pick does not show until the form is reset, so for that case set `isInvalid` yourself.

## How it filters

The items are on the page while the list is open, so the ComboBox hides those that do not match, and the keys skip hidden items. A section with no item left is hidden too. To filter the items yourself, such as from a server, bind `inputValue` and render only the items that you want in a `#for`.
