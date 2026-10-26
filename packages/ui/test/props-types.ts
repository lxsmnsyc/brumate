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
