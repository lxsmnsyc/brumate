// Type tests. `brumate-tsc --noEmit` checks this file, and each `@ts-expect-error` must be an
// error. A call of a component takes the same props as its tag in a `.brm` file.

import Button from '../src/Button.brm';
import type { ButtonProps } from '../src/Button.brm';
import Heading from '../src/Heading.brm';
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

// The controls, overlays and status parts take `as` too.
import Disclosure from '../src/Disclosure.brm';
import Popover from '../src/Popover.brm';
import type { PopoverProps } from '../src/Popover.brm';
import Toolbar from '../src/Toolbar.brm';
import type { ToolbarProps } from '../src/Toolbar.brm';

export const toolbar: ToolbarProps<'nav'> = {
  as: 'nav',
  orientation: 'vertical',
  'aria-label': 'Tools',
};
// @ts-expect-error `orientation` is horizontal or vertical.
export const toolbarOrientation: ToolbarProps = { orientation: 'diagonal' };
// @ts-expect-error A nav has no `foo`.
export const toolbarFoo: ToolbarProps<'nav'> = { as: 'nav', foo: true };
export const popover: PopoverProps<'aside'> = { as: 'aside', placement: 'top', isOpen: true };
void Toolbar({ as: 'section', 'aria-label': 'Tools' });
// @ts-expect-error `as` takes an element name or a component.
void Toolbar({ as: 'nothing' });
void Popover({ as: 'aside', placement: 'top' });
void Disclosure({ as: 'details', id: 'one', onExpandedChange: (expanded) => expanded });
// as-collections: the collection parts take `as`, an element name or a component, and the props
// of the target.
import GridList from '../src/GridList.brm';
import GridListItem from '../src/GridListItem.brm';
import ListBox from '../src/ListBox.brm';
import type { ListBoxProps } from '../src/ListBox.brm';
import ListBoxItem from '../src/ListBoxItem.brm';
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
// as-sound: `as` reads the element types and the `Component` of brumate.
// A field of the DOM interface that is not an attribute is an error: `tabIndex` is `tabindex`.
// @ts-expect-error `tabIndex` is a field, the attribute is `tabindex`.
export const soundTabIndex: ButtonProps<'a'> = { as: 'a', tabIndex: 1 };
export const soundTabindex: ButtonProps<'a'> = { as: 'a', tabindex: 1 };
// @ts-expect-error `innerHTML` is a field, not an attribute.
export const soundInner: ButtonProps<'a'> = { as: 'a', innerHTML: '<b></b>' };
// @ts-expect-error `className` is a field, the attribute is `class`.
export const soundClassName: ButtonProps<'a'> = { as: 'a', className: 'x' };
// @ts-expect-error `scrollTop` is a field, not an attribute.
export const soundScroll: ButtonProps<'a'> = { as: 'a', scrollTop: 1 };
// @ts-expect-error `tabindex` is a number.
export const soundTabindexType: ButtonProps<'a'> = { as: 'a', tabindex: 'one' };
// Attributes with a closed set of values.
export const soundTarget: ButtonProps<'a'> = { as: 'a', target: '_blank', rel: 'noopener' };
// @ts-expect-error `loading` of an image is `eager` or `lazy`.
export const soundLoading: ButtonProps<'img'> = { as: 'img', loading: 'soon' };
// A handler has the element as `currentTarget`.
void Button({ as: 'a', onClick: (event) => event.currentTarget.href });
// @ts-expect-error An anchor event has no `value` on its `currentTarget`.
void Button({ as: 'a', onClick: (event) => event.currentTarget.value });
// An SVG element is a target.
export const soundSvg: ButtonProps<'svg'> = { as: 'svg', viewBox: '0 0 1 1', 'stroke-width': 2 };
// @ts-expect-error An SVG element has no `foo`.
export const soundSvgFoo: ButtonProps<'svg'> = { as: 'svg', foo: true };
// A component needs `brumateId`: a plain function is not a target.
// @ts-expect-error A function without `brumateId` is not a component.
void Button({ as: (props: { href?: string }) => Promise.resolve(props) });
// @ts-expect-error A name that is not an element is not a target.
void Button({ as: 'blink-me' });
// The props of a component target come from the component.
void Button({ as: Link, href: '/x', isCurrent: true });
// @ts-expect-error A Link has no `value`.
void Button({ as: Link, value: 'x' });

// ref-type-parts: a caller's `$signal<HTMLElement>()` is `HTMLElement | undefined`, and `ref` of a
// part takes it through `$bind`. It is declared in the own props, so an element target does not
// need a `ref` of its own.
import { $bind } from 'brumate/signals';

declare const bound: HTMLElement | undefined;
void Link({ href: '/x', ref: $bind(bound) });
void Button({ ref: $bind(bound) });
void Heading({ level: 2, ref: $bind(bound) });
void ListBox({ 'aria-label': 'Fruit', ref: $bind(bound) });
void ListBoxItem({ id: 'a', ref: $bind(bound) });
void Menu({ 'aria-label': 'Actions', ref: $bind(bound) });
void MenuItem({ id: 'a', ref: $bind(bound) });
void GridList({ 'aria-label': 'Files', ref: $bind(bound) });
void GridListItem({ id: 'a', ref: $bind(bound) });
void Tree({ items: [], item: () => '', ref: $bind(bound) });
void TreeItem({ id: 'a', ref: $bind(bound) });
void TabList({ ref: $bind(bound) });
void Tab({ id: 'a', ref: $bind(bound) });
void TabPanel({ id: 'a', ref: $bind(bound) });
void TagList({ 'aria-label': 'Tags', ref: $bind(bound) });
void Tag({ id: 'a', ref: $bind(bound) });
void Link({ href: '/x', as: 'span', ref: $bind(bound) });
// @ts-expect-error A signal of a string is not an element.
void Link({ href: '/x', ref: $bind('a') });
