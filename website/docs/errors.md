# Compile errors

Each compile error of brumate has a code. The code is part of the message, and `brumate check` prints it with a link to its section here. A `{name}` in a message is a part that varies.

This page is generated from `packages/brumate/src/error-catalog.ts`. Do not edit it by hand.

## BRM001

`Unterminated comment`

A comment starts and never ends.

```brm
<!-- A comment ends with -->
<script>
  /* and so does this one */
</script>
```

## BRM002

`Unterminated string`

A string in code starts and never ends.

```brm
const name = 'Ada';
```

## BRM003

`Unterminated template literal`

A template string starts and never ends.

```brm
const label = `Hello ${name}`;
```

## BRM004

`Unterminated regular expression`

A regular expression starts and never ends.

```brm
const digits = /\d+/;
```

## BRM005

`Unexpected "{char}"`

Code has a bracket that closes nothing.

```brm
const list = [1, 2];
```

## BRM006

`Expected "{char}"`

Code opens a bracket and never closes it. The message names the closing one.

```brm
const list = [1, 2];
```

## BRM007

`Expected "}" to close the block`

A `#` block opens with `{` and the file ends before its `}`.

```brm
#if (open) {
  <p>Open</p>
}
```

## BRM008

`Unexpected end of file, expected a closing tag`

An element is never closed.

```brm
<div>
  <p>Text</p>
</div>
```

## BRM009

`Unexpected closing tag`

A closing tag has no opening tag.

```brm
<p>Text</p>
```

## BRM010

`<script> must be at the top level or at the start of a block`

A `<script>` is inside an element, or after other markup in a block.

```brm
#for (item of items) {
  <script>
    let open = $signal(false);
  </script>
  <p>{item}</p>
}
```

## BRM011

`<style> must be at the top level`

A `<style>` is inside an element or a block.

```brm
<style>
  p {
    color: red;
  }
</style>
<p>Text</p>
```

## BRM012

`#template must be at the top level or at the start of a block`

A `#template` is inside an element, or after other markup in a block.

```brm
#template price(amount: number) {
  <b>{amount}</b>
}
```

## BRM013

`#{branch} must follow its block`

A branch such as `#else` or `#catch` comes without the block that it belongs to.

```brm
#if (open) {
  <p>Open</p>
} #else {
  <p>Closed</p>
}
```

## BRM014

`Expected a tag name`

A `<` starts a tag with no name.

```brm
<p>1 &lt; 2</p>
```

## BRM015

`<{name}> must end with "/>"`

`<window>` and `<document>` take no children, so they close with `/>`.

```brm
<window onKeyDown=(handler) />
```

## BRM016

`Expected </{name}>`

A closing tag is not complete.

```brm
<p>Text</p>
```

## BRM017

`Unexpected end of file, expected ">"`

A tag starts and the file ends before its `>`.

```brm
<input value=name>
```

## BRM018

`Expected whitespace between attributes`

Two attributes touch each other.

```brm
<input id=name type="text">
```

## BRM019

`Only event handlers are allowed here`

`<window>` and `<document>` take event handlers and nothing else.

```brm
<document onKeyDown=(handler) />
```

## BRM020

`Expected a spread or a shorthand attribute`

A `{` in a tag holds something other than `...rest` or a name.

```brm
<a {href} {...rest}>Open</a>
```

## BRM021

`Expected an attribute name`

A tag has a character where an attribute name belongs.

```brm
<input disabled>
```

## BRM022

`Unknown event modifier ":{modifier}"`

The modifier after an event name is not one of the known ones.

```brm
<form onSubmit=(prevent(send))></form>
```

## BRM180

`"{name}" is not an event name. Write "{camel}"`

An event of more than one word is written in camel case. The lower-case form is an error.

```brm
<input onKeyDown=(handle) onFocusOut=(handle) />
```

## BRM181

`#loading does not take a header yet. Write #loading { … }, since the header would be dropped`

A `#loading` block has a header in parentheses. The compiler reads no meaning from it.

```brm
#loading (data) {
  <p>{data.name}</p>
} #else {
  <p>Loading</p>
}
```

## BRM182

