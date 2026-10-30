# Errors

The compiler reports each error with the place in the file, as `message (File.brm:line:column)`. This page lists every message, with its cause and the form to write instead. A `{name}` is a part that varies.

It is generated from `src/error-catalog.ts`. Do not edit it by hand.

## BRM001: Unterminated comment

A comment starts and never ends.

https://brumate-docs.vercel.app/docs/errors#brm001

```brm fragment
<!-- A comment ends with -->
<script>
  /* and so does this one */
</script>
```

## BRM002: Unterminated string

A string in code starts and never ends.

https://brumate-docs.vercel.app/docs/errors#brm002

```brm fragment
const name = 'Ada';
```

## BRM003: Unterminated template literal

A template string starts and never ends.

https://brumate-docs.vercel.app/docs/errors#brm003

```brm fragment
const label = `Hello ${name}`;
```

## BRM004: Unterminated regular expression

A regular expression starts and never ends.

https://brumate-docs.vercel.app/docs/errors#brm004

```brm fragment
const digits = /\d+/;
```

## BRM005: Unexpected "{char}"

Code has a bracket that closes nothing.

https://brumate-docs.vercel.app/docs/errors#brm005

```brm fragment
const list = [1, 2];
```

## BRM006: Expected "{char}"

Code opens a bracket and never closes it. The message names the closing one.

https://brumate-docs.vercel.app/docs/errors#brm006

```brm fragment
const list = [1, 2];
```

## BRM007: Expected "}" to close the block

A `#` block opens with `{` and the file ends before its `}`.

https://brumate-docs.vercel.app/docs/errors#brm007

```brm fragment
#if (open) {
  <p>Open</p>
}
```

## BRM008: Unexpected end of file, expected a closing tag

An element is never closed.

https://brumate-docs.vercel.app/docs/errors#brm008

```brm fragment
<div>
  <p>Text</p>
</div>
```

## BRM009: Unexpected closing tag

A closing tag has no opening tag.

https://brumate-docs.vercel.app/docs/errors#brm009

```brm fragment
<p>Text</p>
```

## BRM010: <script> must be at the top level or at the start of a block

A `<script>` is inside an element, or after other markup in a block.

https://brumate-docs.vercel.app/docs/errors#brm010

```brm fragment
#for (item of items) {
  <script>
    let open = $signal(false);
  </script>
  <p>{item}</p>
}
```

## BRM011: <style> must be at the top level

A `<style>` is inside an element or a block.

https://brumate-docs.vercel.app/docs/errors#brm011

```brm fragment
<style>
  p {
    color: red;
  }
</style>
<p>Text</p>
```

## BRM012: #template must be at the top level or at the start of a block

A `#template` is inside an element, or after other markup in a block.

https://brumate-docs.vercel.app/docs/errors#brm012

```brm fragment
#template price(amount: number) {
  <b>{amount}</b>
}
```

## BRM013: #{branch} must follow its block

A branch such as `#else` or `#catch` comes without the block that it belongs to.

https://brumate-docs.vercel.app/docs/errors#brm013

```brm fragment
#if (open) {
  <p>Open</p>
} #else {
  <p>Closed</p>
}
```

## BRM014: Expected a tag name

A `<` starts a tag with no name.

https://brumate-docs.vercel.app/docs/errors#brm014

```brm fragment
<p>1 &lt; 2</p>
```

## BRM015: <{name}> must end with "/>"

`<window>` and `<document>` take no children, so they close with `/>`.

https://brumate-docs.vercel.app/docs/errors#brm015

```brm fragment
<window onKeyDown=(handler) />
```

## BRM016: Expected </{name}>

A closing tag is not complete.

https://brumate-docs.vercel.app/docs/errors#brm016

```brm fragment
<p>Text</p>
```

## BRM017: Unexpected end of file, expected ">"

A tag starts and the file ends before its `>`.

https://brumate-docs.vercel.app/docs/errors#brm017

```brm fragment
<input value=name>
```

## BRM018: Expected whitespace between attributes

Two attributes touch each other.

https://brumate-docs.vercel.app/docs/errors#brm018

```brm fragment
<input id=name type="text">
```

## BRM019: Only event handlers are allowed here

`<window>` and `<document>` take event handlers and nothing else.

https://brumate-docs.vercel.app/docs/errors#brm019

```brm fragment
<document onKeyDown=(handler) />
```

## BRM020: Expected a spread or a shorthand attribute

A `{` in a tag holds something other than `...rest` or a name.

https://brumate-docs.vercel.app/docs/errors#brm020

```brm fragment
<a {href} {...rest}>Open</a>
```

## BRM021: Expected an attribute name

A tag has a character where an attribute name belongs.

https://brumate-docs.vercel.app/docs/errors#brm021

```brm fragment
<input disabled>
```

## BRM022: Unknown event modifier ":{modifier}"

The modifier after an event name is not one of the known ones.

https://brumate-docs.vercel.app/docs/errors#brm022

```brm fragment
<form onSubmit=(prevent(send))></form>
```

## BRM180: "{name}" is not an event name. Write "{camel}"

An event of more than one word is written in camel case. The lower-case form is an error.

https://brumate-docs.vercel.app/docs/errors#brm180

```brm fragment
<input onKeyDown=(handle) onFocusOut=(handle) />
```

## BRM181: #loading does not take a header yet. Write #loading { … }, since the header would be dropped

A `#loading` block has a header in parentheses. The compiler reads no meaning from it.

