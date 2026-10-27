import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const bin = fileURLToPath(new URL('../bin/brumate-tsc.js', import.meta.url));
const project = fileURLToPath(new URL('./fixture/tsconfig.json', import.meta.url));

it('reports type errors in .brm files at their place in the file', () => {
  const result = spawnSync(process.execPath, [bin, '-p', project], { encoding: 'utf8' });
  const errors = result.stdout
    .split('\n')
    .filter((line) => line.includes('error TS'))
    .map((line) => line.replace(/^.*src\//, ''))
    // The union of the event names is long and changes with the DOM types.
    .map((line) => line.replace(/(parameter of type '"input" \|).*$/, '$1 ...'))
    // So is the type of the attributes of an element.
    .map((line) => line.replace(/(type '\{ onInput\?).*$/, '$1 ...'));
  // `sign-in.brm` imports `SignIn`, the name that its file name gives the component, with no error.
  expect(errors).toEqual([
    // A prop with the wrong type, at the prop.
    "App.brm(9,19): error TS2322: Type 'string' is not assignable to type 'number'.",
    // A missing prop, at the tag.
    "App.brm(10,1): error TS2345: Argument of type '{ label: string; }' is not assignable to parameter of type '{ label: string; count: number; }'.",
    // An expression in the markup.
    "App.brm(11,10): error TS2551: Property 'toFixed' does not exist on type 'string'. Did you mean 'fixed'?",
    // `$bind` on a prop that is not `Bindable`, at the prop.
    "Bind.brm(10,9): error TS2322: Type 'BoundSignal<number>' is not assignable to type 'number'.",
    // The value of an input is a string, so a signal of a number does not bind it.
    "Bind.brm(11,8): error TS2322: Type 'BoundSignal<number>' is not assignable to type 'Attr<string | number | BoundValue>'.",
    // A dynamic tag: a handler typed from an element name, a wrong attribute and a wrong ref. A
    // union of names types the handler and checks the names. A component types its handler, and
    // checks its props and children. A generic tag of either kind types the handler with HTML and
    // SVG elements. An unknown event, and a wrong value in a spread of `c && { ... }`, at the spread.
    "Dynamic.brm(13,53): error TS2339: Property 'nope' does not exist on type 'string'.",
    "Dynamic.brm(14,8): error TS2322: Type 'number' is not assignable to type 'Attr<string>'.",
    "Dynamic.brm(15,8): error TS2322: Type 'BoundSignal<HTMLButtonElement | undefined>' is not assignable to type 'BindableMark<unknown> & WritableMark<HTMLAnchorElement>'.",
    'Dynamic.brm(16,57): error TS2353: Object literal may only specify known properties, and \'foo\' does not exist in type \'(Html<"a", AnchorOwn> | Html<"button", ButtonOwn>) & { children?: Markup | undefined; }\'.',
    "Dynamic.brm(17,42): error TS2339: Property 'nope' does not exist on type 'number'.",
    "Dynamic.brm(18,11): error TS2322: Type 'string' is not assignable to type 'number'.",
    "Dynamic.brm(19,11): error TS2353: Object literal may only specify known properties, and 'bogus' does not exist in type 'ToggleProps'.",
    "Dynamic.brm(20,11): error TS2353: Object literal may only specify known properties, and 'children' does not exist in type 'ToggleProps'.",
    "Dynamic.brm(21,47): error TS2339: Property 'nope' does not exist on type '(EventTarget & HTMLElement) | (EventTarget & SVGElement)'.",
    "Dynamic.brm(22,10): error TS2353: Object literal may only specify known properties, and 'onFooBar' does not exist in type '{ onInput? ...",
    'Dynamic.brm(23,10): error TS2345: Argument of type \'{ tabindex: "x"; }\' is not assignable to parameter of type \'Html<"div", {}>\'.',
    // A component with a spread still reports a required prop that no spread gives, at the tag.
    // A prop that a spread gives, also as an optional key or in `c && { ... }`, and a spread of
    // `Record<string, unknown>` pass.
    "Dynamic.brm(26,1): error TS2345: Argument of type '{}' is not assignable to parameter of type 'Omit<{ label: string; onPress?: (() => void) | undefined; }, \"onPress\"> & Partial<{ label: string; onPress?: (() => void) | undefined; }>'.",
    // The attributes of a plain element, each at its place: an unknown one, a wrong value, a ref
    // of another element, a wrong value in a spread and a computed name. Then children given to a
    // component that takes none, at the children. `autocorrect`,
    // `webkitdirectory` and the namespaced `xmlns:xlink` and `xlink:href` type-check.
    "Elements.brm(11,6): error TS2353: Object literal may only specify known properties, and 'foo' does not exist in type 'Html<\"div\", {}>'.",
    'Elements.brm(12,6): error TS2322: Type \'"soon"\' is not assignable to type \'Attr<"eager" | "lazy">\'.',
    "Elements.brm(13,6): error TS2322: Type 'BoundSignal<HTMLButtonElement | undefined>' is not assignable to type 'BindableMark<unknown> & WritableMark<HTMLDivElement>'.",
    "Elements.brm(14,6): error TS2345: Argument of type '{ tabindex: string; }' is not assignable to parameter of type 'Html<\"div\", {}>'.",
    "Elements.brm(15,6): error TS2418: Type of computed property's value is 'number', which is not assignable to type 'Attr<string>'.",
    "Elements.brm(16,28): error TS2353: Object literal may only specify known properties, and 'children' does not exist in type '{ label: string; count: number; }'.",
    // An event that no element fires, at the attribute, on an element, `<window>` and
    // `<document>`. `onItemAction` is typed from `ElementEvents` and has no error.
    'Events.brm(10,6): error TS2345: Argument of type \'"foobar"\' is not assignable to parameter of type \'"input" | ...',
    'Events.brm(11,6): error TS2345: Argument of type \'"doubleclick"\' is not assignable to parameter of type \'"input" | ...',
    'Events.brm(12,9): error TS2345: Argument of type \'"foobar"\' is not assignable to parameter of type \'"input" | ...',
    'Events.brm(13,11): error TS2345: Argument of type \'"foobar"\' is not assignable to parameter of type \'"input" | ...',
    // A key of `prevent` that is not a key name.
    "Keys.brm(9,56): error TS2345: Argument of type '\"ArowUp\"' is not assignable to parameter of type 'KeyName'.",
    // A prop that the component does not take, at the prop. The bindable prop of a second
    // `$props` call is known.
    "Props.brm(9,28): error TS2353: Object literal may only specify known properties, and 'tone' does not exist in type '{ label: string; count: number; }'.",
    // Values that the page state sends to the client, which it cannot serialize.
    "Sent.brm(18,7): error TS2345: Argument of type 'Point' is not assignable to parameter of type 'Point & { x: number; move: { 'A function cannot be sent to the client. Keep it out of the signal or memo': never; }; }'.",
    "Sent.brm(19,7): error TS2345: Argument of type '(value: number) => string' is not assignable to parameter of type '((value: number) => string) & { 'A function cannot be sent to the client. Keep it out of the signal or memo': never; }'.",
    "Sent.brm(21,7): error TS2345: Argument of type 'RegExp' is not assignable to parameter of type 'RegExp & { 'A regular expression cannot be sent to the client. Send its source and flags': never; }'.",
    // A spread of a value that can be null, undefined or another falsy value is valid. Inside an optional object, an
    // unknown name and a wrong value are errors at the spread.
    'Spreads.brm(17,6): error TS2345: Argument of type \'{ tabindex: "x"; foo: 1; }\' is not assignable to parameter of type \'Html<"div", {}>\'.',
    'Spreads.brm(17,10): error TS2345: Argument of type \'{ tabindex: "x"; foo: 1; } | undefined\' is not assignable to parameter of type \'$$Falsy | ({ tabindex: "x"; foo: 1; } & { foo: { "foo is not an attribute of <div>": never; }; })\'.',
    // A falsy value of `cond && { ... }` spreads nothing, and the object part is still checked.
    "Spreads.brm(21,11): error TS2345: Argument of type 'false | { nope: number; }' is not assignable to parameter of type '$$Falsy | ({ nope: number; } & { nope: { \"nope is not an attribute of <div>\": never; }; })'.",
  ]);
  expect(result.status).not.toBe(0);
});
