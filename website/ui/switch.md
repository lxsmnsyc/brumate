# Switch

A native checkbox with `role="switch"`, for a setting that applies at once.

```brm demo SwitchDemo

```

- It is a `<label>` around the input. Draw the switch in the children. See [Styling](./styling.md#boxes).
- `isReadOnly` keeps its state: the click does not toggle it.
- `name` and `value` post with the form.

## Props

```props Switch

```

## Data attributes

The label shows the state:

| Attribute            | When                              |
| -------------------- | --------------------------------- |
| `data-selected`      | The switch is on.                 |
| `data-pressed`       | A pointer or a key holds it down. |
| `data-hovered`       | A mouse or a pen is over it.      |
| `data-focused`       | Its input has focus.              |
| `data-focus-visible` | Its focus shows as a ring.        |
| `data-disabled`      | The switch is disabled.           |
| `data-readonly`      | The switch is read only.          |

## Keyboard

| Key     | Action                                                   |
| ------- | -------------------------------------------------------- |
| `Tab`   | Moves focus to the switch. A disabled switch is skipped. |
| `Space` | Toggles the switch.                                      |

## Controlled and uncontrolled

`isSelected` holds whether the switch is on. How you pass it picks who keeps it:

```brm demo SwitchStateDemo

```

- `isSelected` alone, or nothing, makes the Switch keep its own state. `isSelected` with no value starts it on, and a new value from you replaces it.
- `isSelected=$bind(signal)` writes your signal. Change the signal and the switch follows.
- `isSelected=$bind(signal, (next) => ...)` asks you first. The switch shows what you keep, so a request that you ignore leaves the old state. Press Lock above and click the last switch. The line under the switches shows that Asks keeps its value.
- `onChange` gets the new state in every shape, each time the user toggles the switch.
- A reset of the form gives back the state that the switch started with, as a write: with `$bind(signal, request)`, your request can refuse it.
- The server renders the state it starts with. See [State](./state.md).

A `Text` with `slot="description"` in the children is named in the `aria-describedby` of the input. `isInvalid` marks the switch with `aria-invalid` and `data-invalid`, and a `FieldError` in the children shows then and is named too. Both are inside the label, so the label text includes them.

## Styling

Style the switch from the attributes of the label, such as `[data-selected]` and `[data-focus-visible]`. Draw the track and the knob in the children. See [Styling](./styling.md#boxes). A Switch is one element with the content you give it, so this page has no anatomy picture.

This stylesheet draws a track with a knob that moves. It styles rest, hover, press, on, on and hovered, on and pressed, keyboard focus, read only and disabled. The focus ring has two bands outside the track, so it shows next to the fill.

```brm styled SwitchStyled

```

## Use cases

### A settings panel

Switches in a form post with it: `name` names the field, and a switch that is on posts its `value`, or `on` without one. Turning Airplane mode on turns Wi-Fi off and disables its switch. Reset the settings gives each switch back the state it started with.

```brm demo SwitchSettingsDemo

```

### A switch that saves

A setting that applies at once has no Save button. The switch moves when the user toggles it, and `onChange` starts the save. Toggle it twice in a row: each toggle starts a save, and only the last one reports.

```brm demo SwitchSavingDemo

```