https://brumate-docs.vercel.app/docs/errors#brm181

```brm fragment
#loading (data) {
  <p>{data.name}</p>
} #else {
  <p>Loading</p>
}
```

## BRM023: Modifiers apply to elements. Put ":{modifier}" on the element that the component renders

An event modifier is on a component, which only passes the handler on.

https://brumate-docs.vercel.app/docs/errors#brm023

```brm fragment
<form onSubmit=(prevent(send))></form>
```

## BRM024: Expected an event handler

An event attribute has no `=` and no value.

https://brumate-docs.vercel.app/docs/errors#brm024

```brm fragment
<button onClick=(() => count++)>Add</button>
```

## BRM025: An event handler must be an expression, not a string

The value of an event attribute is a quoted string.

https://brumate-docs.vercel.app/docs/errors#brm025

```brm fragment
<button onClick=(() => count++)>Add</button>
```

## BRM026: An attribute name can have one ":" namespace

An attribute name has two or more `:`.

https://brumate-docs.vercel.app/docs/errors#brm026

```brm fragment
<svg xlink:href="#icon"></svg>
```

## BRM027: ref takes $bind, as in ref=$bind(name)

`ref` has a value that is not `$bind(name)`.

https://brumate-docs.vercel.app/docs/errors#brm027

```brm fragment
<input ref=$bind(input)>
```

## BRM028: prefetch is removed. The code of the page loads when it starts

The `prefetch` attribute no longer exists.

https://brumate-docs.vercel.app/docs/errors#brm028

```brm fragment
<a href="/about">About</a>
```

## BRM029: Markup is not allowed in attribute values. Use a #template.

An attribute value holds an element.

https://brumate-docs.vercel.app/docs/errors#brm029

```brm fragment
<List item=row />

#template row(name: string) {
  <b>{name}</b>
}
```

## BRM030: Expected an attribute value

An attribute has `=` and nothing after it.

https://brumate-docs.vercel.app/docs/errors#brm030

```brm fragment
<input value=name>
```

## BRM031: Wrap this attribute value in parentheses

An attribute value without quotes has an operator or a space in it.

https://brumate-docs.vercel.app/docs/errors#brm031

```brm fragment
<button disabled=(count > 3)>Add</button>
```

## BRM032: Expected ">" to end <{name}>

A tag has text where its `>` belongs.

https://brumate-docs.vercel.app/docs/errors#brm032

```brm fragment
<input value=name>
```

## BRM033: Expected a quoted value

A `<script>` or `<style>` attribute has `=` without a quoted value.

https://brumate-docs.vercel.app/docs/errors#brm033

```brm fragment
<script generics="T"></script>
```

## BRM034: Expected {close}

A `<script>` or `<style>` is not closed.

https://brumate-docs.vercel.app/docs/errors#brm034

```brm fragment
<script>
  let a = 1;
</script>
```

## BRM035: Unknown <script> attribute "{name}"

A `<script>` has an attribute other than `module` and `generics`.

https://brumate-docs.vercel.app/docs/errors#brm035

```brm fragment
<script module>
  export const MAX = 10;
</script>
```

## BRM036: A file can have one <script module>

A file has two module scripts.

https://brumate-docs.vercel.app/docs/errors#brm036

```brm fragment
<script module>
  export const MAX = 10;
  export const MIN = 1;
</script>
```

## BRM037: A file can have one <script>

A file has two instance scripts.

https://brumate-docs.vercel.app/docs/errors#brm037

```brm fragment
<script>
  let a = $signal(1);
  let b = $signal(2);
</script>
```

## BRM038: lang must be "css", "scss" or "less"

A `<style>` names another language.

https://brumate-docs.vercel.app/docs/errors#brm038

```brm fragment
<style lang="scss">
  p {
    a {
      color: red;
    }
  }
</style>
```

## BRM039: #reveal takes an order, 'sequential', 'backwards', 'together' or 'natural', and collapsed, such as #reveal ('sequential', collapsed)

`#reveal` has an option that it does not know.

https://brumate-docs.vercel.app/docs/errors#brm039

```brm fragment
#reveal ('sequential', collapsed) {
  …
}
```

## BRM040: collapsed shows the fallback of the next body to show, so it needs the order 'sequential', not '{order}'

`collapsed` goes with `sequential` only.

https://brumate-docs.vercel.app/docs/errors#brm040

```brm fragment
#reveal ('sequential', collapsed) {
  …
}
```

## BRM041: #reveal has no script of its own

A `#reveal` body starts with a `<script>`.

https://brumate-docs.vercel.app/docs/errors#brm041

```brm fragment
<script>
  let open = $signal(false);
</script>
#reveal {
  …
}
```

## BRM042: Expected "(" after #{keyword}

A block that takes a condition or a list has no `(`.

https://brumate-docs.vercel.app/docs/errors#brm042

```brm fragment
#if (open) {
  <p>Open</p>
}
```

## BRM043: Expected an expression after #{keyword}

The parentheses of a block are empty.

https://brumate-docs.vercel.app/docs/errors#brm043

```brm fragment
#if (open) {
  <p>Open</p>
}
```

## BRM044: Expected "{" after #{keyword}

The header of a block is not followed by `{`.

https://brumate-docs.vercel.app/docs/errors#brm044

```brm fragment
#if (open) {
  <p>Open</p>
}
```

## BRM045: Expected "{" after #switch

`#switch` has no `{` after it.

