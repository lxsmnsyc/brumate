// Type tests of the parts that take values. `brumate-tsc --noEmit` checks this file, and each
// `@ts-expect-error` must be an error. The type of `items` reaches `item`, `getTextValue` and the
// other props that read an item, so a wrong field of an item is an error.

import GridList from '../src/GridList.brm';
import ListBox from '../src/ListBox.brm';
import type { ListBoxProps } from '../src/ListBox.brm';
import NavigationTree from '../src/NavigationTree.brm';
import Table from '../src/Table.brm';
import TableBody from '../src/TableBody.brm';
import ToastRegion from '../src/ToastRegion.brm';
import Tree from '../src/Tree.brm';
import TreeRow from '../src/TreeRow.brm';

interface Animal {
  id: string;
  name: string;
}
const animals: Animal[] = [{ id: 'cat', name: 'Cat' }];

// ListBox: `item` and `getTextValue` get the type of `items`.
void ListBox({ items: animals, item: (animal) => animal.name });
void ListBox({ items: animals, getTextValue: (animal) => animal.name });
// @ts-expect-error An animal has no `nope`.
void ListBox({ items: animals, item: (animal) => animal.nope });
// @ts-expect-error An animal has no `nope`.
void ListBox({ items: animals, getTextValue: (animal) => animal.nope });
// @ts-expect-error An item needs an `id`.
void ListBox({ items: [{ name: 'Cat' }] });
// The target of `as` is still inferred beside the value.
void ListBox({
  as: 'ul',
  items: animals,
  item: (animal) => animal.name,
  onClick: (event) => event.clientX,
});
// @ts-expect-error A `ul` has no `foo`.
void ListBox({ as: 'ul', items: animals, foo: 1 });
// The props type takes the value, then the target.
export const typed: ListBoxProps<Animal, 'ul'> = {
  as: 'ul',
  items: animals,
  item: (animal) => animal.name,
};
// @ts-expect-error An animal has no `nope`.
export const typedWrong: ListBoxProps<Animal> = { items: animals, item: (animal) => animal.nope };

// GridList
void GridList({
  items: animals,
  item: (animal) => animal.name,
  getTextValue: (animal) => animal.name,
});
// @ts-expect-error An animal has no `nope`.
void GridList({ items: animals, item: (animal) => animal.nope });

// Table and TableBody: the Table reads `getTextValue`, and the TableBody reads `item`.
void Table({ items: animals, getTextValue: (animal) => animal.name });
// @ts-expect-error An animal has no `nope`.
void Table({ items: animals, getTextValue: (animal) => animal.nope });
void TableBody({ item: (animal: Animal) => animal.name });
// @ts-expect-error An animal has no `nope`.
void TableBody({ item: (animal: Animal) => animal.nope });

// Tree, TreeRow and NavigationTree
interface Folder {
  id: string;
  title: string;
  children?: Folder[];
}
const folders: Folder[] = [{ id: 'a', title: 'A', children: [{ id: 'b', title: 'B' }] }];
void Tree({
  items: folders,
  item: (folder) => folder.title,
  getTextValue: (folder) => folder.title,
});
// @ts-expect-error A folder has no `name`.
void Tree({ items: folders, item: (folder) => folder.name });
// @ts-expect-error A node needs an `id`.
void Tree({ items: [{ title: 'A' }], item: () => null });
void TreeRow({ row: {} as never, item: (folder: Folder) => folder.title });
// @ts-expect-error A folder has no `name`.
void TreeRow({ row: {} as never, item: (folder: Folder) => folder.name });
interface Page {
  id: string;
  title: string;
  href?: string;
  children?: Page[];
}
const pages: Page[] = [{ id: 'a', title: 'A', href: '/a' }];
void NavigationTree({ items: pages, item: (page) => page.title });
// @ts-expect-error A page has no `name`.
void NavigationTree({ items: pages, item: (page) => page.name });

// ToastRegion: the content of a toast gets the type of the parameter.
void ToastRegion<string>({ toast: (item) => item.content.toUpperCase() });
// @ts-expect-error A string has no `nope`.
void ToastRegion<string>({ toast: (item) => item.content.nope });
void ToastRegion({ toast: (item) => String(item.content) });