`The handler reads "{name}", a memo that can lack a value. Check $isPending({name}) first, or declare it with await $memo(…)`

A handler, a handler prop or a `$client` callback reads an async memo that may still be loading, with no `$isPending` check before the read.

```brm
<script>
  const user = $memo(getUser(id));
  function save() {
    if ($isPending(user)) return;
    send(user.name);
  }
</script>
```

## BRM023

`Modifiers apply to elements. Put ":{modifier}" on the element that the component renders`

An event modifier is on a component, which only passes the handler on.

```brm
<form onSubmit=(prevent(send))></form>
```

## BRM024

`Expected an event handler`

An event attribute has no `=` and no value.

```brm
<button onClick=(() => count++)>Add</button>
```

## BRM025

`An event handler must be an expression, not a string`

The value of an event attribute is a quoted string.

```brm
<button onClick=(() => count++)>Add</button>
```

## BRM026

`An attribute name can have one ":" namespace`

An attribute name has two or more `:`.

```brm
<svg xlink:href="#icon"></svg>
```

## BRM027

`ref takes $bind, as in ref=$bind(name)`

`ref` has a value that is not `$bind(name)`.

```brm
<input ref=$bind(input)>
```

## BRM028

`prefetch is removed. The code of the page loads when it starts`

The `prefetch` attribute no longer exists.

```brm
<a href="/about">About</a>
```

## BRM029

`Markup is not allowed in attribute values. Use a #template.`

An attribute value holds an element.

```brm
<List item=row />

#template row(name: string) {
  <b>{name}</b>
}
```

## BRM030

`Expected an attribute value`

An attribute has `=` and nothing after it.

```brm
<input value=name>
```

## BRM031

`Wrap this attribute value in parentheses`

An attribute value without quotes has an operator or a space in it.

```brm
<button disabled=(count > 3)>Add</button>
```

## BRM032

`Expected ">" to end <{name}>`

A tag has text where its `>` belongs.

```brm
<input value=name>
```

## BRM033

`Expected a quoted value`

A `<script>` or `<style>` attribute has `=` without a quoted value.

```brm
<script generics="T"></script>
```

## BRM034

`Expected {close}`

A `<script>` or `<style>` is not closed.

```brm
<script>
  let a = 1;
</script>
```

## BRM035

`Unknown <script> attribute "{name}"`

A `<script>` has an attribute other than `module` and `generics`.

```brm
<script module>
  export const MAX = 10;
</script>
```

## BRM036

`A file can have one <script module>`

A file has two module scripts.

```brm
<script module>
  export const MAX = 10;
  export const MIN = 1;
</script>
```

## BRM037

`A file can have one <script>`

A file has two instance scripts.

```brm
<script>
  let a = $signal(1);
  let b = $signal(2);
</script>
```

## BRM038

`lang must be "css", "scss" or "less"`

A `<style>` names another language.

```brm
<style lang="scss">
  p {
    a {
      color: red;
    }
  }
</style>
```

## BRM039

`#reveal takes an order, 'sequential', 'backwards', 'together' or 'natural', and collapsed, such as #reveal ('sequential', collapsed)`

`#reveal` has an option that it does not know.

```brm
#reveal ('sequential', collapsed) {
  …
}
```

## BRM040

`collapsed shows the fallback of the next body to show, so it needs the order 'sequential', not '{order}'`

`collapsed` goes with `sequential` only.

```brm
#reveal ('sequential', collapsed) {
  …
}
```

## BRM041

`#reveal has no script of its own`

A `#reveal` body starts with a `<script>`.

```brm
<script>
  let open = $signal(false);
</script>
#reveal {
  …
}
```

## BRM042

`Expected "(" after #{keyword}`

A block that takes a condition or a list has no `(`.

```brm
#if (open) {
  <p>Open</p>
}
```

## BRM043

`Expected an expression after #{keyword}`

The parentheses of a block are empty.

```brm
#if (open) {
  <p>Open</p>
}
```

## BRM044

`Expected "{" after #{keyword}`

The header of a block is not followed by `{`.

```brm
#if (open) {
  <p>Open</p>
}
```

## BRM045

`Expected "{" after #switch`

`#switch` has no `{` after it.