https://brumate-docs.vercel.app/docs/errors#brm045

```brm fragment
#switch {
  #case (tab === 1) {
    <p>One</p>
  }
}
```

## BRM046: The script of a block takes no attributes

A `<script>` at the start of a block has attributes such as `module`.

https://brumate-docs.vercel.app/docs/errors#brm046

```brm fragment
#for (item of items) {
  <script>
    let open = $signal(false);
  </script>
  <p>{item}</p>
}
```

## BRM047: #try needs a #catch block

A `#try` body is not followed by `#catch`.

https://brumate-docs.vercel.app/docs/errors#brm047

```brm fragment
#try {
  <p>{load()}</p>
} #catch (error, reset) {
  <p>Failed</p>
}
```

## BRM048: Expected "(error, reset)" after #catch

The header of `#catch` names something other than a plain error name and a plain reset name.

https://brumate-docs.vercel.app/docs/errors#brm048

```brm fragment
#catch (error, reset) {
  <p>{String(error)}</p>
}
```

## BRM049: The trigger of #{keyword} must be "visible", "idle" or "load"

A `#client` block names another trigger.

https://brumate-docs.vercel.app/docs/errors#brm049

```brm fragment
#client ('idle') {
  <p>In the browser</p>
}
```

## BRM050: Unknown block #{keyword}

A `#` starts a block that does not exist.

https://brumate-docs.vercel.app/docs/errors#brm050

```brm fragment
#if (open) {
  <p>Open</p>
}
```

## BRM051: Expected "index of count" after #repeat

The header of `#repeat` is not `index of count`.

https://brumate-docs.vercel.app/docs/errors#brm051

```brm fragment
#repeat (star of 5) {
  <i>{star}</i>
}
```

## BRM052: Expected "item of list" or "item, index of list" after #for

The header of `#for` has no `of`.

https://brumate-docs.vercel.app/docs/errors#brm052

```brm fragment
#for (item, index of items by item.id) {
  <li>{item.name}</li>
}
```

## BRM053: Expected the height of an item in window(height)

`window` after a `#for` header has no height.

https://brumate-docs.vercel.app/docs/errors#brm053

```brm fragment
#for (row of rows by row.id) window(32) {
  <tr><td>{row.name}</td></tr>
}
```

## BRM054: Only #case and #default are allowed in #switch

A `#switch` holds markup other than its cases.

https://brumate-docs.vercel.app/docs/errors#brm054

```brm fragment
#switch {
  #case (tab === 1) {
    <p>One</p>
  }
  #default {
    <p>Other</p>
  }
}
```

## BRM055: #default must be the last branch of #switch

A `#case` comes after the `#default`.

https://brumate-docs.vercel.app/docs/errors#brm055

```brm fragment
#switch {
  #case (tab === 1) {
    <p>One</p>
  }
  #default {
    <p>Other</p>
  }
}
```

## BRM056: Expected "(" after the name of the template

A `#template` has no parameter list.

https://brumate-docs.vercel.app/docs/errors#brm056

```brm fragment
#template price(amount: number) {
  <b>{amount}</b>
}
```

## BRM057: Expected an expression

An attribute or a block has code that is not an expression.

https://brumate-docs.vercel.app/docs/errors#brm057

```brm fragment
<p>{count + 1}</p>
```

## BRM058: Expected a binding pattern

The name of a `#for` or `#catch` is not a name or a pattern.

https://brumate-docs.vercel.app/docs/errors#brm058

```brm fragment
#for ({ id, name } of people by id) {
  <li>{name}</li>
}
```

## BRM059: Expected parameters

The parameters of a `#template` are not a parameter list.

https://brumate-docs.vercel.app/docs/errors#brm059

```brm fragment
#template price(amount: number) {
  <b>{amount}</b>
}
```

## BRM060: "{name}" is already declared

Two declarations of one scope have the same name.

https://brumate-docs.vercel.app/docs/errors#brm060

```brm fragment
let count = $signal(0);
let total = $signal(0);
```

## BRM061: {name} takes a handler

`prevent`, `stop`, `once`, `capture` or `transition` has no handler, or `stop`, `once` or `capture` has keys.

https://brumate-docs.vercel.app/docs/errors#brm061

```brm fragment
<form onSubmit=(prevent(send))></form>
```

## BRM062: Only prevent of a keyboard event takes keys, such as onKeyDown

Keys are given to `prevent` of an event that is not `onKeyDown`, `onKeyUp` or `onKeyPress`.

https://brumate-docs.vercel.app/docs/errors#brm062

```brm fragment
<ul onKeyDown=(prevent(move, 'ArrowDown'))></ul>
```

## BRM063: Name each key of prevent as a string of its event.key, such as 'ArrowDown', 'Space' or 'a', with a modifier to hold if it needs one, such as 'Mod+ArrowDown'

A key of `prevent` is not a string literal of an `event.key`.

https://brumate-docs.vercel.app/docs/errors#brm063

```brm fragment
<ul onKeyDown=(prevent(move, 'ArrowDown', 'Mod+ArrowUp'))></ul>
```

## BRM064: Name each key of prevent as a string, such as 'Enter'

A key of `prevent` is not a string literal.

https://brumate-docs.vercel.app/docs/errors#brm064

```brm fragment
<input onKeyDown=(prevent(submit, 'Enter'))>
```

## BRM065: Server function "{name}" must be async

A function with `'use server'` is not `async`.

https://brumate-docs.vercel.app/docs/errors#brm065

