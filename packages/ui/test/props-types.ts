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
