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

## Removing

With `onRemove`, the group can remove tags. It gets the keys, and the caller removes them from its list.

- Delete and Backspace remove the tag that has focus, or all the selected tags when it is one of them. Focus moves to the next tag, or to the list when no tag that can take focus stays.
- A `Button` with `slot="remove"` in a tag removes that tag. It is out of the order of Tab, and its label names the tag.
- Focus moves to the next tag, or to the one before when it was the last.

## Keyboard

- Tab stops at the list once, at the tag that had focus last, or else the first one.
- The arrow keys move to the next and the previous tag, and Home and End go to the ends. Right to left, Left and Right turn around.

## Tags

The TagList is a grid, and each Tag is a row with one cell, so a screen reader reaches the Button inside a tag. A Tag shows `data-selected`, `data-disabled`, `data-allows-removing`, `data-pressed`, `data-hovered`, `data-focused` and `data-focus-visible`.
