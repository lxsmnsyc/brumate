# SelectionIndicator

A mark of the selected item, such as a bar under the selected tab, which moves to the next item when the selection changes.

```brm demo SelectionIndicatorDemo

```

```html
<Tab id="overview">
  Overview
  <SelectionIndicator class="bar" />
</Tab>
```

```css
.bar {
  position: absolute;
  inset: auto 0 0;
  height: 2px;
  transition-duration: 0.25s;
}
```

- Put a `SelectionIndicator` in each item that can be selected: a [Tab](./tabs.md), a [ToggleButton](./toggle-button-group.md) in a group, a [Radio](./radio-group.md), a [ListBoxItem](./list-box.md), a [GridListItem](./grid-list.md) or a [Tag](./tag-group.md).
- It renders only in the selected item, with `data-selection-indicator` and `data-selected`, and is hidden from screen readers, since the item says that it is selected.
- `as` sets its element, a `<span>` by default.

## Use cases

### A pill behind a group of buttons

In a [ToggleButtonGroup](./toggle-button-group.md), the indicator is a pill under the text of the selected button. It slides to the next one when you press it, and it stays still with reduced motion.

```brm demo SelectionIndicatorToggleDemo

```

## Anatomy

```html
<Tab>
  <SelectionIndicator />
</>
```

It goes in any item that can be selected.

## Props

```props SelectionIndicator

```

## Data attributes

| Attribute                  | When                                          |
| -------------------------- | --------------------------------------------- |
| `data-selection-indicator` | Always. It marks the element.                 |
| `data-selected`            | Always. It renders only in the selected item. |

## Styling

Style the indicator with its own CSS, such as `position`, `transition-duration` and `transition-timing-function`. It has no state of its own and takes no keys. See [Styling](./styling.md).

## The move

When the selection changes, the indicator of the new item moves from where the last one was, in the same list or group.

- Its CSS sets the move: `transition-duration` and `transition-timing-function`. With no duration, it does not move, so a page that wants no motion sets none.
- It does not move when the user asks for less motion.
- It moves with a transform, from the place and the size of the last indicator, so the item needs no layout of its own for it.
