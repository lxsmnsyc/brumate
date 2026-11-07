---
summary: A group of fields that a disabled state reaches.
---

# Fieldset

A `<fieldset>` with a `<legend>`. A disabled `Fieldset` disables every field and button inside it.

```brm demo FieldsetDemo

```

- `isDisabled` on a `Fieldset` or a [Form](./form.md) disables the fields below it. A TextField, a Checkbox, a Select, a Slider, a Button and the other parts read it with their own `isDisabled`.
- A disabled field posts nothing with its form.
- A `Fieldset` in a disabled one is disabled too. A part with `isDisabled=(false)` in a disabled `Fieldset` stays disabled.
- It takes the attributes of a `<fieldset>`, such as `name` and `form`.

## Anatomy

```brm anatomy FieldsetAnatomy
`Fieldset`: The `<fieldset>`. It gives its fields the disabled state.
`Legend`: The title. The browser names the group with it.
`TextField`: A field of the group. It reads the disabled state of the `Fieldset`.
```

```brm
<Fieldset>
  <Legend />
  <TextField />
</>
```

## Props

```props Fieldset

```

```props Legend

```

Both take the attributes of their element too, and they come last.

## Data attributes

| Attribute       | When                                                        |
| --------------- | ----------------------------------------------------------- |
| `data-disabled` | On a `Fieldset` that is disabled, or inside a disabled one. |

A field inside shows its own `data-disabled`.

## Controlled and uncontrolled

A `Fieldset` keeps no state. `isDisabled` can be a signal, and the fields follow it. See [State](./state.md).

## Styling

Style a `Fieldset` with `[data-disabled]`, and give the `Legend` a `class`. See [Styling](./styling.md).

This stylesheet draws a border, a legend and a dashed, faded group while it is disabled. Press the switch to see the fields lock.

```brm styled FieldsetStyled

```