```brm
#switch {
  #case (tab === 1) {
    <p>One</p>
  }
}
```

## BRM046

`The script of a block takes no attributes`

A `<script>` at the start of a block has attributes such as `module`.

```brm
#for (item of items) {
  <script>
    let open = $signal(false);
  </script>
  <p>{item}</p>
}
```

## BRM047

`#try needs a #catch block`

A `#try` body is not followed by `#catch`.

```brm
#try {
  <p>{load()}</p>
} #catch (error, reset) {
  <p>Failed</p>
}
```

## BRM048

`Expected "(error, reset)" after #catch`

The header of `#catch` names something other than a plain error name and a plain reset name.

```brm
#catch (error, reset) {
  <p>{String(error)}</p>
}
```

## BRM049

`The trigger of #{keyword} must be "visible", "idle" or "load"`

A `#client` block names another trigger.

```brm
#client ('idle') {
  <p>In the browser</p>
}
```

## BRM050

`Unknown block #{keyword}`

A `#` starts a block that does not exist.

```brm
#if (open) {
  <p>Open</p>
}
```

## BRM051

`Expected "index of count" after #repeat`

The header of `#repeat` is not `index of count`.

```brm
#repeat (star of 5) {
  <i>{star}</i>
}
```

## BRM052

`Expected "item of list" or "item, index of list" after #for`

The header of `#for` has no `of`.

```brm
#for (item, index of items by item.id) {
  <li>{item.name}</li>
}
```

## BRM053

`Expected the height of an item in window(height)`

`window` after a `#for` header has no height.

```brm
#for (row of rows by row.id) window(32) {
  <tr><td>{row.name}</td></tr>
}
```

## BRM054

`Only #case and #default are allowed in #switch`

A `#switch` holds markup other than its cases.

```brm
#switch {
  #case (tab === 1) {
    <p>One</p>
  }
  #default {
    <p>Other</p>
  }
}
```

## BRM055

`#default must be the last branch of #switch`

A `#case` comes after the `#default`.

```brm
#switch {
  #case (tab === 1) {
    <p>One</p>
  }
  #default {
    <p>Other</p>
  }
}
```

## BRM056

`Expected "(" after the name of the template`

A `#template` has no parameter list.

```brm
#template price(amount: number) {
  <b>{amount}</b>
}
```

## BRM057

`Expected an expression`

An attribute or a block has code that is not an expression.

```brm
<p>{count + 1}</p>
```

## BRM058

`Expected a binding pattern`

The name of a `#for` or `#catch` is not a name or a pattern.

```brm
#for ({ id, name } of people by id) {
  <li>{name}</li>
}
```

## BRM059

`Expected parameters`

The parameters of a `#template` are not a parameter list.

```brm
#template price(amount: number) {
  <b>{amount}</b>
}
```

## BRM060

`"{name}" is already declared`

Two declarations of one scope have the same name.

```brm
let count = $signal(0);
let total = $signal(0);
```

## BRM061

`{name} takes a handler`

`prevent`, `stop`, `once`, `capture` or `transition` has no handler, or `stop`, `once` or `capture` has keys.

```brm
<form onSubmit=(prevent(send))></form>
```

## BRM062

`Only prevent of a keyboard event takes keys, such as onKeyDown`

Keys are given to `prevent` of an event that is not `onKeyDown`, `onKeyUp` or `onKeyPress`.

```brm
<ul onKeyDown=(prevent(move, 'ArrowDown'))></ul>
```

## BRM063

`Name each key of prevent as a string of its event.key, such as 'ArrowDown', 'Space' or 'a', with a modifier to hold if it needs one, such as 'Mod+ArrowDown'`

A key of `prevent` is not a string literal of an `event.key`.

```brm
<ul onKeyDown=(prevent(move, 'ArrowDown', 'Mod+ArrowUp'))></ul>
```

## BRM064

`Name each key of prevent as a string, such as 'Enter'`

A key of `prevent` is not a string literal.

```brm
<input onKeyDown=(prevent(submit, 'Enter'))>
```

## BRM065

`Server function "{name}" must be async`

A function with `'use server'` is not `async`.

```brm
async function save(list: string[]) {
  'use server';
  await db.save(list);
}
```

