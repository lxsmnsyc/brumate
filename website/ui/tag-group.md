# TagGroup

A group of tags, which the user can select and remove.

```brm demo TagGroupDemo

```

```html
<TagGroup selectionMode="multiple" onRemove=((keys) => remove(keys))>
  <Label>Categories</Label>
  <TagList>
    #for (tag of tags by tag) {
      <Tag id=tag>{tag}<Button slot="remove">×</Button></Tag>
    }
  </TagList>
</TagGroup>
```

- A `TagGroup` holds a `Label`, a `TagList` with `Tag` elements, and can hold a `Text` with `slot="description"`, which describes the list.
- `selectionMode` is `none`, the default, `single` or `multiple`. A press and Space toggle a tag. `selectedKeys` is the list of the keys of the selected tags, and binds with `$bind`. See [State](./state.md).
- `disabledKeys`, or `isDisabled` on a Tag, keeps tags from focus, selection and removal.

## Anatomy

```html
<TagGroup>
  <Label />
  <TagList>
    <Tag>
      <Button slot="remove" />
    </>
  </>
  <Text slot="description" />
</>
```

The `Button` with `slot="remove"` and the `Text` are optional.

## Props

### TagGroup

```props TagGroup

```

### TagList

```props TagList

```

### Tag

```props Tag

```

## Data attributes

### Tag

| Attribute              | When                                                 |
| ---------------------- | ---------------------------------------------------- |
| `data-selected`        | The tag is selected.                                 |
| `data-disabled`        | The tag is disabled.                                 |
| `data-allows-removing` | The group has `onRemove`, so the tag can be removed. |
| `data-pressed`         | A pointer or a key holds it down.                    |
| `data-hovered`         | A mouse or a pen is over it.                         |
| `data-focused`         | It has focus.                                        |
| `data-focus-visible`   | Its focus shows as a ring.                           |

## Keyboard

Right to left, Left and Right turn around.

| Key                         | Action                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `Tab`                       | Moves focus to the list, at the tag that had focus last, else the first one.           |
| `ArrowDown` or `ArrowUp`    | Moves to the next or the previous tag.                                                 |
| `ArrowRight` or `ArrowLeft` | Moves to the next or the previous tag. Right to left, they turn around.                |
| `Home` or `End`             | Moves to the first or the last tag.                                                    |
| `Enter` or `Space`          | Toggles the tag, with a `selectionMode`.                                               |
| `Delete` or `Backspace`     | Removes the tag, or all the selected tags when it is one of them. It needs `onRemove`. |

## Controlled and uncontrolled

`selectedKeys` holds the keys of the selected tags. `selectedKeys=(['a'])` starts the group's own selection, and `selectedKeys=$bind(signal)` writes your signal. `onSelectionChange` gets the keys after each change. The group never holds the tags: `onRemove` gets the keys, and you remove them from your list. See [State](./state.md).

## Styling

Style a tag with the data attributes above, such as `[data-selected]` and `[data-focus-visible]`. See [Styling](./styling.md).

## Removing

With `onRemove`, the group can remove tags. It gets the keys, and the caller removes them from its list.

- Delete and Backspace remove the tag that has focus, or all the selected tags when it is one of them. Focus moves to the next tag, or to the list when no tag that can take focus stays.
- A `Button` with `slot="remove"` in a tag removes that tag. It is out of the order of Tab, and its label names the tag.
- Focus moves to the next tag, or to the one before when it was the last.

## Focus and keys

- Tab stops at the list once, at the tag that had focus last, or else the first one.
- Up, Down, Left and Right move to the next and the previous tag, and Home and End go to the ends. Right to left, Left and Right turn around.

## Tags

The TagList is a grid, and each Tag is a row with one cell, so a screen reader reaches the Button inside a tag. A Tag shows `data-selected`, `data-disabled`, `data-allows-removing`, `data-pressed`, `data-hovered`, `data-focused` and `data-focus-visible`.
