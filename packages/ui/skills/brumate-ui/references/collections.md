# Collections

A collection part holds items with keys. The `id` of an item is its key, a string or a number, and stays one: `id=(2)` selects `2`, not `'2'`. Write the items out, render them from a `#for` with a key, or pass `items` and an `item` template (see [templates.md](templates.md)).

Selection props are the same on every collection: `selectionMode` (`none`, `single`, `multiple`), `selectedKeys` (a list of keys), `disabledKeys`, `disallowEmptySelection` and `onSelectionChange`. Bind `selectedKeys` with `$bind`. See [state.md](state.md).

## ListBox

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import ListBox from '@brumate/ui/ListBox.brm';
  import ListBoxItem from '@brumate/ui/ListBoxItem.brm';
  import type { Key } from '@brumate/ui/collection.ts';

  const animals = ['Cat', 'Dog', 'Kangaroo'];
  let picked = $signal<Key[]>(['Cat']);
</script>

<ListBox aria-label="Animals" selectionMode="multiple" selectedKeys=$bind(picked)>
  #for (animal of animals by animal) {
    <ListBoxItem id=animal>{animal}</ListBoxItem>
  }
</ListBox>
<p>Picked: {picked.join(', ') || 'none'}</p>
```

- A `ListBox` needs `aria-label` or a `Label` to name it. Inside a `Select`, the Select names it and keeps the selection.
- `ListBoxSection` with a `Header` groups items. An item with `Text slot="label"` and `Text slot="description"` needs `hasLabel` and `hasDescription`.

## Menu

`MenuTrigger` holds a `Button` and a `Popover` with a `Menu`. `onAction` on the Menu (or on an item) gets the key of the item.

```brm
<script>
  import { $signal } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';
  import Menu from '@brumate/ui/Menu.brm';
  import MenuItem from '@brumate/ui/MenuItem.brm';
  import MenuTrigger from '@brumate/ui/MenuTrigger.brm';
  import Popover from '@brumate/ui/Popover.brm';
  import Separator from '@brumate/ui/Separator.brm';
  import type { Key } from '@brumate/ui/collection.ts';

  let last = $signal<Key>('nothing yet');
</script>

<MenuTrigger>
  <Button>Edit</Button>
  <Popover placement="bottom start">
    <Menu onAction=((key) => (last = key))>
      <MenuItem id="cut">Cut</MenuItem>
      <MenuItem id="copy">Copy</MenuItem>
      <Separator />
      <MenuItem id="paste" isDisabled>Paste</MenuItem>
    </Menu>
  </Popover>
</MenuTrigger>
<p>Last: {last}</p>
```

- `SubmenuTrigger` wraps the `MenuItem` that opens a submenu and its `Popover` with a `Menu`.
- `MenuSection` with a `Header` groups items. A `Menu` with `selectionMode` selects items like a ListBox.

## Tabs

`Tabs` holds a `TabList` with `Tab` elements and a `TabPanel` for each, with the same `id`. The `TabList` needs `aria-label`. With no `selectedKey`, the first tab is selected. Only the selected panel renders.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Tab from '@brumate/ui/Tab.brm';
  import TabList from '@brumate/ui/TabList.brm';
  import TabPanel from '@brumate/ui/TabPanel.brm';
  import Tabs from '@brumate/ui/Tabs.brm';
  import type { Key } from '@brumate/ui/collection.ts';

  let section = $signal<Key>('intro');
</script>

<Tabs selectedKey=$bind(section)>
  <TabList aria-label="Sections">
    <Tab id="intro">Intro</Tab>
    <Tab id="usage">Usage</Tab>
  </TabList>
  <TabPanel id="intro">Start here.</TabPanel>
  <TabPanel id="usage">Use it like this.</TabPanel>
</Tabs>
```

## Table