## BRM066

`The module script cannot have a default export`

`<script module>` has `export default`.

```brm
<script module>
  export const MAX = 10;
</script>
```

## BRM067

`A script cannot export values. Use <script module>`

The instance script has an `export`.

```brm
<script module>
  export const MAX = 10;
</script>
```

## BRM068

`$title takes one argument, the title`

`$title` has no argument or more than one.

```brm
$title('Todos');
```

## BRM069

`await works with $memo, not {name}`

A declaration awaits a compile-time function other than `$memo`.

```brm
const user = $memo(await load(id));
```

## BRM070

`$props() can only be called in the component script`

`$props()` is in a module script or a function.

```brm
const { name } = $props<{ name: string }>();
```

## BRM071

`Assign $props() to a const or a let`

The result of `$props()` is not assigned with `const` or `let`.

```brm
const { name } = $props<{ name: string }>();
```

## BRM072

`$props() takes no arguments`

`$props()` has an argument.

```brm
const { name } = $props<{ name: string }>();
```

## BRM073

`Assign $props() to a name or an object pattern`

`$props()` is assigned to an array pattern.

```brm
const { name } = $props<{ name: string }>();
```

## BRM074

`Create an ID with "const name = $id()"`

`$id()` is not the value of a `const`.

```brm
const field = $id();
```

## BRM075

`$id takes no arguments`

`$id` has an argument.

```brm
const field = $id();
```

## BRM076

`$isPassed takes a prop that the component destructures, such as $isPassed(value)`

The argument of `$isPassed` is not a prop of the component.

```brm
let { value } = $props<{ value?: Bindable<string> }>();
const passed = $isPassed(value);
```

## BRM077

`$navigation takes no arguments`

`$navigation` has an argument.

```brm
const navigation = $navigation();
```

## BRM078

`$route takes at most one argument, the path of the route`

`$route` has more than one argument.

```brm
const route = $route('/posts/[id]');
```

## BRM079

`Read a context with "const name = $getContext(Context)"`

`$getContext` is not the value of a `const`.

```brm
const theme = $getContext(ThemeContext);
```

## BRM080

`$getContext takes one argument, the context`

`$getContext` has no argument or more than one.

```brm
const theme = $getContext(ThemeContext);
```

## BRM081

`$setContext takes two arguments, the context and the value`

`$setContext` has fewer or more than two arguments.

```brm
$setContext(ThemeContext, theme);
```

## BRM082

`Declare the result of a form with "const name = $action(serverFunction)"`

`$action` is not the value of a `const`.

```brm
const result = $action(save);
```

## BRM083

`$action needs a server function of this file as its only argument`

`$action` has no argument, or more than one.

```brm
const result = $action(save);
```

## BRM084

`$action needs a server function of this file, and {name} is not one`

The argument of `$action` is not a function with `'use server'` in this file.

```brm
async function save(data: FormData) {
  'use server';
}
const result = $action(save);
```

## BRM085

`Declare {name} with const`

`$debounced` or `$throttled` is declared with `let`.

```brm
const query = $debounced(text, 300);
```

## BRM086

`{name} cannot be destructured`

A signal, a memo or another value of a compile-time function is declared with a pattern.

```brm
let count = $signal(0);
```

## BRM087

`{name} takes a value and a wait in milliseconds`

`$debounced` or `$throttled` does not have both arguments.

```brm
const query = $debounced(text, 300);
```

## BRM088

`The wait of {name} must be a number of milliseconds, such as 300`

The wait of `$debounced` or `$throttled` is not a number literal.

```brm
const query = $debounced(text, 300);
```

## BRM089

`Declare {name} with {expected}`

`$signal` and `$optimistic` need `let`, and `$memo` needs `const`.

```brm
let count = $signal(0);
const double = $memo(count * 2);
```

## BRM090

`{name} takes one argument`

`$signal`, `$memo` or `$optimistic` has more than one argument.

```brm
let count = $signal(0);
```

## BRM091

`{name} needs a value`

`$memo` or `$optimistic` has no argument.

```brm
const double = $memo(count * 2);
```

## BRM092

`$optimistic needs the name of a value, such as a memo`

The argument of `$optimistic` is not a name.

