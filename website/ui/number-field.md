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
- `name` sends the number with its form, also before the code of the page loads. It sends the number as it reads in the input, so Enter sends what was typed.
- A reset of the form gives back the first number.
- `isRequired` asks the browser to check the field on a submit, and the `FieldError` shows the message.
- It shows `data-disabled`, `data-readonly`, `data-invalid` and `data-required`.

## Anatomy

```brm anatomy NumberFieldAnatomy
`NumberField`: Holds the parts and keeps the number. It shows the data attributes of the field.
`Label`: Names the input.
`Group`: Draws the input and the two buttons as one box.
`Button`: With `slot="decrement"`. Steps the number down.
`Input`: Shows the number as text and takes the typing and the keys.
`Button`: With `slot="increment"`. Steps the number up.
`Text`: Describes the input, with `slot="description"`.
`FieldError`: Shows while the field is invalid. The picture sets 12, which is above `maxValue`, so the field is invalid and the plus button is disabled.
```

```html
<NumberField>
  <Label />
  <Group>
    <Button slot="decrement" />
    <Input />
    <Button slot="increment" />
  </>
  <Text slot="description" />
  <FieldError />
</>
```

The `Text` and the `FieldError` are optional.

## Props

```props NumberField

```

The [Label, Input, Text and FieldError](./text-field.md#props) are those of a TextField, the [Group](./group.md) is a Group, and the [Buttons](./button.md#props) are Buttons.

## Data attributes

| Attribute       | When                    |
| --------------- | ----------------------- |
| `data-disabled` | The field is disabled.  |
| `data-readonly` | The field is read only. |
| `data-invalid`  | The field has errors.   |
| `data-required` | The field is required.  |

The input, the buttons and the group show [their own attributes](./text-field.md#input-and-textarea).

## Keyboard

Keys act while the input has focus. A key with Shift, Ctrl, Alt or Meta does not step.

| Key                       | Action                                                          |
| ------------------------- | --------------------------------------------------------------- |
| `Tab`                     | Moves focus to the input. The buttons are skipped.              |
| `ArrowUp` or `PageUp`     | Steps the number up by `step`.                                  |
| `ArrowDown` or `PageDown` | Steps the number down by `step`.                                |
| `Home`                    | Goes to `minValue`, when there is one. Else it moves the caret. |
| `End`                     | Goes to `maxValue`, when there is one. Else it moves the caret. |
| `Enter`                   | Reads the number, keeps it in range and formats it again.       |

## Controlled and uncontrolled

`value` holds the number, or `NaN` when the field is empty. How you pass it picks who keeps it:

```brm demo NumberFieldStateDemo

```

- `value` alone, or nothing, makes the field keep its own number. `value=(2)` is where that number starts, and a new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the input follows. The first button writes 7 to the third field.
- `value=$bind(signal, (next) => ...)` asks you first. The field shows the number that you keep. Press Lock and press ArrowUp, a button, or type 9 and press Enter in the last field: the input goes back to the kept number, and so does the hidden input that a form sends.
- `onChange` gets the number that the user asked for in every shape, also when your request refuses it.
- A reset of the form gives back the number that the field started with, as a write: with `$bind(signal, request)`, your request can refuse it, and the field then shows the kept number.
- The text that the user is typing, before focus leaves or Enter, is not the value yet. A form posts the number as it reads in the input.
- The server renders the number it starts with. See [State](./state.md).

## Styling

Style the field with the data attributes above, and the buttons with `[data-disabled]`, which they show at the ends of the range. See [Styling](./styling.md).

This stylesheet draws the input and the buttons as one box. It styles rest, hover, press, keyboard focus on the box as two bands, invalid, the buttons at the ends of the range, disabled, the description and the error. Clear the box and press Send. The browser blocks the form and the `FieldError` shows its message.

```brm styled NumberFieldStyled

```

## Use cases

### A quantity with a total

The field is bound to a signal, and the total is a memo of it. `minValue` and `maxValue` keep the number in range and disable the button at each end.

```brm demo NumberFieldTicketsDemo

```

### A percent in a form

`formatOptions` with `style: 'percent'` shows 0.1 as 10%, and the step is counted in hundredths. With `name`, the form sends the number, and Reset gives back the first one. Empty the box and press Send: with `isRequired`, the browser asks for a number.

```brm demo NumberFieldDiscountDemo

```

## Format

- The number shows in the format of the locale, from an [I18nProvider](./i18n-provider.md), and of `formatOptions`, the options of `Intl.NumberFormat`, such as `{ style: 'currency', currency: 'EUR' }` or `{ style: 'percent' }`.
- Typing keeps only text that can become a number, such as `-` or `1,` in German.
- When focus leaves the input, or on Enter, the field reads the number, keeps it between `minValue` and `maxValue`, moves it to the nearest `step` when there is one, and formats it again.

## Stepping

- ArrowUp and ArrowDown, PageUp and PageDown, and the Buttons step the number by `step`, 1 by default, or 1% for a percent. A number off the steps moves to the nearest one first.
- A held Button steps again after 400 milliseconds, 600 for a touch, and then every 60 milliseconds. Focus stays in the input.
- Home and End go to the minimum and the maximum, when there are. Without a limit, they move the caret.
- A key with Shift, Ctrl, Alt or Meta does not step. The arrow keys with Shift still do not select text, since the keys are prevented before the code loads.
- A field with `isDisabled` or `isReadOnly` prevents no keys.
- The wheel steps the number while the input has focus, unless `isWheelDisabled`.
- A Button is disabled when a step would pass the end of the range, and with `isDisabled` or `isReadOnly`.

## Names

The Buttons are named "Increase" and "Decrease" with the Label, or with the `aria-label` of the field, such as "Increase Quantity". `aria-label` and `aria-labelledby` on the field name its input. The Buttons are out of the order of Tab, and control the input. The input has the role of a text box with the description "Number field", since a spin button cannot take focus with VoiceOver.
