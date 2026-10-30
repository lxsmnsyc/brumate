# Composition

A field is a group of parts. The outer part holds the state and gives the inner parts their IDs and attributes through a context. Write the inner parts inside it, and add no `id`, `for`, `aria-labelledby` or `aria-describedby` between them.

## A text field

`TextField` holds a `Label`, an `Input` (or a `TextArea` for several lines), an optional `Text` with `slot="description"`, and a `FieldError`.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import FieldError from '@brumate/ui/FieldError.brm';
  import Input from '@brumate/ui/Input.brm';
  import Label from '@brumate/ui/Label.brm';
  import Text from '@brumate/ui/Text.brm';
  import TextField from '@brumate/ui/TextField.brm';

  let email = $signal('');
</script>

<TextField name="email" type="email" isRequired value=$bind(email)>
  <Label>Email</Label>
  <Input placeholder="you@example.com" />
  <Text slot="description">We send the receipt here.</Text>
  <FieldError />
</TextField>
```

- The `Label` names the input, the `Text` describes it, and the `FieldError` shows only while the field is invalid.
- `name`, `type`, `isRequired`, `minLength`, `maxLength`, `pattern`, `autoComplete`, `inputMode` and `placeholder` go to the input. `isDisabled`, `isReadOnly` and `isInvalid` set the state of the field and its input.
- With the default `validationBehavior="native"`, the browser checks the field when its form is sent, and the `FieldError` shows the message of the browser. `validate` sets a message of your own. `validationBehavior="aria"` shows the errors of `validate` at once and never blocks the form.
- The same shape holds for `SearchField`, `NumberField`, `DateField`, `TimeField`, `ColorField`, `TokenField`, `CheckboxGroup`, `RadioGroup`, `Slider`, `Select`, `ComboBox` and `DatePicker`: a `Label`, the part's own control, a `Text` and a `FieldError`.

## A form

`Form` is a `<form>` that tells its fields how to validate and gives them the errors of the server. It posts without scripts.

```brm
<script>
  import Button from '@brumate/ui/Button.brm';
  import FieldError from '@brumate/ui/FieldError.brm';
  import Form from '@brumate/ui/Form.brm';
  import Input from '@brumate/ui/Input.brm';
  import Label from '@brumate/ui/Label.brm';
  import TextField from '@brumate/ui/TextField.brm';
</script>

<Form action="/signup" validationErrors=({ email: 'This email has an account' })>
  <TextField name="email" type="email">
    <Label>Email</Label>
    <Input />
    <FieldError />
  </TextField>
  <Button type="submit">Sign up</Button>
</Form>
```

- `validationErrors` holds messages by the `name` of a field. A field shows them until the user edits it.
- A `Button` is `type="button"` by default, so it does not send a form. Use `type="submit"`.
- A field with `name` sends its value with the form, also before the code of the page loads.

## A Select

`Select` holds a `Label`, a `Button` with a `SelectValue`, and a `Popover` with a `ListBox`. The key of the chosen `ListBoxItem` is `selectedKey`, or `null`.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';
  import FieldError from '@brumate/ui/FieldError.brm';
  import Label from '@brumate/ui/Label.brm';
  import ListBox from '@brumate/ui/ListBox.brm';
  import ListBoxItem from '@brumate/ui/ListBoxItem.brm';
  import Popover from '@brumate/ui/Popover.brm';
  import Select from '@brumate/ui/Select.brm';
  import SelectValue from '@brumate/ui/SelectValue.brm';
  import type { Key } from '@brumate/ui/collection.ts';

  let animal = $signal<Key | null>(null);
</script>

<Select name="animal" isRequired selectedKey=$bind(animal)>
  <Label>Favorite animal</Label>
  <Button><SelectValue /></Button>
  <Popover>
    <ListBox>
      <ListBoxItem id="cat">Cat</ListBoxItem>
      <ListBoxItem id="dog">Dog</ListBoxItem>
    </ListBox>
  </Popover>
  <FieldError />
</Select>
```

- The `Popover` goes inside the `Select`, and the `ListBox` inside the `Popover`. A `Select` outside this shape has no list to open.
- The popover keeps the items in the page while it is closed, out of sight, so the Select knows the text of its choice. On the server the `Button` shows the key until the code loads. A `render` template on `SelectValue` names the choice in the HTML too. See [templates.md](templates.md).
- The `Button` is named by the value and the label, and gets `aria-haspopup`, `aria-expanded` and `aria-controls`.
- `ComboBox` has the same shape with an `Input` in place of the `SelectValue`: `Label`, `Group` with `Input` and `Button`, `Popover` with `ListBox`.

## A menu, a dialog, a toggle

- `MenuTrigger` holds a `Button` and a `Popover` with a `Menu`. See [collections.md](collections.md).
- `DialogTrigger` holds a `Button` and a `Popover` or `Modal` with a `Dialog`. See [overlays.md](overlays.md).
- A `Checkbox`, a `Radio` and a `Switch` hide their native input. Draw the box in the children, from the attributes of the label. See [styling.md](styling.md).