```brm
let shown = $optimistic(items);
```

## BRM093

`{name} does not return a value`

`$effect` or `$client` is assigned to a name.

```brm
$effect(() => {
  document.title = title;
});
```

## BRM094

`{name} needs a function`

`$effect` or `$client` has no function as its callback.

```brm
$effect(() => {
  document.title = title;
});
```

## BRM095

`The callback of {name} takes no parameters`

The callback of `$effect` or `$client` has parameters.

```brm
$effect(() => {
  document.title = title;
});
```

## BRM096

`The callback of {name} cannot be async`

The callback of `$effect` or `$client` is `async`.

```brm
$effect(() => {
  load(id).then((value) => (data = value));
});
```

## BRM097

`$effect takes one argument`

`$effect` has more than one argument.

```brm
$effect(() => {
  document.title = title;
});
```

## BRM098

`The trigger of $client must be "visible", "idle" or "load"`

The second argument of `$client` is another string.

```brm
$client(() => {
  measure();
}, 'idle');
```

## BRM099

`$handler needs a function as its first argument: a function expression, a function of the script, or one of them in a wrapper of brumate/events`

The first argument of `$handler` is not a function.

```brm
onClick: $handler(prevent(removeAt), index),
```

## BRM100

`The handler reads "{name}", a value of the function around $handler, which the browser does not have. Pass it as an argument: $handler(fn, {name})`

A handler reads a local value of the function that calls `$handler`.

```brm
onClick: $handler(removeAt, index),
```

## BRM101

`The arguments of $handler cannot be spread`

`$handler` has a spread argument.

```brm
onClick: $handler(removeAt, index, kind),
```

## BRM102

`The second argument of $bind is a function that takes the new value: a function expression, or a function of the script`

The setter of `$bind` is not a function.

```brm
<Toggle on=$bind(open, (next) => (open = next)) />
```

## BRM103

`The setter reads "{name}", a value of the function around $bind, which the browser does not have`

The setter of `$bind` reads a local value that is not a value of the component.

```brm
<Toggle on=$bind(open, (next) => (open = next)) />
```

## BRM104

`Pass $bind(name) as the value of a prop of a component, or of value or checked of an input, a select or a textarea`

`$bind` is somewhere else, such as on a `class` or a `<div>`.

```brm
<input value=$bind(draft)>
```

## BRM105

`$bind takes the name of a signal, and a function that writes it, such as $bind(open) or $bind(open, (next) => (open = next))`

`$bind` has no argument, or an argument that is not a name.

```brm
<Toggle on=$bind(open) />
```

## BRM106

`$bind takes a signal, or a prop that the component destructures with let, and "{name}" is not one`

The name in `$bind` is a memo, a const prop or another value.

```brm
let open = $signal(false);
<Toggle on=$bind(open) />
```

## BRM107

`$isBound takes a prop that the component destructures with let, such as $isBound(open)`

The argument of `$isBound` is not a `let` prop.

```brm
let { open } = $props<{ open?: Bindable<boolean> }>();
const bound = () => $isBound(open);
```

## BRM108

`$isPending needs an async $memo as its only argument`

The argument of `$isPending` is not a memo that holds a promise.

```brm
const results = $memo(search(query));
#if ($isPending(results)) {
  <p>Searching…</p>
}
```

## BRM109

`$produce needs a signal as its first argument`

The first argument of `$produce` is not a signal.

```brm
$produce(todos, (draft) => {
  draft.push(todo);
});
```

## BRM110

`$produce needs a recipe function as its second argument`

The second argument of `$produce` is not a function.

```brm
$produce(todos, (draft) => {
  draft.push(todo);
});
```

## BRM111

`"{name}" is reserved. Brumate writes the attributes that start with "b-"`

An attribute starts with `b-`.

```brm
<div data-id=id></div>
```

## BRM112

`"{name}" is not declared`

The name in `ref=$bind(name)` is not a value of the component.

```brm
let input = $signal<HTMLInputElement>();
<input ref=$bind(input)>
```

## BRM113

`ref takes a $signal, or a prop that the component destructures with let, but "{name}" is {kind}`

The name in `ref=$bind(name)` is a memo, a const prop or another value.

