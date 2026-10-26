# The parts of @brumate/ui

`@brumate/ui` has accessible, unstyled parts that follow React Aria Components, with the names and props of that library: `isDisabled`, `onPress`, `isSelected`. Each part is a `.brm` file that you import by its path, such as `@brumate/ui/Button.brm`. Read the page of a part in `website/ui` for its props and its `data-*` attributes.

## Use a part

```brm
<script>
  import { $signal } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';

  let count = $signal(0);
</script>

<Button class="button" onPress=(() => count++)>Pressed {count} times</Button>
<Button class="button" isDisabled>Disabled</Button>
```

- A part renders the markup, the roles and the ARIA attributes, and no CSS. Style it with your classes and its `data-*` attributes, such as `[data-pressed]` and `[data-focus-visible]`. An attribute is there only while its state is on.
- A `class` that you pass adds to the classes of the part. Attributes and handlers that you pass go to the element that it renders.
- A part takes `as` to render another element.
- Use `onPress` of a `Button`, not `onClick`, so a mouse, a touch, a key and a screen reader act the same.

## State is one prop

A part with state has one prop for it, such as `isSelected` of a `Checkbox`, `value` of a `TextField` and `isOpen` of a `DialogTrigger`. How you pass it picks who keeps the state:

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Checkbox from '@brumate/ui/Checkbox.brm';

  let subscribed = $signal(true);
  let locked = $signal(false);
</script>

<Checkbox>Keeps its own state, which starts off</Checkbox>
<Checkbox isSelected>Keeps its own copy, which starts on</Checkbox>
<Checkbox isSelected=$bind(subscribed)>Writes your signal</Checkbox>
<Checkbox
  isSelected=$bind(subscribed, (next) => {
    if (!locked) {
      subscribed = next;
    }
  })
>The setter decides</Checkbox>
```

- There is no `defaultSelected` or `defaultValue`. The shapes above do both.
- Each part also calls `onChange` with the new value, in every shape.
- On the server nothing writes, so every shape renders the value that it starts with.

## Parts that hold parts

A part that holds other parts gives them their IDs and state through a context, so compose them as in the examples. `slot` picks between parts of one type.

A field names its label, input, description and errors for each other:

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
  <Input />
  <Text slot="description">We send the receipt here.</Text>
  <FieldError />
</TextField>
```

A trigger opens an overlay from the button inside it. A `Heading` with `slot="title"` names the dialog, and a `Button` with `slot="close"` closes the overlay around it:

```brm
<script>
  import Button from '@brumate/ui/Button.brm';
  import Dialog from '@brumate/ui/Dialog.brm';
  import DialogTrigger from '@brumate/ui/DialogTrigger.brm';
  import Heading from '@brumate/ui/Heading.brm';
  import Modal from '@brumate/ui/Modal.brm';
  import ModalOverlay from '@brumate/ui/ModalOverlay.brm';
</script>

<DialogTrigger>
  <Button>Delete the draft</Button>
  <ModalOverlay transition>
    <Modal>
      <Dialog role="alertdialog">
        <Heading slot="title" level=(4)>Delete the draft?</Heading>
        <p>It cannot come back.</p>
        <Button slot="close">Cancel</Button>
        <Button slot="close">Delete</Button>
      </Dialog>
    </Modal>
  </ModalOverlay>
</DialogTrigger>
```

Tabs pair each `Tab` with the `TabPanel` of the same `id`:

```brm
<script>
  import Tab from '@brumate/ui/Tab.brm';
  import TabList from '@brumate/ui/TabList.brm';
  import TabPanel from '@brumate/ui/TabPanel.brm';
  import Tabs from '@brumate/ui/Tabs.brm';
</script>

<Tabs>
  <TabList aria-label="Planets">
    <Tab id="mercury">Mercury</Tab>
    <Tab id="venus">Venus</Tab>
  </TabList>
  <TabPanel id="mercury">The closest planet to the Sun.</TabPanel>
  <TabPanel id="venus">The hottest planet.</TabPanel>
</Tabs>
```

A collection reads its items from the page, so they can come from a `#for`. Each item has an `id`, which is its key:

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import ListBox from '@brumate/ui/ListBox.brm';
  import ListBoxItem from '@brumate/ui/ListBoxItem.brm';
  import type { Key } from '@brumate/ui/collection.ts';

  let animals = $signal<Key[]>(['cat']);
  const names = ['Aardvark', 'Cat', 'Dog'];
</script>

<ListBox aria-label="Animals" selectionMode="multiple" selectedKeys=$bind(animals)>
  #for (name of names by name) {
    <ListBoxItem id=(name.toLowerCase())>{name}</ListBoxItem>
  }
</ListBox>
```

## Rules

- Give a part with no visible text an `aria-label`, such as a `ListBox` or a `TabList`.
- Use a native element when it is enough. A plain `<button>` needs no part.
- A part of a group, such as `Tab` in `Tabs` or `Radio` in `RadioGroup`, works only inside its group.
- A component of your own that wraps a part forwards `{...rest}` to it, so the caller's props and handlers reach the part.
