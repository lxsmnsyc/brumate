// Type-checked with the package. It fails to compile if the declarations of brumate/elements are wrong.
import { $bind, $signal } from 'brumate/signals';
import type { Bindable, BindableMark, Unbound } from 'brumate/signals';
import type {
  Component,
  ElementEventNames,
  ElementEvents,
  ElementOf,
  ElementProps,
  Elements,
  EventHandler,
  Markup,
  PropsOf,
  Template,
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

// A handler is written in camel case only.
export const keys: ElementProps<'div'> = {
  onKeyDown: (event) => event.key,
  onPointerDown: (event) => event.pointerId,
  onFocusIn: (event) => event.relatedTarget,
};

// `ref` takes `$bind(name)` of the element.
export function bound(button: HTMLButtonElement | null): ElementProps<'button'> {
  return { ref: $bind(button) };
}

// A part binds a supertype of its element, and the signal can be unset.
export const supertype: ElementProps<'div'> = { ref: $bind($signal<HTMLElement>()) };
export const nullable: ElementProps<'div'> = { ref: $bind($signal<HTMLDivElement | null>(null)) };
export const anyElement: ElementProps<'div'> = { ref: $bind($signal<Element>()) };
// @ts-expect-error A signal of a button does not take the ref of a div.
export const subtype: ElementProps<'div'> = { ref: $bind($signal<HTMLButtonElement>()) };

// A part forwards its own `ref` prop: `let { ref } = $props()`, then `ref=$bind(ref)`.
interface PartProps {
  ref?: Bindable<HTMLElement>;
  buttonRef?: Bindable<HTMLButtonElement>;
}
export function forward(props: Unbound<PartProps>): ElementProps<'div'> {
  return { ref: $bind(props.ref) };
}
export function forwardWrong(props: Unbound<PartProps>): ElementProps<'div'> {
  // @ts-expect-error A part that holds a button does not forward it to a div.
  return { ref: $bind(props.buttonRef) };
}
declare const bareButton: BindableMark<HTMLButtonElement>;
declare const bareNumber: BindableMark<number>;
// @ts-expect-error A bare mark has no write side, so its type is not checked and not accepted.
export const bareRef: ElementProps<'div'> = { ref: bareButton };
// @ts-expect-error A mark of a number is not a ref.
export const numberRef: ElementProps<'div'> = { ref: bareNumber };

// An app adds an event or a custom element by merging into the interfaces.
declare module '../elements' {
  interface ElementEvents {
    itemaction: CustomEvent<string>;
  }
  interface ElementEventNames {
    itemaction: 'ItemAction';
  }
  interface Elements {
    'x-card': ElementProps<'div'> & { heading?: string };
  }
}
export const custom: ElementProps<'x-card'> = {
  heading: 'Title',
  onItemAction: (event) => event.detail.length,
};
// @ts-expect-error A custom event with a camel name has no lower-case attribute.
export const customLower: ElementProps<'x-card'> = { onItemaction: () => {} };
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

// A template takes a sync and an async function, and a generic component infers its argument.
interface Item {
  name: string;
}
declare function List<V>(props: { items: V[]; item: Template<[V]> }): Promise<Markup>;
declare const syncTemplate: (item: Item) => Markup;
declare const asyncTemplate: (item: Item) => Promise<Markup>;
declare const none: Template;
export const listSync: Promise<Markup> = List({ items: [{ name: 'a' }], item: syncTemplate });
export const listAsync: Promise<Markup> = List({ items: [{ name: 'a' }], item: asyncTemplate });
export const listInferred: Promise<Markup> = List({
  items: [{ name: 'a' }],
  item: async (item) => {
    void item.name;
    return markup;
  },
});
export const noArguments: Template = none;
export const listTypo: Promise<Markup> = List({
  items: [{ name: 'a' }],
  item: async (item) => {
    // @ts-expect-error The template reads the item that `items` gives, and it has no `nam`.
    void item.nam;
    return markup;
  },
});
// @ts-expect-error A template answers markup, not a string.
export const stringTemplate: Template = () => 'text';

// Values that the runtime and the syntax accept (runtime/html.ts, `attributeText`, `classValue`,
// `styleValue`; codegen/markup.ts, `formAction`; analyze.ts, `$bind` on a field).
declare const on: boolean;
export const classArray: ElementProps<'div'> = {
  class: ['task', on && 'on', null, undefined, ['nested', { active: on }]],
};
export const classObject: ElementProps<'div'> = { class: { task: true, on, off: 0 } };
export const styleObject: ElementProps<'div'> = {
  style: { color: 'red', fontSize: '12px', opacity: 0.5, width: null, '--gap': '4px' },
};
declare const count: number;
export const classFalsy: ElementProps<'div'> = { class: ['task', count && 'x', 0n] };
export const styleUnitless: ElementProps<'div'> = {
  style: { opacity: 0.5, zIndex: 3, flexGrow: 1, lineHeight: 1.5, gridRowStart: 2, width: '12px' },
};
export const selectValue: ElementProps<'select'> = { value: 'a' };
export const selectBound: ElementProps<'select'> = { value: $bind($signal('')) };
export const inputBound: ElementProps<'input'> = {
  value: $bind($signal('')),
  checked: $bind($signal(false)),
};
export const textareaBound: ElementProps<'textarea'> = { value: $bind($signal('')) };
export const optionalBound: ElementProps<'input'> = { value: $bind($signal<string>()) };
declare function save(data: FormData): Promise<void>;
export const formAction: ElementProps<'form'> = { action: save };
export const buttonAction: ElementProps<'button'> = { formaction: save };
export const inputAction: ElementProps<'input'> = { formaction: save };
export const staticNumbers: ElementProps<'div'> = { tabindex: '-1' };
export const staticInput: ElementProps<'input'> = { maxlength: '4', minlength: '1', size: '10' };
export const staticTextarea: ElementProps<'textarea'> = { rows: '3', cols: '40' };
export const staticCell: ElementProps<'td'> = { colspan: '2', rowspan: '1' };
export const staticOther: ElementProps<'li'> = { value: '3' };
export const autocompleteBoolean: ElementProps<'input'> = { autocomplete: false };
export const autocompleteForm: ElementProps<'form'> = { autocomplete: true };
export const keyPress: ElementProps<'input'> = {
  onKeyPress: (event) => event.key,
};
// @ts-expect-error The lower-case form of a handler of several words is not an attribute.
export const lowerKeys: ElementProps<'div'> = { onKeydown: (event) => event.key };
export const handler: EventHandler<HTMLButtonElement, MouseEvent> = (event) =>
  event.currentTarget.value;
export const handlerProp: ElementProps<'button'> = { onClick: handler };

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
// @ts-expect-error A component without a `brumateId` is not a component.
export const noId: Component = async () => markup;
// @ts-expect-error A call through the default `Component` takes no props.
export const anyCall: Promise<Markup> = Any({ nonsense: 1 });
// @ts-expect-error A component answers `Markup`, not a string.
export const stringComponent: Component = Object.assign(async () => 'text', { brumateId: '' });
// @ts-expect-error A tag that is not an element.
export const noTag: ElementProps<'nope'> = {};
// @ts-expect-error `class` takes a class value, not a number.
export const wrongClass: ElementProps<'div'> = { class: 1 };
// @ts-expect-error A class object holds booleans by name, and an array holds class values.
export const wrongClassItem: ElementProps<'div'> = { class: [() => {}] };
// @ts-expect-error A style object has CSS names, and `colour` is not one.
export const wrongStyleName: ElementProps<'div'> = { style: { colour: 'red' } };
// @ts-expect-error A style name is camel case or a `--` variable, not kebab case.
export const kebabStyle: ElementProps<'div'> = { style: { 'font-size': '12px' } };
// @ts-expect-error `checked` is a boolean or a binding, not a string.
export const wrongChecked: ElementProps<'input'> = { checked: 'true' };
// @ts-expect-error A binding of `value` writes a string, so a signal of a number is wrong.
export const wrongBoundValue: ElementProps<'input'> = { value: $bind($signal(0)) };
// @ts-expect-error A binding of `checked` writes a boolean, so a signal of a string is wrong.
export const wrongBoundChecked: ElementProps<'input'> = { checked: $bind($signal('')) };
// @ts-expect-error `action` takes a string or a server function, not a number.
export const wrongAction: ElementProps<'form'> = { action: 1 };
// @ts-expect-error A static number attribute is a number or a numeric string.
export const wrongStaticNumber: ElementProps<'textarea'> = { rows: 'three' };
// @ts-expect-error A number has no unit, so `width: 12` renders `width:12`, which browsers ignore.
export const unitlessWidth: ElementProps<'div'> = { style: { width: 12 } };
// @ts-expect-error A number has no unit for `fontSize` either.
export const unitlessFontSize: ElementProps<'div'> = { style: { fontSize: 12 } };

// Every event of the DOM is either in `ElementEventNames`, when its name has more than one word,
// or listed here as a word of its own. A new event in the DOM types fails this line until it is
// sorted. `DOMContentLoaded` has capitals in its name, which a handler name cannot carry, and the
// `webkit*` names are old aliases of events that have their own entry, so they keep the
// lower-case name and the parser does not report them.
type OneWord =
  | 'abort'
  | 'blur'
  | 'cancel'
  | 'change'
  | 'click'
  | 'close'
  | 'command'
  | 'copy'
  | 'cut'
  | 'drag'
  | 'drop'
  | 'emptied'
  | 'ended'
  | 'error'
  | 'focus'
  | 'input'
  | 'invalid'
  | 'load'
  | 'message'
  | 'offline'
  | 'online'
  | 'paste'
  | 'pause'
  | 'play'
  | 'playing'
  | 'progress'
  | 'reset'
  | 'resize'
  | 'scroll'
  | 'seeked'
  | 'seeking'
  | 'select'
  | 'stalled'
  | 'storage'
  | 'submit'
  | 'suspend'
  | 'toggle'
  | 'unload'
  | 'waiting'
  | 'wheel'
  | 'DOMContentLoaded'
  | 'webkitanimationend'
  | 'webkitanimationiteration'
  | 'webkitanimationstart'
  | 'webkittransitionend';
type DomEvents =
  | keyof WindowEventMap
  | keyof DocumentEventMap
  | keyof HTMLElementEventMap
  | keyof SVGElementEventMap;
export const everyEventSorted: [Exclude<DomEvents, keyof ElementEventNames | OneWord>] extends [
  never,
]
  ? true
  : false = true;
// And an entry that names no event of the DOM is a mistake, but the one that this file merges.
export const noStrayEntry: [Exclude<keyof ElementEventNames, DomEvents | 'itemaction'>] extends [
  never,
]
  ? true
  : false = true;