```brm fragment
async function save(list: string[]) {
  'use server';
  await db.save(list);
}
```

## BRM066: The module script cannot have a default export

`<script module>` has `export default`.

https://brumate-docs.vercel.app/docs/errors#brm066

```brm fragment
<script module>
  export const MAX = 10;
</script>
```

## BRM067: A script cannot export values. Use <script module>

The instance script has an `export`.

https://brumate-docs.vercel.app/docs/errors#brm067

```brm fragment
<script module>
  export const MAX = 10;
</script>
```

## BRM068: $title takes one argument, the title

`$title` has no argument or more than one.

https://brumate-docs.vercel.app/docs/errors#brm068

```brm fragment
$title('Todos');
```

## BRM069: await works with $memo, not {name}

A declaration awaits a compile-time function other than `$memo`.

https://brumate-docs.vercel.app/docs/errors#brm069

```brm fragment
const user = $memo(await load(id));
```

## BRM070: $props() can only be called in the component script

`$props()` is in a module script or a function.

https://brumate-docs.vercel.app/docs/errors#brm070

```brm fragment
const { name } = $props<{ name: string }>();
```

## BRM071: Assign $props() to a const or a let

The result of `$props()` is not assigned with `const` or `let`.

https://brumate-docs.vercel.app/docs/errors#brm071

```brm fragment
const { name } = $props<{ name: string }>();
```

## BRM072: $props() takes no arguments

`$props()` has an argument.

https://brumate-docs.vercel.app/docs/errors#brm072

```brm fragment
const { name } = $props<{ name: string }>();
```

## BRM073: Assign $props() to a name or an object pattern

`$props()` is assigned to an array pattern.

https://brumate-docs.vercel.app/docs/errors#brm073

```brm fragment
const { name } = $props<{ name: string }>();
```

## BRM074: Create an ID with "const name = $id()"

`$id()` is not the value of a `const`.

https://brumate-docs.vercel.app/docs/errors#brm074

```brm fragment
const field = $id();
```

## BRM075: $id takes no arguments

`$id` has an argument.

https://brumate-docs.vercel.app/docs/errors#brm075

```brm fragment
const field = $id();
```

## BRM076: $isPassed takes a prop that the component destructures, such as $isPassed(value)

The argument of `$isPassed` is not a prop of the component.

https://brumate-docs.vercel.app/docs/errors#brm076

```brm fragment
let { value } = $props<{ value?: Bindable<string> }>();
const passed = $isPassed(value);
```

## BRM077: $navigation takes no arguments

`$navigation` has an argument.

https://brumate-docs.vercel.app/docs/errors#brm077

```brm fragment
const navigation = $navigation();
```

## BRM078: $route takes at most one argument, the path of the route

`$route` has more than one argument.

https://brumate-docs.vercel.app/docs/errors#brm078

```brm fragment
const route = $route('/posts/[id]');
```

## BRM079: Read a context with "const name = $getContext(Context)"

`$getContext` is not the value of a `const`.

https://brumate-docs.vercel.app/docs/errors#brm079

```brm fragment
const theme = $getContext(ThemeContext);
```

## BRM080: $getContext takes one argument, the context

`$getContext` has no argument or more than one.

https://brumate-docs.vercel.app/docs/errors#brm080

```brm fragment
const theme = $getContext(ThemeContext);
```

## BRM081: $setContext takes two arguments, the context and the value

`$setContext` has fewer or more than two arguments.

https://brumate-docs.vercel.app/docs/errors#brm081

```brm fragment
$setContext(ThemeContext, theme);
```

## BRM082: Declare the result of a form with "const name = $action(serverFunction)"

`$action` is not the value of a `const`.

https://brumate-docs.vercel.app/docs/errors#brm082

```brm fragment
const result = $action(save);
```

## BRM083: $action needs a server function of this file as its only argument

`$action` has no argument, or more than one.

https://brumate-docs.vercel.app/docs/errors#brm083

```brm fragment
const result = $action(save);
```

## BRM084: $action needs a server function of this file, and {name} is not one

The argument of `$action` is not a function with `'use server'` in this file.

https://brumate-docs.vercel.app/docs/errors#brm084

```brm fragment
async function save(data: FormData) {
  'use server';
}
const result = $action(save);
```

## BRM085: Declare {name} with const

`$debounced` or `$throttled` is declared with `let`.

https://brumate-docs.vercel.app/docs/errors#brm085

```brm fragment
const query = $debounced(text, 300);
```

## BRM086: {name} cannot be destructured

A signal, a memo or another value of a compile-time function is declared with a pattern.

https://brumate-docs.vercel.app/docs/errors#brm086

```brm fragment
let count = $signal(0);
```

## BRM087: {name} takes a value and a wait in milliseconds

`$debounced` or `$throttled` does not have both arguments.

https://brumate-docs.vercel.app/docs/errors#brm087

```brm fragment
const query = $debounced(text, 300);
```

## BRM088: The wait of {name} must be a number of milliseconds, such as 300

The wait of `$debounced` or `$throttled` is not a number literal.

https://brumate-docs.vercel.app/docs/errors#brm088

```brm fragment
const query = $debounced(text, 300);
```

## BRM089: Declare {name} with {expected}

`$signal` and `$optimistic` need `let`, and `$memo` needs `const`.

https://brumate-docs.vercel.app/docs/errors#brm089

```brm fragment
let count = $signal(0);
const double = $memo(count * 2);
```