```brm
let input = $signal<HTMLInputElement>();
<input ref=$bind(input)>
```

## BRM114

`The prop "{name}" is not Bindable. Type it as Bindable<HTMLElement>, so a parent can bind it`

A `let` prop is used as a `ref` and its type is not `Bindable`.

```brm
let { ref } = $props<{ ref?: Bindable<HTMLButtonElement> }>();
```

## BRM115

`"{name}" is the props object, so read one key at a time, destructure it, or spread it in markup`

The props object or the rest of `$props()` is used as a whole outside a markup spread: spread in code, passed to a function, `$memo`, `$setContext`, a signal or a variable, or given as a value in markup, such as `title=rest` or `<Badge {rest} />`. The copy loses the `ref` and the live props.

```brm
const { class: className, ...rest } = $props();
<button {...rest} class=className>
```

## BRM116

`"{name}" is the props object, and props are read-only. Copy the key to a $signal or a $memo to change it`

Code assigns to, updates or deletes a key of the props object or of the rest of `$props()`.

```brm
let title = $signal('');
title = 'New';
```

## BRM117

`Cannot assign to {kind} "{name}"`

Code writes a memo, a const prop or another value that cannot change.

```brm
let count = $signal(0);
count = 5;
```

## BRM118

`Signal "{name}" can only be written in event handlers, effects, $client callbacks and functions`

Setup code, which runs on the server, writes a signal.

```brm
let count = $signal(5);
```

## BRM119

`Server function "{name}" captures "{variable}". Pass it as an argument`

A server function reads a variable of the instance script.

```brm
async function save(user: string) {
  'use server';
}
```

## BRM120

`$optimistic follows a memo, an action or a prop, not a signal`

The source of `$optimistic` is a signal.

```brm
let shown = $optimistic(items);
```

## BRM121

`Declare server functions at the top level of a script`

A function with `'use server'` is inside another function or a block.

```brm
async function save() {
  'use server';
}
```

## BRM122

`{name} cannot be used here`

A compile-time function is used where it is not allowed.

```brm
let count = $signal(0);
```

## BRM123

`Call $setContext at the top level of a script`

`$setContext` is inside a function or a block of code.

```brm
$setContext(ThemeContext, theme);
```

## BRM124

`Call $title at the top level of a script`

`$title` is inside a function or a block of code.

```brm
$title('Todos');
```

## BRM125

`Create an ID with "const name = $id()" at the top level of a script`

`$id` is inside a function or a block of code.

```brm
const field = $id();
```

## BRM126

`Check a prop with "const name = $isPassed(prop)" at the top level of the component script`

`$isPassed` is inside a function or a block of code.

```brm
const passed = $isPassed(value);
```

## BRM127

`Read a context with "const name = $getContext(Context)" at the top level of a script`

`$getContext` is inside a function or a block of code.

```brm
const theme = $getContext(ThemeContext);
```

## BRM128

`Read the route with "const name = $route()" at the top level of a script`

`$route` is inside a function or a block of code.

```brm
const route = $route();
```

## BRM129

`Read the navigation with "const name = $navigation()" at the top level of a script`

`$navigation` is inside a function or a block of code.

```brm
const navigation = $navigation();
```

## BRM130

`Call $props() as the value of a const in the component script`

`$props` is used in another place than `const { … } = $props()`.

```brm
const { name } = $props<{ name: string }>();
```

## BRM131

`Declare a signal with "let name = $signal(value)" at the top level of a script`

`$signal` is inside a function or a block of code.

```brm
let count = $signal(0);
```

## BRM132

`Declare a memo with "const name = $memo(value)" at the top level of a script`

`$memo` is inside a function or a block of code.

```brm
const double = $memo(count * 2);
```

## BRM133

`Declare a debounced value with "const name = $debounced(value, ms)" at the top level of a script`

`$debounced` is inside a function or a block of code.

```brm
const query = $debounced(text, 300);
```

## BRM134

`Declare a throttled value with "const name = $throttled(value, ms)" at the top level of a script`

`$throttled` is inside a function or a block of code.

```brm
const position = $throttled(pointer, 100);
```

## BRM135

