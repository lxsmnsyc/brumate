# DisclosureGroup

Disclosures that open one at a time, such as an accordion.

```brm demo DisclosureGroupDemo

```

- Each [Disclosure](./disclosure.md) names itself with `id`, and `expandedKeys` is the list of the open ones. See [State](./state.md).
- `allowsMultipleExpanded` lets several be open.
- `isDisabled` disables every trigger.

## Anatomy

```brm anatomy DisclosureGroupAnatomy
`DisclosureGroup`: Holds the keys of the open disclosures.
`Disclosure`: One section. It names itself with `id`.
`Button`: The trigger of a disclosure, with `slot="trigger"`.
`DisclosurePanel`: The content of a disclosure.
```

```html
<DisclosureGroup>
  <Disclosure>
    <Button slot="trigger" />
    <DisclosurePanel />
  </>
</>
```

## Props

```props DisclosureGroup

```

## Data attributes

| Attribute       | When                   |
| --------------- | ---------------------- |
| `data-disabled` | The group is disabled. |

Each [Disclosure](./disclosure.md#data-attributes) shows its own attributes.

## Keyboard

The group takes no keys of its own. Each trigger works as in a [Disclosure](./disclosure.md#keyboard), and `Tab` moves between them.

## Controlled and uncontrolled

`expandedKeys` holds the keys of the open disclosures. How you pass it picks who keeps it:

```brm demo DisclosureGroupStateDemo

```

- `expandedKeys` alone, or nothing, makes the group keep its own list. It starts empty. `expandedKeys=(['b'])` is where that list starts.
- `expandedKeys=$bind(signal)` writes your signal. Change the signal and the group follows. The last two groups share one signal.
- `expandedKeys=$bind(signal, (next) => ...)` asks you first. The group shows what you keep, so a request that you ignore leaves the old list. Press Lock, then a trigger in the last group.
- `onExpandedChange` gets the new list when a press changes it. It does not run when you write the signal.
- The `isExpanded` of a disclosure inside the group is not read: the group decides.
- A group is not a form field, so a form reset leaves it as it is. The server renders the keys it starts with. See [State](./state.md).

## Styling

Style the group with `[data-disabled]`, and each disclosure with its [data attributes](./disclosure.md#styling). See [Styling](./styling.md).

This stylesheet makes a stack of cards. The open card gets an accent edge and a minus in place of the plus, and the triggers show hover, press and a two-band focus ring.

```brm styled DisclosureGroupStyled

```

## Use cases

### Expand all and collapse all

`allowsMultipleExpanded` lets several be open, and `expandedKeys=$bind(open)` lets two buttons write the list.

```brm demo DisclosureGroupAllDemo

```

### Steps that open in turn

A press of Continue writes the list, so the next step opens and the first closes.

```brm demo DisclosureGroupStepsDemo

```