## BRM090: {name} takes one argument

`$signal`, `$memo` or `$optimistic` has more than one argument.

https://brumate-docs.vercel.app/docs/errors#brm090

```brm fragment
let count = $signal(0);
```

## BRM091: {name} needs a value

`$memo` or `$optimistic` has no argument.

https://brumate-docs.vercel.app/docs/errors#brm091

```brm fragment
const double = $memo(count * 2);
```

## BRM092: $optimistic needs the name of a value, such as a memo

The argument of `$optimistic` is not a name.

https://brumate-docs.vercel.app/docs/errors#brm092

```brm fragment
let shown = $optimistic(items);
```

## BRM093: {name} does not return a value

`$effect` or `$client` is assigned to a name.

https://brumate-docs.vercel.app/docs/errors#brm093

```brm fragment
$effect(() => {
  document.title = title;
});
```

## BRM094: {name} needs a function

`$effect` or `$client` has no function as its callback.

https://brumate-docs.vercel.app/docs/errors#brm094

```brm fragment
$effect(() => {
  document.title = title;
});
```

## BRM095: The callback of {name} takes no parameters

The callback of `$effect` or `$client` has parameters.

https://brumate-docs.vercel.app/docs/errors#brm095

```brm fragment
$effect(() => {
  document.title = title;
});
```

## BRM096: The callback of {name} cannot be async

The callback of `$effect` or `$client` is `async`.

https://brumate-docs.vercel.app/docs/errors#brm096

```brm fragment
$effect(() => {
  load(id).then((value) => (data = value));
});
```

## BRM097: $effect takes one argument

`$effect` has more than one argument.

https://brumate-docs.vercel.app/docs/errors#brm097

```brm fragment
$effect(() => {
  document.title = title;
});
```

## BRM098: The trigger of $client must be "visible", "idle" or "load"

The second argument of `$client` is another string.

https://brumate-docs.vercel.app/docs/errors#brm098

```brm fragment
$client(() => {
  measure();
}, 'idle');
```

## BRM099: $handler needs a function as its first argument: a function expression, a function of the script, or one of them in a wrapper of brumate/events

The first argument of `$handler` is not a function.

https://brumate-docs.vercel.app/docs/errors#brm099

```brm fragment
onClick: $handler(prevent(removeAt), index),
```

## BRM100: The handler reads "{name}", a value of the function around $handler, which the browser does not have. Pass it as an argument: $handler(fn, {name})

A handler reads a local value of the function that calls `$handler`.

https://brumate-docs.vercel.app/docs/errors#brm100

```brm fragment
onClick: $handler(removeAt, index),
```

## BRM101: The arguments of $handler cannot be spread

`$handler` has a spread argument.

https://brumate-docs.vercel.app/docs/errors#brm101

```brm fragment
onClick: $handler(removeAt, index, kind),
```

## BRM102: The second argument of $bind is a function that takes the new value: a function expression, or a function of the script

The setter of `$bind` is not a function.

https://brumate-docs.vercel.app/docs/errors#brm102

```brm fragment
<Toggle on=$bind(open, (next) => (open = next)) />
```

## BRM103: The setter reads "{name}", a value of the function around $bind, which the browser does not have

The setter of `$bind` reads a local value that is not a value of the component.

https://brumate-docs.vercel.app/docs/errors#brm103

```brm fragment
<Toggle on=$bind(open, (next) => (open = next)) />
```

## BRM104: Pass $bind(name) as the value of a prop of a component, or of value or checked of an input, a select or a textarea

`$bind` is somewhere else, such as on a `class` or a `<div>`.

https://brumate-docs.vercel.app/docs/errors#brm104

```brm fragment
<input value=$bind(draft)>
```

## BRM105: $bind takes the name of a signal, and a function that writes it, such as $bind(open) or $bind(open, (next) => (open = next))

`$bind` has no argument, or an argument that is not a name.

https://brumate-docs.vercel.app/docs/errors#brm105

```brm fragment
<Toggle on=$bind(open) />
```

## BRM106: $bind takes a signal, or a prop that the component destructures with let, and "{name}" is not one

The name in `$bind` is a memo, a const prop or another value.

https://brumate-docs.vercel.app/docs/errors#brm106

```brm fragment
let open = $signal(false);
<Toggle on=$bind(open) />
```

## BRM107: $isBound takes a prop that the component destructures with let, such as $isBound(open)

The argument of `$isBound` is not a `let` prop.

https://brumate-docs.vercel.app/docs/errors#brm107

```brm fragment
let { open } = $props<{ open?: Bindable<boolean> }>();
const bound = () => $isBound(open);
```

## BRM108: $isPending needs an async $memo as its only argument

The argument of `$isPending` is not a memo that holds a promise.

https://brumate-docs.vercel.app/docs/errors#brm108

```brm fragment
const results = $memo(search(query));
#if ($isPending(results)) {
  <p>Searching…</p>
}
```

## BRM109: $produce needs a signal as its first argument

The first argument of `$produce` is not a signal.

https://brumate-docs.vercel.app/docs/errors#brm109

```brm fragment
$produce(todos, (draft) => {
  draft.push(todo);
});
```

## BRM110: $produce needs a recipe function as its second argument

The second argument of `$produce` is not a function.

https://brumate-docs.vercel.app/docs/errors#brm110

```brm fragment
$produce(todos, (draft) => {
  draft.push(todo);
});
```

