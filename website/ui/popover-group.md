---
summary: Popovers that share focus, such as the menus of a nav bar.
---

# PopoverGroup

Popovers that share focus, such as the menus of a nav bar.

```brm demo PopoverGroupDemo

```

- A non-modal [Popover](./popover.md) closes when focus leaves it. Inside a `PopoverGroup`, focus that goes to the group element, to the trigger or to the panel of another popover of the group does not close it. This is how Headless UI's `PopoverGroup` works.
- Opening a popover of the group, by a press or a click on its trigger, closes the others. So a click on the trigger of the next popover closes the open one and opens the next. Only focus alone, such as Tab to the next trigger, leaves the first one open.
- Focus that goes anywhere else still closes the popover.
- A trigger belongs to the group when it is inside the element of the `PopoverGroup`. A panel belongs to it when its `Popover` is.
- A modal popover is not affected: it makes the rest of the page inert, so focus cannot move to another popover.

## Anatomy

A `PopoverGroup` is one element around triggers and popovers, so this page has no anatomy picture.

```brm
<PopoverGroup>
  <DialogTrigger>
    <Button />
    <Popover isNonModal>
      <Dialog />
    </>
  </>
  <DialogTrigger>
    <Button />
    <Popover isNonModal>
      <Dialog />
    </>
  </>
</>
```

## Props

```props PopoverGroup

```

## Data attributes

| Attribute            | When                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `data-popover-group` | Always, on the group, with its ID. The layer of each of its popovers has `data-popover-group-panel` with the same ID. |

## Keyboard

| Key           | Action                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab`         | At the last element of a panel, moves focus to the next element after its trigger, such as the trigger of the next popover. The panel stays open until that popover opens. |
| `Shift + Tab` | At the first element of a panel, moves focus to its trigger.                                                                                                               |
| `Escape`      | As for any [Popover](./popover.md#keyboard).                                                                                                                               |

The panels render at the end of the page, so the browser alone would send `Tab` from a panel to the end of the page. The group-aware popover moves it to where it would go from the trigger.

## Controlled and uncontrolled

A `PopoverGroup` has no state, so this page has no controlled and uncontrolled shapes. Each popover keeps its own, as on the [Popover](./popover.md#controlled-and-uncontrolled) page. See [State](./state.md) for the parts that have state.

## Styling

A `PopoverGroup` is one element with no style of its own. Style it as the row or column that holds the triggers, such as `display: flex`. See [Styling](./styling.md). It has no stylesheet sample of its own: the popovers inside are styled as on the [Popover](./popover.md#styling) page.

## Use cases

### Not for nested popovers

A popover inside a popover is already part of the layer of its parent, so a press or focus in it closes nothing. A popover inside a popover of a group is not a member of the group, and it closes by the rules of any non-modal popover. Use the group for siblings.
