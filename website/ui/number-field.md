# NumberField

A field for a number, in the format of the locale, with buttons that step it.

```brm demo NumberFieldDemo

```

```html
<NumberField minValue=(0) step=(5) value=$bind(width)>
  <Label>Width</Label>
  <Group>
    <Button slot="decrement">−</Button>
    <Input />
    <Button slot="increment">+</Button>
  </Group>
</NumberField>
```

- A `NumberField` holds a `Label`, a `Group` with an `Input` and two `Button` elements with `slot="decrement"` and `slot="increment"`, and can hold a `Text` with `slot="description"` and a `FieldError`.
- `value` is the number, or `NaN` when the field is empty. It starts its own state, or binds with `$bind`, and `onChange` gets each change. See [State](./state.md).
- `name` sends the number with its form, also before the code of the page loads.
- It shows `data-disabled`, `data-readonly`, `data-invalid` and `data-required`.

## Format

- The number shows in the format of the locale, from an [I18nProvider](./i18n-provider.md), and of `formatOptions`, the options of `Intl.NumberFormat`, such as `{ style: 'currency', currency: 'EUR' }` or `{ style: 'percent' }`.
- Typing keeps only text that can become a number, such as `-` or `1,` in German.
- When focus leaves the input, or on Enter, the field reads the number, keeps it between `minValue` and `maxValue`, moves it to the nearest `step` when there is one, and formats it again.

## Stepping

- ArrowUp and ArrowDown, PageUp and PageDown, and the Buttons step the number by `step`, 1 by default, or 1% for a percent. A number off the steps moves to the nearest one first.
- A held Button steps again after 400 milliseconds, 600 for a touch, and then every 60 milliseconds. Focus stays in the input.
- Home and End go to the minimum and the maximum, when there are.
- The wheel steps the number while the input has focus, unless `isWheelDisabled`.
- A Button is disabled when the number is at its end of the range, and with `isDisabled` or `isReadOnly`.

## Names

The Buttons are named "Increase" and "Decrease" with the Label, out of the order of Tab, and control the input. The input has the role of a text box with the description "Number field", as in React Aria, since a spin button cannot take focus with VoiceOver.