## BRM111: "{name}" is reserved. Brumate writes the attributes that start with "b-"

An attribute starts with `b-`.

https://brumate-docs.vercel.app/docs/errors#brm111

```brm fragment
<div data-id=id></div>
```

## BRM112: "{name}" is not declared

The name in `ref=$bind(name)` is not a value of the component.

https://brumate-docs.vercel.app/docs/errors#brm112

```brm fragment
let input = $signal<HTMLInputElement>();
<input ref=$bind(input)>
```

## BRM113: ref takes a $signal, or a prop that the component destructures with let, but "{name}" is {kind}

The name in `ref=$bind(name)` is a memo, a const prop or another value.

https://brumate-docs.vercel.app/docs/errors#brm113

```brm fragment
let input = $signal<HTMLInputElement>();
<input ref=$bind(input)>
```

## BRM114: The prop "{name}" is not Bindable. Type it as Bindable<HTMLElement>, so a parent can bind it

A `let` prop is used as a `ref` and its type is not `Bindable`.

https://brumate-docs.vercel.app/docs/errors#brm114

```brm fragment
let { ref } = $props<{ ref?: Bindable<HTMLButtonElement> }>();
```

## BRM115: "{name}" is the props object, so read one key at a time, destructure it, or spread it in markup

The props object or the rest of `$props()` is used as a whole outside a markup spread: spread in code, passed to a function, `$memo`, `$setContext`, a signal or a variable, or given as a value in markup, such as `title=rest` or `<Badge {rest} />`. The copy loses the `ref` and the live props.

https://brumate-docs.vercel.app/docs/errors#brm115

```brm fragment
const { class: className, ...rest } = $props();
<button {...rest} class=className>
```

## BRM116: "{name}" is the props object, and props are read-only. Copy the key to a $signal or a $memo to change it

Code assigns to, updates or deletes a key of the props object or of the rest of `$props()`.

https://brumate-docs.vercel.app/docs/errors#brm116

```brm fragment
let title = $signal('');
title = 'New';
```

## BRM117: Cannot assign to {kind} "{name}"

Code writes a memo, a const prop or another value that cannot change.

https://brumate-docs.vercel.app/docs/errors#brm117

```brm fragment
let count = $signal(0);
count = 5;
```

## BRM118: Signal "{name}" can only be written in event handlers, effects, $client callbacks and functions

Setup code, which runs on the server, writes a signal.

https://brumate-docs.vercel.app/docs/errors#brm118

```brm fragment
let count = $signal(5);
```

## BRM119: Server function "{name}" captures "{variable}". Pass it as an argument

A server function reads a variable of the instance script.

https://brumate-docs.vercel.app/docs/errors#brm119

```brm fragment
async function save(user: string) {
  'use server';
}
```

## BRM120: $optimistic follows a memo, an action or a prop, not a signal

The source of `$optimistic` is a signal.

https://brumate-docs.vercel.app/docs/errors#brm120

```brm fragment
let shown = $optimistic(items);
```

## BRM121: Declare server functions at the top level of a script

A function with `'use server'` is inside another function or a block.

https://brumate-docs.vercel.app/docs/errors#brm121

```brm fragment
async function save() {
  'use server';
}
```

## BRM122: {name} cannot be used here

A compile-time function is used where it is not allowed.

https://brumate-docs.vercel.app/docs/errors#brm122

```brm fragment
let count = $signal(0);
```

## BRM123: Call $setContext at the top level of a script

`$setContext` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm123

```brm fragment
$setContext(ThemeContext, theme);
```

## BRM124: Call $title at the top level of a script

`$title` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm124

```brm fragment
$title('Todos');
```

## BRM125: Create an ID with "const name = $id()" at the top level of a script

`$id` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm125

```brm fragment
const field = $id();
```

## BRM126: Check a prop with "const name = $isPassed(prop)" at the top level of the component script

`$isPassed` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm126

```brm fragment
const passed = $isPassed(value);
```

## BRM127: Read a context with "const name = $getContext(Context)" at the top level of a script

`$getContext` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm127

```brm fragment
const theme = $getContext(ThemeContext);
```

## BRM128: Read the route with "const name = $route()" at the top level of a script

`$route` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm128

```brm fragment
const route = $route();
```

## BRM129: Read the navigation with "const name = $navigation()" at the top level of a script

`$navigation` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm129

```brm fragment
const navigation = $navigation();
```

## BRM130: Call $props() as the value of a const in the component script

`$props` is used in another place than `const { … } = $props()`.

https://brumate-docs.vercel.app/docs/errors#brm130

```brm fragment
const { name } = $props<{ name: string }>();
```

## BRM131: Declare a signal with "let name = $signal(value)" at the top level of a script

`$signal` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm131

```brm fragment
let count = $signal(0);
```

## BRM132: Declare a memo with "const name = $memo(value)" at the top level of a script

`$memo` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm132

```brm fragment
const double = $memo(count * 2);
```

## BRM133: Declare a debounced value with "const name = $debounced(value, ms)" at the top level of a script

`$debounced` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm133

```brm fragment
const query = $debounced(text, 300);
```

## BRM134: Declare a throttled value with "const name = $throttled(value, ms)" at the top level of a script

`$throttled` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm134

```brm fragment
const position = $throttled(pointer, 100);
```

## BRM135: Declare an optimistic value with "let name = $optimistic(source)" at the top level of a script

`$optimistic` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm135

```brm fragment
let shown = $optimistic(items);
```