`Declare an optimistic value with "let name = $optimistic(source)" at the top level of a script`

`$optimistic` is inside a function or a block of code.

```brm
let shown = $optimistic(items);
```

## BRM136

`Declare the result of a form with "const name = $action(serverFunction)" at the top level of a script`

`$action` is inside a function or a block of code.

```brm
const result = $action(save);
```

## BRM137

`Call $effect at the top level of a script`

`$effect` is inside a function or a block of code.

```brm
$effect(() => {
  document.title = title;
});
```

## BRM138

`Call $client at the top level of a script`

`$client` is inside a function or a block of code.

```brm
$client(() => {
  measure();
}, 'idle');
```

## BRM139

`$ref is not supported. Use a $signal with ref=$bind(name)`

`$ref` was removed.

```brm
let input = $signal<HTMLInputElement>();
<input ref=$bind(input)>
```

## BRM140

`$watch is not supported. Use $effect`

`$watch` was removed.

```brm
$effect(() => {
  save(value);
});
```

## BRM141

`$settled is not supported. Use $client`

`$settled` was removed.

```brm
$client(() => {
  measure();
});
```

## BRM142

`$cleanup is not supported. Return a cleanup function from $effect or $client`

`$cleanup` was removed.

```brm
$effect(() => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
});
```

## BRM143

`$store is not supported yet`

`$store` does not exist.

```brm
let todos = $signal([]);
```

## BRM144

`$get is not supported. Signals cannot leave the file`

`$get` was removed. A signal never leaves its file.

```brm
// Pass the value, or a function that writes it.
onChange=((next) => (count = next))
```

## BRM145

`$set is not supported. Signals cannot leave the file`

`$set` was removed. A signal never leaves its file.

```brm
// Pass the value, or a function that writes it.
onChange=((next) => (count = next))
```

## BRM146

`{name} was renamed to {renamed}. Import {renamed} from '{module}'`

The file imports a name that the compiler knew before it was renamed.

```brm
import { $signal } from 'brumate/signals';
```

## BRM147

`Import {name} from '{module}'`

The file calls a compile-time function that it does not import.

```brm
import { $signal } from 'brumate/signals';
```

## BRM148

`"{name}" holds a new {kind}, which cannot be sent to the browser, and code that runs in the browser reads it{reader}. Use it in a server function, or create it in the browser, such as in $client`

A value that cannot be sent to the browser, such as a database client, is read by code that runs there.

```brm
async function list() {
  'use server';
  return db.all();
}
```

## BRM149

`{what} is read by code that runs in the browser ({site}). Read it in a server function`

Code that runs in the browser reads an environment variable of the server.

```brm
async function key() {
  'use server';
  return env.API_KEY;
}
```

## BRM150

`"{name}" holds {what} and code that runs in the browser reads it. Keep server variables out of values that the browser reads`

A value holds an environment variable of the server, and the browser reads the value.

```brm
async function key() {
  'use server';
  return env.API_KEY;
}
```

## BRM151

`#defer cannot be inside a #client body`

A `#defer` is in markup that only the browser renders.

```brm
#defer {
  <Comments />
}
```

## BRM152

`#defer cannot be in markup that the browser renders`

A `#defer` is in a body that the browser adds later, such as the body of a changing `#if`.

```brm
#defer {
  <Comments />
}
```

## BRM153

`A value that changes in <{tag}> must be its whole content, such as <{tag}>{`Count ${count}`}</{tag}>`

A `<title>`, `<textarea>`, `<style>` or `<script>` holds a changing value next to other content.

```brm
<textarea>{`Count ${count}`}</textarea>
```

## BRM154

`Put <title> in #head, as <meta> and <link>, such as #head { <title>{`${count} left`}</title> }`

A `<title>` is outside `#head`.

```brm
#head {
  <title>{`${count} left`}</title>
}
```

## BRM155

`A dynamic tag that changes on the client is not supported yet`

No `.brm` file reaches it today: the parser keys every dynamic tag, and a `<{tag}>` whose tag a handler changes compiles. It is kept for a tag that the compiler could not update.

```brm
<{tag} class="title">Title</>
```

## BRM156

`Code that the browser updates can await only a memo. Load the promise in a memo instead`

