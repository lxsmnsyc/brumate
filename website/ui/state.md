# State

A part with state has one prop for it, such as `isSelected` of a `Checkbox` or `value` of a `TextField`. How you pass it picks who keeps the state.

```html
<!-- The part keeps its own state, which starts off. -->
<Checkbox>Subscribe</Checkbox>

<!-- The part keeps its own copy, which starts on. A new value from you replaces it. -->
<Checkbox isSelected>Subscribe</Checkbox>

<!-- The part writes your signal. -->
<Checkbox isSelected=$bind(subscribed)>Subscribe</Checkbox>

<!-- The part asks you. It shows what you keep. -->
<Checkbox isSelected=$bind(subscribed, (next) => { if (!locked) subscribed = next; })>Subscribe</Checkbox>
```

- Each part also calls `onChange` with the new value, in every shape.
- A value of `null` is a value like any other, such as the `value` of a `RadioGroup` with nothing chosen.
- On the server, nothing writes, so every shape renders the value that it starts with.

There is no `defaultSelected` or `defaultValue`: a `let` prop of brumate already does both. See [Props that the component writes](../docs/components.md#props-that-the-component-writes).

| State          | Parts                                                     |
| -------------- | --------------------------------------------------------- |
| `isSelected`   | `ToggleButton`, `Checkbox`, `Switch`                      |
| `value`        | `TextField`, `SearchField`, `CheckboxGroup`, `RadioGroup` |
| `selectedKeys` | `ToggleButtonGroup`                                       |