## BRM136: Declare the result of a form with "const name = $action(serverFunction)" at the top level of a script

`$action` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm136

```brm fragment
const result = $action(save);
```

## BRM137: Call $effect at the top level of a script

`$effect` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm137

```brm fragment
$effect(() => {
  document.title = title;
});
```

## BRM138: Call $client at the top level of a script

`$client` is inside a function or a block of code.

https://brumate-docs.vercel.app/docs/errors#brm138

```brm fragment
$client(() => {
  measure();
}, 'idle');
```

## BRM139: $ref is not supported. Use a $signal with ref=$bind(name)

`$ref` was removed.

https://brumate-docs.vercel.app/docs/errors#brm139

```brm fragment
let input = $signal<HTMLInputElement>();
<input ref=$bind(input)>
```

## BRM140: $watch is not supported. Use $effect

`$watch` was removed.

https://brumate-docs.vercel.app/docs/errors#brm140

```brm fragment
$effect(() => {
  save(value);
});
```

## BRM141: $settled is not supported. Use $client

`$settled` was removed.

https://brumate-docs.vercel.app/docs/errors#brm141

```brm fragment
$client(() => {
  measure();
});
```

## BRM142: $cleanup is not supported. Return a cleanup function from $effect or $client

`$cleanup` was removed.

https://brumate-docs.vercel.app/docs/errors#brm142

```brm fragment
$effect(() => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
});
```

## BRM143: $store is not supported yet

`$store` does not exist.

https://brumate-docs.vercel.app/docs/errors#brm143

```brm fragment
let todos = $signal([]);
```

## BRM144: $get is not supported. Signals cannot leave the file

`$get` was removed. A signal never leaves its file.

https://brumate-docs.vercel.app/docs/errors#brm144

```brm fragment
// Pass the value, or a function that writes it.
onChange=((next) => (count = next))
```

## BRM145: $set is not supported. Signals cannot leave the file

`$set` was removed. A signal never leaves its file.

https://brumate-docs.vercel.app/docs/errors#brm145

```brm fragment
// Pass the value, or a function that writes it.
onChange=((next) => (count = next))
```

## BRM146: {name} was renamed to {renamed}. Import {renamed} from '{module}'

The file imports a name that the compiler knew before it was renamed.

https://brumate-docs.vercel.app/docs/errors#brm146

```brm fragment
import { $signal } from 'brumate/signals';
```

## BRM147: Import {name} from '{module}'

The file calls a compile-time function that it does not import.

https://brumate-docs.vercel.app/docs/errors#brm147

```brm fragment
import { $signal } from 'brumate/signals';
```

## BRM148: "{name}" holds a new {kind}, which cannot be sent to the browser, and code that runs in the browser reads it{reader}. Use it in a server function, or create it in the browser, such as in $client

A value that cannot be sent to the browser, such as a database client, is read by code that runs there.

https://brumate-docs.vercel.app/docs/errors#brm148

```brm fragment
async function list() {
  'use server';
  return db.all();
}
```

## BRM149: {what} is read by code that runs in the browser ({site}). Read it in a server function

Code that runs in the browser reads an environment variable of the server.

https://brumate-docs.vercel.app/docs/errors#brm149

```brm fragment
async function key() {
  'use server';
  return env.API_KEY;
}
```

## BRM150: "{name}" holds {what} and code that runs in the browser reads it. Keep server variables out of values that the browser reads

A value holds an environment variable of the server, and the browser reads the value.

https://brumate-docs.vercel.app/docs/errors#brm150

```brm fragment
async function key() {
  'use server';
  return env.API_KEY;
}
```

## BRM151: #defer cannot be inside a #client body

A `#defer` is in markup that only the browser renders.

https://brumate-docs.vercel.app/docs/errors#brm151

```brm fragment
#defer {
  <Comments />
}
```

## BRM152: #defer cannot be in markup that the browser renders

A `#defer` is in a body that the browser adds later, such as the body of a changing `#if`.

https://brumate-docs.vercel.app/docs/errors#brm152

```brm fragment
#defer {
  <Comments />
}
```

## BRM153: A value that changes in <{tag}> must be its whole content, such as <{tag}>{`Count ${count}`}</{tag}>

A `<title>`, `<textarea>`, `<style>` or `<script>` holds a changing value next to other content.

https://brumate-docs.vercel.app/docs/errors#brm153

```brm fragment
<textarea>{`Count ${count}`}</textarea>
```

## BRM154: Put <title> in #head, as <meta> and <link>, such as #head { <title>{`${count} left`}</title> }

A `<title>` is outside `#head`.

https://brumate-docs.vercel.app/docs/errors#brm154

```brm fragment
#head {
  <title>{`${count} left`}</title>
}
```

## BRM155: A dynamic tag that changes on the client is not supported yet

No `.brm` file reaches it today: the parser keys every dynamic tag, and a `<{tag}>` whose tag a handler changes compiles. It is kept for a tag that the compiler could not update.

https://brumate-docs.vercel.app/docs/errors#brm155

```brm fragment
<{tag} class="title">Title</>
```

## BRM156: Code that the browser updates can await only a memo. Load the promise in a memo instead

Code that runs again in the browser awaits something other than a memo.

https://brumate-docs.vercel.app/docs/errors#brm156

```brm fragment
const user = $memo(await load(id));
```

## BRM157: Markup that the browser renders can await only a memo. Load the promise in a memo instead

Markup that the browser renders awaits something other than a memo.

