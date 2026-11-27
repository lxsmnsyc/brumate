# Your own parts

Build a part of your own with the code that the parts of `@brumate/ui` share. `press`, `hover` and `focusRing` handle the events of an element, and the contexts give a part the props of the part around it. This card uses all three functions:

```brm demo OwnPartDemo

```

- The card presses the same way for a mouse, a touch, Enter, Space and a screen reader, and calls `picked` once for each press.
- It shows `data-pressed`, `data-hovered` and `data-focus-visible`, so the CSS of the [Button](./button.md) styles it.
- Each function returns its state as signals and one handler for each event of the element. You put the handlers on the element.

## The modules

Each function is in a module of its own, and you import it by its path:

| Import                                        | Returns                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `press` from `@brumate/ui/press.brm.ts`       | `pressed`, and handlers for the pointer, the keys, `click` and `blur`                        |
| `hover` from `@brumate/ui/hover.brm.ts`       | `hovered`, and `onPointerEnter` and `onPointerLeave`                                         |
| `focusRing` from `@brumate/ui/focus.brm.ts`   | `focused`, `focusVisible`, and `onFocus`, `onBlur`, `onKeyDown` and `onPointerDown`          |
| `interact` from `@brumate/ui/interact.brm.ts` | all of the above for one element, with the shared events already joined, as a Button uses it |

The types of the events, `PressEvent` and `HoverEvent`, are in `@brumate/ui/events.ts`.

## press

`press(disabled, onPress, onPressStart, onPressEnd, onPressUp, onPressChange)` starts a press on a pointer, Enter or Space, or a click with no pointer before it, such as from a screen reader. Pass `undefined` for a handler you do not need.

- `onPress` runs when the press ends over the element. A press that leaves the element and ends outside runs `onPressEnd` only.
- `event.pointerType` says what pressed: `mouse`, `pen`, `touch`, `keyboard` or `virtual`.
- A disabled element starts no press. Pass the value of your `isDisabled` prop.
- The element takes pointer capture when a press starts, so its `pointerup` reaches it even when the pointer ends outside. See [How the parts resume](./resuming.md).
- Wrap `onKeyDown` and `onKeyUp` in `prevent(handler, 'Space')` from `brumate/events`, so Space does not scroll the page. A submit or reset button keeps Space, so the browser sends its form.
- Put `role="button"` and `tabindex="0"` on an element that is not a `<button>`, so Tab and a screen reader reach it.

## hover

`hover(disabled, onHoverStart, onHoverEnd, onHoverChange)` reports a hover of a mouse or a pen.

- A touch never hovers. A tap sends pointer events, and `hover` leaves them out.
- A disabled element never hovers.

## focusRing

`focusRing(onFocus, onBlur, onFocusChange)` reports focus, and whether the focus shows as a ring.

- `focusVisible` follows the `:focus-visible` of the browser, such as after Tab. A key pressed after a pointer moved focus shows the ring too.
- CSS can use `:focus-visible` directly. Use `focusVisible` when the ring is on another element than the one with focus, such as the `<label>` of a [Checkbox](./checkbox.md), whose input has focus.
- `onFocus` checks that the element still has focus, since a handler runs after the event and focus can have moved on.

## Join the handlers

An element has one handler for each event. `press` and `focusRing` both need `pointerdown`, `keydown` and `blur`, so write one function for each that calls both, as the demo does:

```brm
<script>
  import { focusRing } from '@brumate/ui/focus.brm.ts';
  import { press } from '@brumate/ui/press.brm.ts';

  const { pressed, onPointerDown: pressPointerDown } = press(false, undefined, undefined, undefined, undefined, undefined);
  const { focusVisible, onPointerDown: ringPointerDown } = focusRing(undefined, undefined, undefined);

  function pointerDown(event: PointerEvent & { currentTarget: HTMLElement }) {
    ringPointerDown();
    pressPointerDown(event);
  }
</script>
```

`interact` does this for you, for an element that presses, hovers and shows focus.

## The contexts

A part gives the parts inside it their props through a context. The contexts are exported from `@brumate/ui/contexts.ts`, so a component of your own can read them too, at any depth inside the part. Read one with `$getContext(Context, undefined)`, which gives `undefined` outside the part. A context that holds a store gives it as `state`, and `$store` reads it:

```brm
<script>
  import { $getContext, $store } from 'brumate/signals';
  import { DisclosurePanelContext } from '@brumate/ui/contexts.ts';

  const given = $getContext(DisclosurePanelContext, undefined);
  const disclosure = given ? $store(given.state) : undefined;
</script>

<p>{disclosure?.isExpanded ? 'Open' : 'Closed'}</p>
```

Put this component anywhere inside a [Disclosure](./disclosure.md), and it follows the disclosure. The same shape reads the others:

| Context                           | Given by                                                            | Holds                                                                         |
| --------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `ButtonContext`                   | Dialog, Disclosure, DialogTrigger, Popover, NumberField and others  | The props and handlers of its Buttons, by `slot`, such as `close` in a Dialog |
| `LinkContext`                     | Breadcrumbs, Popover, Modal, Tooltip                                | The props and handlers of its Links, such as `isCurrent` in Breadcrumbs       |
| `HeadingContext`                  | Dialog                                                              | The `id` of the Heading with `slot="title"`                                   |
| `TextContext`                     | Fields, ListBoxItem, MenuItem, Toast                                | The `id` of a Text with `slot="description"` or `slot="errorMessage"`         |
| `LabelContext`                    | Fields, Meter, ProgressBar, Slider                                  | The `id` of the Label, and the `for` of its input                             |
| `InputContext`, `TextAreaContext` | TextField, SearchField, NumberField, ComboBox, ColorField           | The attributes of the input, and the handlers of the field                    |
| `FieldErrorContext`               | Fields                                                              | `isInvalid` and `errors`, which a FieldError shows                            |
| `FormContext`                     | Form                                                                | `validationBehavior` and the `validationErrors` of the server                 |
| `DisabledContext`                 | Fieldset, Form                                                      | `true` while the fieldset or the form is disabled                             |
| `GroupContext`                    | NumberField, ColorField, DatePicker, DateRangePicker                | `isDisabled` and `isInvalid` of the group                                     |
| `CheckboxGroupContext`            | CheckboxGroup, and the rows of a GridList, Table or Tree            | Its `value` and states, and `toggle`                                          |
| `RadioGroupContext`               | RadioGroup                                                          | Its `value` and states, and `select`                                          |
| `ToggleGroupContext`              | ToggleButtonGroup                                                   | `selectionMode`, `selectedKeys`, and `toggle`                                 |
| `ToolbarContext`                  | Toolbar                                                             | `true` inside a toolbar                                                       |
| `ToggleButtonContext`             | Nothing in `@brumate/ui`: set it yourself                           | The props and handlers of a ToggleButton, with `isSelected` and `onChange`    |
| `SeparatorContext`                | Nothing in `@brumate/ui`: set it yourself                           | The props of a Separator, such as `orientation`                               |
| `FieldInputContext`               | Autocomplete, ComboBox, ListBox, Menu                               | The attributes that a part around a field gives its Input or TextArea         |
| `DisclosurePanelContext`          | Disclosure                                                          | `isExpanded`, `isDisabled` and the IDs, and `expand`                          |
| `DisclosureGroupContext`          | DisclosureGroup                                                     | `expandedKeys`, and `toggle`                                                  |
| `OverlayTriggerContext`           | DialogTrigger, MenuTrigger, Select, ComboBox, DatePicker and others | `isOpen` and the IDs of the trigger and the overlay, and `open` and `close`   |
| `DialogContext`                   | Popover, ModalOverlay                                               | The IDs that name the Dialog, and `close`                                     |
| `ModalOverlayContext`             | ModalOverlay                                                        | `close`                                                                       |
| `PopoverGroupContext`             | PopoverGroup                                                        | The `id` that marks the popovers of the group                                 |
| `ColorPickerContext`              | ColorPicker                                                         | Its color as `value` and `color`, and `setValue`                              |
| `ColorSwatchContext`              | ColorSwatchPickerItem                                               | The `color` of the item                                                       |
| `ColorSchemeContext`              | ColorScheme                                                         | The choice and the resolved scheme, and `setValue`                            |

The types of each context are next to it in `contexts.ts`, with a comment for each field.

## Give props to a part

A context also goes the other way: set it, and the parts inside take its props. A Button with a `slot` takes the props of that slot, and a Button with no slot takes those of `default`:

```brm
<script>
  import { $memo, $setContext, $signal, $toStore } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';
  import { ButtonContext } from '@brumate/ui/contexts.ts';

  let count = $signal(0);
  const buttons = $memo({
    slots: {
      default: {},
      increment: { 'aria-label': 'Add one' },
      decrement: { 'aria-label': 'Take one', isDisabled: count <= 0 },
    },
  });
  $setContext(ButtonContext, {
    state: $toStore(buttons),
    handlers: {
      slots: {
        increment: { onPress: () => count++ },
        decrement: { onPress: () => count-- },
      },
    },
  });
</script>

<Button slot="decrement">-</Button>
<span>{count}</span>
<Button slot="increment">+</Button>
```

- The props of the context go under those that you write on the part, so `aria-label` on a Button wins.
- A handler of the context runs, and then the handler on the part.
- A `slot` that the context does not name is an error, so a typo shows. Name `default` for the parts with no slot.
- `slot={null}` on a part reads no context.

## Related

- [Keyboard and focus](./keyboard-and-focus.md): the rules that a part of your own should follow.
- [Styling](./styling.md): the data attributes that the parts set.
- [How the parts resume](./resuming.md): why the handlers run after the event.
- [Context](../docs/context.md): `$getContext`, `$setContext` and stores.
