# DisclosureGroup

Disclosures that open one at a time, such as an accordion.

```brm demo DisclosureGroupDemo

```

- Each [Disclosure](./disclosure.md) names itself with `id`, and `expandedKeys` is the list of the open ones. See [State](./state.md).
- `allowsMultipleExpanded` lets several be open.
- `isDisabled` disables every trigger.

## Anatomy

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

`expandedKeys` holds the keys of the open disclosures. `expandedKeys=(['a'])` starts the group's own state, and `expandedKeys=$bind(signal)` writes your signal. `onExpandedChange` gets the new list on each change. See [State](./state.md).

## Styling

Style the group with `[data-disabled]`, and each disclosure with its [data attributes](./disclosure.md#styling). See [Styling](./styling.md).
