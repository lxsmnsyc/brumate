// Type-checked with the package. It fails to compile if the declarations of brumate/elements are wrong.
import { $bind } from 'brumate/signals';
import type {
  Component,
  ElementEvents,
  ElementOf,
  ElementProps,
  Elements,
  Markup,
  PropsOf,
} from '../elements';

// Attributes, as the markup writes them.
export const anchor: ElementProps<'a'> = {
  href: '/home',
  target: '_blank',
  class: 'link',
  style: 'color: red',
  tabindex: 0,
  'data-id': 1,
  'aria-label': 'Home',
  onClick: (event) => {
    const element: HTMLAnchorElement = event.currentTarget;
    return element.href;
  },
};
export const label: ElementProps<'label'> = { for: 'name' };
export const input: ElementProps<'input'> = { type: 'text', maxlength: 4, readonly: true };
export const shape: ElementProps<'path'> = { d: 'M0 0', 'stroke-width': 2, viewBox: '0 0 1 1' };

// A handler is written in camel case, or as the name of the event.
export const keys: ElementProps<'div'> = {
  onKeyDown: (event) => event.key,
  onKeydown: (event) => event.key,
  onPointerDown: (event) => event.pointerId,
  onFocusIn: (event) => event.relatedTarget,
};

// `ref` takes `$bind(name)` of the element.
export function bound(button: HTMLButtonElement | null): ElementProps<'button'> {
  return { ref: $bind(button) };
}

// An app adds an event or a custom element by merging into the interfaces.
declare module '../elements' {
  interface ElementEvents {
    itemaction: CustomEvent<string>;
  }
  interface Elements {
    'x-card': ElementProps<'div'> & { heading?: string };
  }
}
export const custom: ElementProps<'x-card'> = {
  heading: 'Title',
  onItemaction: (event) => event.detail.length,
};
export const customEvent: ElementEvents['itemaction'] | undefined = undefined;

// Every tag of the DOM has attributes.
export const html: [Exclude<keyof HTMLElementTagNameMap, keyof Elements>] extends [never]
  ? true
  : false = true;
export const svg: [Exclude<keyof SVGElementTagNameMap, keyof Elements>] extends [never]
  ? true
  : false = true;
export const tag: ElementOf<'circle'> = {} as SVGCircleElement;

// Markup and components.
declare const markup: Markup;
declare const text: string;
declare function render(children: Markup): void;
declare function write(text: string): void;
render(markup);
write(text);

interface CardProps {
  title: string;
  children?: Markup;
}
declare const Card: Component<CardProps>;
declare const Any: Component;
export const props: PropsOf<typeof Card> = { title: 'A' };
export const components: Component[] = [Card, Any];
export const fromMarkup: Promise<Markup> = Card({ title: 'A', children: markup });

// What the types forbid.

// @ts-expect-error `a` has no `src`.
export const unknown: ElementProps<'a'> = { src: '/a.png' };
// @ts-expect-error `href` is a string.
export const wrongHref: ElementProps<'a'> = { href: 1 };
// @ts-expect-error `button` has no `href`, and a field of the DOM is not an attribute.
export const noHref: ElementProps<'button'> = { href: '/', innerHTML: '' };
// @ts-expect-error `tabindex` is a number.
export const wrongTabindex: ElementProps<'div'> = { tabindex: 'a' };
// @ts-expect-error The DOM name is not the attribute.
export const domName: ElementProps<'div'> = { tabIndex: 0 };
// @ts-expect-error A click is a mouse event, not a keyboard one.
export const wrongEvent: ElementProps<'button'> = { onClick: (event: KeyboardEvent) => event.key };
// @ts-expect-error `div` takes `onClick`, not `onClik`.
export const unknownEvent: ElementProps<'div'> = { onClik: () => {} };
// @ts-expect-error `ref` takes the binding of the element, not a string.
export const wrongRef: ElementProps<'div'> = { ref: 'name' };
// @ts-expect-error A `Markup` value is not a string.
write(markup);
// @ts-expect-error A string is not `Markup`.
render(text);
// @ts-expect-error Markup has no string methods.
export const upper: unknown = markup.toUpperCase();
// @ts-expect-error A component takes the props of its type.
export const wrongProps: PropsOf<typeof Card> = { title: 1 };
// @ts-expect-error A component answers `Markup`, not a string.
export const stringComponent: Component = async () => 'text';
// @ts-expect-error A tag that is not an element.
export const noTag: ElementProps<'nope'> = {};