`Table` holds a `TableHeader` of `Column` elements and a `TableBody` of `Row` elements, each with a `Cell` per column. It needs `aria-label`, and one `Column` with `isRowHeader`.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Cell from '@brumate/ui/Cell.brm';
  import Checkbox from '@brumate/ui/Checkbox.brm';
  import Column from '@brumate/ui/Column.brm';
  import Row from '@brumate/ui/Row.brm';
  import Table from '@brumate/ui/Table.brm';
  import TableBody from '@brumate/ui/TableBody.brm';
  import TableHeader from '@brumate/ui/TableHeader.brm';
  import type { Key } from '@brumate/ui/collection.ts';

  const files = [
    { id: 'a', name: 'a.txt', size: 12 },
    { id: 'b', name: 'b.txt', size: 40 },
  ];
  let picked = $signal<Key[]>([]);
</script>

<Table aria-label="Files" selectionMode="multiple" selectedKeys=$bind(picked)>
  <TableHeader>
    <Column><Checkbox slot="selection" aria-label="Select all" /></Column>
    <Column id="name" isRowHeader>Name</Column>
    <Column id="size">Size</Column>
  </TableHeader>
  <TableBody>
    #for (file of files by file.id) {
      <Row id=(file.id)>
        <Cell><Checkbox slot="selection" aria-label=(`Select ${file.name}`) /></Cell>
        <Cell>{file.name}</Cell>
        <Cell>{file.size}</Cell>
      </Row>
    }
  </TableBody>
</Table>
```

- `allowsSorting` on a `Column` and `sortDescriptor` (bind it) on the Table sort. The parts do not reorder the rows: sort your list.
- `ResizableTableContainer` with `ColumnResizer` resizes columns.
- `onRowAction` gets the key of the row that Enter acts on.

## GridList, Tree, TagGroup, Disclosure

- `GridList` with `GridListItem`: a list of rows with interactive content. An item can hold a `Checkbox slot="selection"`.
- `Tree` with `TreeItem`: `items` with `children`, an `item` template, `selectedKeys` and `expandedKeys`. A `Button slot="chevron"` in the item opens and closes it.
- `NavigationTree` with `NavigationTreeItem`: links in a tree, with `expandedKeys`.
- `TagGroup` holds a `Label` and a `TagList` of `Tag` elements. The group never holds the tags: `onRemove` gets the keys and you remove them from your list. A `Button slot="remove"` in the tag removes it.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';
  import Label from '@brumate/ui/Label.brm';
  import Tag from '@brumate/ui/Tag.brm';
  import TagGroup from '@brumate/ui/TagGroup.brm';
  import TagList from '@brumate/ui/TagList.brm';
  import type { Key } from '@brumate/ui/collection.ts';

  let tags = $signal(['News', 'Travel', 'Music']);
  let picked = $signal<Key[]>([]);
</script>

<TagGroup
  selectionMode="multiple"
  selectedKeys=$bind(picked)
  onRemove=((keys) => (tags = tags.filter((tag) => !keys.includes(tag))))
>
  <Label>Categories</Label>
  <TagList>
    #for (tag of tags by tag) {
      <Tag id=tag>{tag}<Button slot="remove">x</Button></Tag>
    }
  </TagList>
</TagGroup>
```

- `Disclosure` holds a `Button slot="trigger"` and a `DisclosurePanel`. `isExpanded` is its state. `DisclosureGroup` opens several, with `expandedKeys`.

## Data helpers

`listData` and `treeData` from `@brumate/ui/data.brm.ts` are reactive modules that hold the items and the selection in signals, with `append`, `remove`, `move` and `removeSelectedItems`. Call one at the top level of the script and destructure what you need.

```brm
<script>
  import { $bind } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';
  import ListBox from '@brumate/ui/ListBox.brm';
  import ListBoxItem from '@brumate/ui/ListBoxItem.brm';
  import { listData } from '@brumate/ui/data.brm.ts';

  interface Item {
    id: string;
    name: string;
  }

  const { items, selectedKeys, removeSelectedItems } = listData<Item>({
    initialItems: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ],
  });
</script>

<ListBox aria-label="Items" selectionMode="multiple" items=items item=row selectedKeys=$bind(selectedKeys) />
<Button onPress=removeSelectedItems>Remove selected</Button>

#template row(row: Item) {
  <ListBoxItem id=(row.id)>{row.name}</ListBoxItem>
}
```
