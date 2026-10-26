// Type tests. `brumate-tsc --noEmit` checks this file, and each `@ts-expect-error` must be an
// error. A call of a component takes the same props as its tag in a `.brm` file.

import Button from '../src/Button.brm';
import type { ButtonProps } from '../src/Button.brm';
import Heading from '../src/Heading.brm';
import GridList from '../src/GridList.brm';
import GridListItem from '../src/GridListItem.brm';
import ListBox from '../src/ListBox.brm';
import ListBoxItem from '../src/ListBoxItem.brm';
import type { ListBoxProps } from '../src/ListBox.brm';
import Menu from '../src/Menu.brm';
import MenuItem from '../src/MenuItem.brm';
import Tab from '../src/Tab.brm';
import TabList from '../src/TabList.brm';
import TabPanel from '../src/TabPanel.brm';
import Tag from '../src/Tag.brm';
import TagList from '../src/TagList.brm';
import Tree from '../src/Tree.brm';
import TreeItem from '../src/TreeItem.brm';
import AsTarget from './fixtures/AsTarget.brm';
import Link from '../src/Link.brm';
import Switch from '../src/Switch.brm';
import type { SwitchProps } from '../src/Switch.brm';

// The props type of a part is real, in a `.ts` file.
export const press: ButtonProps = { isDisabled: true, onPress() {} };
export const sw: SwitchProps = { name: 'a', isSelected: true, 'data-x': 1 };
// @ts-expect-error A prop with the wrong type.
export const wrong: ButtonProps = { isDisabled: 'yes' };
// @ts-expect-error A prop that the part and its element do not have.
export const unknown: ButtonProps = { foo: true };
// @ts-expect-error A prop with the wrong type, on a part with no `as`.
export const wrongSwitch: SwitchProps = { isDisabled: 'yes' };

// The props of the target of `as`: an element name.
export const anchor: ButtonProps<'a'> = { as: 'a', href: '/x', target: '_blank', class: 'link' };
// @ts-expect-error An anchor has no `foo`.
export const anchorFoo: ButtonProps<'a'> = { as: 'a', foo: true };
// @ts-expect-error `href` is a string.
export const anchorHref: ButtonProps<'a'> = { as: 'a', href: 1 };

// The props of the target of `as`: a component.
export const linked: ButtonProps<typeof Link> = { as: Link, href: '/x', isCurrent: true };
// @ts-expect-error A Link has no `value`.
export const linkedValue: ButtonProps<typeof Link> = { as: Link, value: 'x' };

// A call infers the target from `as`.
void Button({ isDisabled: true });
void Button({ as: 'a', href: '/x', 'data-id': 'a', 'aria-label': 'Open' });
void Button({ as: 'a', onClick: (event) => event.clientX });
void Button({ as: Link, href: '/x' });
// @ts-expect-error An anchor has no `foo`.
void Button({ as: 'a', foo: true });
// @ts-expect-error A button has no `cols`.
void Button({ as: 'button', cols: 2 });
// @ts-expect-error `type` of Button is a union of strings.
void Button({ type: 'link' });
void Heading({ level: 2, id: 'title' });
// @ts-expect-error `level` is a number.
void Heading({ level: 'two' });
void Link({ href: '/x', as: 'span' });

// A part with no `as` keeps the attributes that it spreads onto its element.
void Switch({ name: 'a', 'data-x': 1 });

// The collection parts take `as`, an element name or a component, and the props of the target.
export const list: ListBoxProps<'ul'> = { as: 'ul', selectionMode: 'single', class: 'list' };
// @ts-expect-error `selectionMode` is one of three strings.
export const listMode: ListBoxProps = { selectionMode: 'some' };
// @ts-expect-error A `ul` has no `foo`.
export const listFoo: ListBoxProps<'ul'> = { as: 'ul', foo: true };
void ListBox({ as: 'ul', 'aria-label': 'Fruit' });
void ListBox({ as: AsTarget, 'aria-label': 'Fruit', 'data-x': 1 });
void ListBoxItem({ id: 'a', as: 'li', title: 'Apple' });
void ListBoxItem({ id: 'a', as: AsTarget });
// @ts-expect-error `id` is the key of the item, a string or a number.
void ListBoxItem({ id: true });
void Menu({ as: 'ul', 'aria-label': 'Actions' });
void MenuItem({ id: 'a', as: 'li' });
void GridList({ as: 'section', 'aria-label': 'Files' });
void GridListItem({ id: 'a', as: AsTarget });
void Tree({ as: 'section', items: [], item: () => '' });
void Tree({ as: AsTarget, items: [], item: () => '' });
void TreeItem({ as: 'li', textValue: 'a' });
void TabList({ as: 'nav', 'aria-label': 'Sections' });
void Tab({ id: 'a', as: 'a', href: '/a' });
void TabPanel({ id: 'a', as: 'section' });
void TagList({ as: 'ul', 'aria-label': 'Tags' });
void Tag({ id: 'a', as: 'li' });
// @ts-expect-error A `section` has no `foo`.
void TabPanel({ id: 'a', as: 'section', foo: true });