Code that runs again in the browser awaits something other than a memo.

```brm
const user = $memo(await load(id));
```

## BRM157

`Markup that the browser renders can await only a memo. Load the promise in a memo instead`

Markup that the browser renders awaits something other than a memo.

```brm
const user = $memo(await load(id));
```

## BRM158

`This attribute cannot change on the client yet`

The name or the value of an attribute with a computed name, as in `[name]=value`, changes in the browser.

```brm
<div class=(open ? "open" : "closed")></div>
```

## BRM159

`This computed attribute has a name or value with no code in the browser, so it cannot stay when the attributes of the element update`

An element has a computed attribute, as in `[name]=(value)`, and a spread or another computed attribute that can change. The name or the value is a constant, or a signal that nothing writes, so the browser has no code for it, and an update of the element would remove the attribute. Make both a signal that the page writes, or write the attribute without brackets.

```brm
let name = $signal('data-x');
let value = $signal('on');

<button onClick=(() => ((name = 'data-y'), (value = 'off')))>Change</button>
<p {...props} [name]=(value)></p>
<p {...props} data-x="on"></p>
```

## BRM160

`Destructuring assignment to a signal is not supported in client code yet`

Code that runs in the browser writes a signal in a destructuring assignment.

```brm
[first, second] = pair;
// Write each signal on its own:
first = pair[0];
second = pair[1];
```

## BRM161

`Assign to "{name}" with = instead of {op}`

An optimistic value is changed with `++` or `--`.

```brm
shown = shown + 1;
```

## BRM162

`Invalid CSS: {message}`

A `<style>` has CSS that does not parse.

```brm
<style>
  p {
    color: red;
  }
</style>
```

## BRM163

`Module functions call each other too deeply. A module function cannot call itself`

A function of a module of reactive logic calls itself, or a loop of functions call each other.

```brm
function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM164

`Destructure what {name} returns, as in const { value } = {name}(…)`

The result of a module function is kept as one object.

```brm
const { count, increment } = counter(0);
```

## BRM165

`Declare what {name} returns with const`

The result of a module function is declared with `let`.

```brm
const { count, increment } = counter(0);
```

## BRM166

`Call {name} at the top level of a script, as in const { value } = {name}(…). Its signals become values of the component, so it cannot run in a function, a condition or a loop`

A module function is called inside a function, a condition or a loop.

```brm
const { count, increment } = counter(0);
```

## BRM167

`Cannot read {specifier}`

The module that the component imports is not on disk.

```brm
import { counter } from './counter.brm.ts';
```

## BRM168

`{specifier} does not export a function named {name}`

The import names a function that the module does not export.

```brm
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM169

`{name} needs a body that ends with return { … }`

A module function is an arrow function with an expression body.

```brm
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM170

`{name} must end with return { … }, an object of what it gives`

A module function does not end with `return { … }`.

```brm
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM171

`{name} can return only at its end`

A module function returns in the middle of its body.

```brm
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM172

`Destructure {name} with plain names, as in const { value, other: renamed } = {name}(…)`

The result of a module function is destructured with a default, a nested pattern or a rest.

```brm
const { count, increment: add } = counter(0);
```

## BRM173

`{name} must return an object with plain keys`

The returned object has a computed key, a spread or a method.

```brm
return { count, increment };
```

## BRM174

`{name} cannot return getters or setters. Return the values themselves`

The returned object has a getter or a setter.

```brm
return { count, increment };
```

## BRM175

`{name} does not return {key}`

The component destructures a name that the module function does not return.

```brm
const { count } = counter(0);
```

## BRM176

`{name} returns {local} as {first} and as {key}. Return each local once, and give the other key a function of its own`

A module function returns one local under two keys.

```brm
return { count, increment };
```

## BRM177

`{name} is declared twice`

A name of the module function is also a name of the component.

```brm
const { count: first } = counter(0);
const { count: second } = counter(10);
```

## BRM178

`Parameters of {name} must be plain names`

A module function has a destructured or default parameter.

```brm
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## BRM179

`{name} reads {local}, which {specifier} does not export. Export it, so the component can import it`

A module function reads a value of its module that is not exported.

```brm
export const STEP = 1;
```
