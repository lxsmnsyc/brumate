---
name: brumate-ui
description: Builds pages with the parts of @brumate/ui, the accessible unstyled components for brumate, such as TextField, Select, ListBox, Menu, Popover, Dialog, Table, Calendar and ColorPicker. Use it when a task imports from `@brumate/ui`, composes fields and collections, binds their state with `$bind`, passes `as` or `ref`, or styles them with `data-*` attributes. Use the brumate skill for the `.brm` syntax itself.
---

# Using @brumate/ui

The parts render the markup, roles and ARIA attributes, handle the keyboard, pointer and focus, and render no CSS. You compose them in a `.brm` file, give them state, and style them. Write the `.brm` syntax by the `brumate` skill. This skill covers the parts.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';
  import FieldError from '@brumate/ui/FieldError.brm';
  import Input from '@brumate/ui/Input.brm';
  import Label from '@brumate/ui/Label.brm';
  import TextField from '@brumate/ui/TextField.brm';

  let name = $signal('');
</script>

<form action="/save">
  <TextField name="name" isRequired value=$bind(name)>
    <Label>Name</Label>
    <Input />
    <FieldError />
  </TextField>
  <Button type="submit">Save</Button>
</form>
```

## Rules that agents get wrong

- Import each part from its own file: `import Select from '@brumate/ui/Select.brm'`. Helpers are `.ts` files: `import { toastQueue } from '@brumate/ui/toast.ts'`. There is no barrel file.
- A field is a group of parts. The `TextField` gives the `Label`, the `Input` and the `FieldError` their IDs through a context, so write all of them inside it and pass no `id`, `for` or `aria-labelledby` between them. See [references/composition.md](references/composition.md).
- `slot` picks between parts of one type in a context: `<Text slot="description">`, `<Button slot="increment">`, `<Checkbox slot="selection">`. A slot that the context does not have throws. See [references/slots-and-contexts.md](references/slots-and-contexts.md).
- State is one prop: `value`, `isSelected`, `selectedKey`, `selectedKeys`, `isOpen`. Pass nothing, a plain value (the start), `$bind(signal)` (the part writes your signal) or `$bind(signal, request)` (you decide each write). There is no `defaultValue` or `defaultSelected`. A signal is never a prop value without `$bind`. See [references/state.md](references/state.md).
- Handlers are `onPress`, `onChange`, `onSelectionChange`, `onOpenChange` and `onAction`, not `onClick`. A part calls a change handler only when the kept value changed, and with that value.
- A handler is a function in the attribute. `prevent` and `stop` of `brumate/events` act on DOM events, such as `onSubmit` of a `Form`, not on the `onPress` of a part. A `:prevent` modifier on a part is an error:

```brm wrong: Modifiers apply to elements. Put ":prevent" on the element that the component renders
<script>
  import Button from '@brumate/ui/Button.brm';
</script>

<Button onPress:prevent=(() => {})>Go</Button>
```

- A prop that a part does not take is a type error, found by `brumate-tsc`, not by the compiler:

```brm type-error: TS2561
<script>
  import Button from '@brumate/ui/Button.brm';
</script>

<Button isDisbled>Go</Button>
```

- Keys are the `id` of an item: `<ListBoxItem id="cat">`. A number stays a number: `id=(2)`.
- A part that renders one element takes `as` and `ref`. `ref=$bind(element)` needs `$bind` imported when it goes to a component. See [references/as-and-ref.md](references/as-and-ref.md).
- Render props are `#template` blocks, never markup in a value: `item=file` with `#template file(file) { … }`. A template gets one typed parameter. See [references/templates.md](references/templates.md).
- Style with classes and the `data-*` attributes of the state, such as `[data-pressed]`, `[data-selected]` and `[data-invalid]`. An attribute is there only while the state is on. The component's scoped styles need `:global(.name)` for the elements of a part. See [references/styling.md](references/styling.md).
- An overlay (`Popover`, `Modal`, `Sheet`, `Tooltip`, `ToastRegion`) renders in a layer at the end of `<body>`. Select it by its own class. See [references/overlays.md](references/overlays.md).
- Never name another library as the source of a part's behavior. Describe the part.

## References

Read the file for the part of the work that you do.

- [references/composition.md](references/composition.md): fields (Label, field, FieldError), Select with Popover and ListBox, forms and validation.
- [references/slots-and-contexts.md](references/slots-and-contexts.md): how a part gives props to the parts inside it, and `slot`.
- [references/state.md](references/state.md): the four shapes of state, `$bind` with a request, refused writes, change callbacks, form reset, the state props of every part.
- [references/as-and-ref.md](references/as-and-ref.md): `as` with an element or a component, `ref`, props types.
- [references/templates.md](references/templates.md): `#template` render props, `items` with `item`, `SelectValue render`, toasts.
- [references/styling.md](references/styling.md): the `data-*` attributes, custom properties and transitions.
- [references/collections.md](references/collections.md): ListBox, Menu, GridList, Tree, Table, Tabs, TagGroup and the data helpers.
- [references/overlays.md](references/overlays.md): DialogTrigger, Popover, Modal, Sheet, Tooltip and toasts.
- [references/dates-and-colors.md](references/dates-and-colors.md): date and time fields, Calendar, DatePicker, and the color parts.
- [references/i18n.md](references/i18n.md): `I18nProvider`, locale, direction, time zone and date strings.

## Checking your work

- `npx brumate-tsc --noEmit` type-checks the project, `.brm` files included. A prop that a part does not take is a type error, and so is a wrong value type.
- `npx brumate check --json` compiles every `.brm` file and runs the type check.
- The page of each part, in `website/ui` of the brumate repository, lists its props, data attributes and keys.
