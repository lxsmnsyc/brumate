# List and tree data

State for the items of a collection that an app changes: the items, a selection, and the changes that add, move and remove them. They hold the items of a list or a tree in a signal.

```brm demo DataDemo

```

```brm
<script>
  import { $bind } from 'brumate/signals';
  import { treeData } from '@brumate/ui/data.brm.ts';

  const { items, selectedKeys, append, removeSelectedItems } = treeData<File>({
    initialItems: files,
  });
</script>

<Tree aria-label="Files" items=items item=file selectionMode="multiple" selectedKeys=$bind(selectedKeys) />
<Button onPress=(() => append('docs', { id: 'new', name: 'new.md' }))>Add</Button>
<Button onPress=removeSelectedItems>Remove selected</Button>
```

Both are [reactive modules](../docs/reactive-modules.md): a component calls one at the top level of its script and destructures what it needs. The items and the selection are signals of the component, so the page state holds them and the server renders them.

## `listData`

```ts
const { items, selectedKeys, append, remove } = listData<Pet>(
  { initialItems: pets, initialSelectedKeys: [], initialFilterText: '' },
  (pet) => pet.name,
  (pet, text) => pet.name.includes(text),
);
```

- The first argument holds the values to start with: `initialItems`, `initialSelectedKeys` and `initialFilterText`.
- `getKey`, the second, gives the key of an item. It is the item's `id`, or else its `key`, without it.
- `filter`, the third, says whether an item shows for the text of the filter. All items show without it.
- The functions are arguments of their own, not options, because the page state holds the options, and it cannot hold a function.

It gives:

- `items`, the items that the filter keeps, `selectedKeys` and `filterText`.
- `getItem(key)`.
- `insert(index, ...items)`, `insertBefore(key, ...items)`, `insertAfter(key, ...items)`, `append(...items)` and `prepend(...items)`.
- `remove(...keys)` and `removeSelectedItems()`. A removed item leaves the selection.
- `move(key, toIndex)`, and `moveBefore(key, keys)` and `moveAfter(key, keys)`, which move the items of `keys` together, in their order, next to the item of `key`.
- `update(key, item)`.
- `setSelectedKeys(keys)`, `addKeysToSelection(keys)`, `removeKeysFromSelection(keys)` and `setFilterText(text)`.

## `treeData`

```ts
const { items, append, move, remove } = treeData<File>(
  { initialItems: files, initialSelectedKeys: [] },
  (file) => file.path,
  (file) => file.files,
);
```

- `getKey` and `getChildren` are the second and third arguments. Without them, an item's key is its `id` or `key`, and its children are its `children`.
- `items` are nodes, which a [Tree](./tree.md) takes: each has its `id`, the key of its parent as `parentKey`, the item as `value`, and its `children` as nodes, or null for an item without children.

It gives:

- `items` and `selectedKeys`.
- `getItem(key)`, the node of a key anywhere in the tree.
- `insert(parentKey, index, ...items)`, `insertBefore(key, ...items)`, `insertAfter(key, ...items)`, `append(parentKey, ...items)` and `prepend(parentKey, ...items)`. A `parentKey` of null is the top of the tree.
- `remove(...keys)` and `removeSelectedItems()`. A removed node takes its children with it, and they leave the selection.
- `move(key, toParentKey, index)`, `moveBefore(key, keys)` and `moveAfter(key, keys)`. A node cannot move into itself or a node inside it.
- `update(key, item)`, which builds the node again from the item, with its children.
- `setSelectedKeys(keys)`.

## Notes on the data

- A selection is an array of keys, as the parts take it, not a `Set`, and there is no `'all'`.
- A node of tree data has an `id`, not a `key`, as the items of a Tree have.
- `getKey`, `filter` and `getChildren` are arguments of their own, as above.