https://brumate-docs.vercel.app/docs/errors#brm157

```brm fragment
const user = $memo(await load(id));
```

## BRM158: This attribute cannot change on the client yet

The name or the value of an attribute with a computed name, as in `[name]=value`, changes in the browser.

https://brumate-docs.vercel.app/docs/errors#brm158

```brm fragment
<div class=(open ? "open" : "closed")></div>
```

## BRM159: This computed attribute has a name or value with no code in the browser, so it cannot stay when the attributes of the element update

An element has a computed attribute, as in `[name]=(value)`, and a spread or another computed attribute that can change. The name or the value is a constant, or a signal that nothing writes, so the browser has no code for it, and an update of the element would remove the attribute. Make both a signal that the page writes, or write the attribute without brackets.

https://brumate-docs.vercel.app/docs/errors#brm159

```brm fragment
let name = $signal('data-x');
let value = $signal('on');

<button onClick=(() => ((name = 'data-y'), (value = 'off')))>Change</button>
<p {...props} [name]=(value)></p>
<p {...props} data-x="on"></p>
```

## BRM160: Destructuring assignment to a signal is not supported in client code yet

Code that runs in the browser writes a signal in a destructuring assignment.

https://brumate-docs.vercel.app/docs/errors#brm160

```brm fragment
[first, second] = pair;
// Write each signal on its own:
first = pair[0];
second = pair[1];
```

## BRM161: Assign to "{name}" with = instead of {op}

An optimistic value is changed with `++` or `--`.

https://brumate-docs.vercel.app/docs/errors#brm161

```brm fragment
shown = shown + 1;
```

## BRM162: Invalid CSS: {message}

A `<style>` has CSS that does not parse.

https://brumate-docs.vercel.app/docs/errors#brm162

```brm fragment
<style>
  p {
    color: red;
  }
</style>
```

## BRM163: Module functions call each other too deeply. A module function cannot call itself

A function of a module of reactive logic calls itself, or a loop of functions call each other.

https://brumate-docs.vercel.app/docs/errors#brm163

```brm fragment
function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM164: Destructure what {name} returns, as in const { value } = {name}(…)

The result of a module function is kept as one object.

https://brumate-docs.vercel.app/docs/errors#brm164

```brm fragment
const { count, increment } = counter(0);
```

## BRM165: Declare what {name} returns with const

The result of a module function is declared with `let`.

https://brumate-docs.vercel.app/docs/errors#brm165

```brm fragment
const { count, increment } = counter(0);
```

## BRM166: Call {name} at the top level of a script, as in const { value } = {name}(…). Its signals become values of the component, so it cannot run in a function, a condition or a loop

A module function is called inside a function, a condition or a loop.

https://brumate-docs.vercel.app/docs/errors#brm166

```brm fragment
const { count, increment } = counter(0);
```

## BRM167: Cannot read {specifier}

The module that the component imports is not on disk.

https://brumate-docs.vercel.app/docs/errors#brm167

```brm fragment
import { counter } from './counter.brm.ts';
```

## BRM168: {specifier} does not export a function named {name}

The import names a function that the module does not export.

https://brumate-docs.vercel.app/docs/errors#brm168

```brm fragment
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM169: {name} needs a body that ends with return { … }

A module function is an arrow function with an expression body.

https://brumate-docs.vercel.app/docs/errors#brm169

```brm fragment
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM170: {name} must end with return { … }, an object of what it gives

A module function does not end with `return { … }`.

https://brumate-docs.vercel.app/docs/errors#brm170

```brm fragment
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM171: {name} can return only at its end

A module function returns in the middle of its body.

https://brumate-docs.vercel.app/docs/errors#brm171

```brm fragment
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM172: Destructure {name} with plain names, as in const { value, other: renamed } = {name}(…)

The result of a module function is destructured with a default, a nested pattern or a rest.

https://brumate-docs.vercel.app/docs/errors#brm172

```brm fragment
const { count, increment: add } = counter(0);
```

## BRM173: {name} must return an object with plain keys

The returned object has a computed key, a spread or a method.

https://brumate-docs.vercel.app/docs/errors#brm173

```brm fragment
return { count, increment };
```

## BRM174: {name} cannot return getters or setters. Return the values themselves

The returned object has a getter or a setter.

https://brumate-docs.vercel.app/docs/errors#brm174

```brm fragment
return { count, increment };
```

## BRM175: {name} does not return {key}

The component destructures a name that the module function does not return.

https://brumate-docs.vercel.app/docs/errors#brm175

```brm fragment
const { count } = counter(0);
```

## BRM176: {name} returns {local} as {first} and as {key}. Return each local once, and give the other key a function of its own

A module function returns one local under two keys.

https://brumate-docs.vercel.app/docs/errors#brm176

```brm fragment
return { count, increment };
```

## BRM177: {name} is declared twice

A name of the module function is also a name of the component.

https://brumate-docs.vercel.app/docs/errors#brm177

```brm fragment
const { count: first } = counter(0);
const { count: second } = counter(10);
```

## BRM178: Parameters of {name} must be plain names

A module function has a destructured or default parameter.

https://brumate-docs.vercel.app/docs/errors#brm178

```brm fragment
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM179: {name} reads {local}, which {specifier} does not export. Export it, so the component can import it

A module function reads a value of its module that is not exported.

https://brumate-docs.vercel.app/docs/errors#brm179

```brm fragment
export const STEP = 1;
```
