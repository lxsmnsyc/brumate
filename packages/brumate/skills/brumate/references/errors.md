# Errors

The compiler reports each error with the place in the file, as `message (File.brm:line:column)`. This page lists every message, with its cause and the form to write instead. A `{name}` is a part that varies.

It is generated from `src/error-catalog.ts`. Do not edit it by hand.

## Unterminated comment

A comment starts and never ends.

```brm fragment
<!-- A comment ends with -->
<script>
  /* and so does this one */
</script>
```

## Unterminated string

A string in code starts and never ends.

```brm fragment
const name = 'Ada';
```

## Unterminated template literal

A template string starts and never ends.

```brm fragment
const label = `Hello ${name}`;
```

## Unterminated regular expression

A regular expression starts and never ends.

```brm fragment
const digits = /\d+/;
```

## Unexpected "{char}"

Code has a bracket that closes nothing.

```brm fragment
const list = [1, 2];
```

## Expected "{char}"

Code opens a bracket and never closes it. The message names the closing one.

```brm fragment
const list = [1, 2];
```

## Expected "}" to close the block

A `#` block opens with `{` and the file ends before its `}`.

```brm fragment
#if (open) {
  <p>Open</p>
}
```

## Unexpected end of file, expected a closing tag

An element is never closed.

```brm fragment
<div>
  <p>Text</p>
</div>
```

## Unexpected closing tag

A closing tag has no opening tag.

```brm fragment
<p>Text</p>
```

## <script> must be at the top level or at the start of a block

A `<script>` is inside an element, or after other markup in a block.

```brm fragment
#for (item of items) {
  <script>
    let open = $signal(false);
  </script>
  <p>{item}</p>
}
```

## <style> must be at the top level

A `<style>` is inside an element or a block.

```brm fragment
<style>
  p {
    color: red;
  }
</style>
<p>Text</p>
```

## #template must be at the top level or at the start of a block

A `#template` is inside an element, or after other markup in a block.

```brm fragment
#template price(amount: number) {
  <b>{amount}</b>
}
```

## #{branch} must follow its block

A branch such as `#else` or `#catch` comes without the block that it belongs to.

```brm fragment
#if (open) {
  <p>Open</p>
} #else {
  <p>Closed</p>
}
```

## Expected a tag name

A `<` starts a tag with no name.

```brm fragment
<p>1 &lt; 2</p>
```

## <{name}> must end with "/>"

`<window>` and `<document>` take no children, so they close with `/>`.

```brm fragment
<window onKeyDown=(handler) />
```

## Expected </{name}>

A closing tag is not complete.

```brm fragment
<p>Text</p>
```

## Unexpected end of file, expected ">"

A tag starts and the file ends before its `>`.

```brm fragment
<input value=name>
```

## Expected whitespace between attributes

Two attributes touch each other.

```brm fragment
<input id=name type="text">
```

## Only event handlers are allowed here

`<window>` and `<document>` take event handlers and nothing else.

```brm fragment
<document onKeyDown=(handler) />
```

## Expected a spread or a shorthand attribute

A `{` in a tag holds something other than `...rest` or a name.

```brm fragment
<a {href} {...rest}>Open</a>
```

## Expected an attribute name

A tag has a character where an attribute name belongs.

```brm fragment
<input disabled>
```

## Unknown event modifier ":{modifier}"

The modifier after an event name is not one of the known ones.

```brm fragment
<form onSubmit=(prevent(send))></form>
```

## Modifiers apply to elements. Put ":{modifier}" on the element that the component renders

An event modifier is on a component, which only passes the handler on.

```brm fragment
<form onSubmit=(prevent(send))></form>
```

## Expected an event handler

An event attribute has no `=` and no value.

```brm fragment
<button onClick=(() => count++)>Add</button>
```

## An event handler must be an expression, not a string

The value of an event attribute is a quoted string.

```brm fragment
<button onClick=(() => count++)>Add</button>
```

## An attribute name can have one ":" namespace

An attribute name has two or more `:`.

```brm fragment
<svg xlink:href="#icon"></svg>
```

## ref takes $bind, as in ref=$bind(name)

`ref` has a value that is not `$bind(name)`.

```brm fragment
<input ref=$bind(input)>
```

## prefetch is removed. The code of the page loads when it starts

The `prefetch` attribute no longer exists.

```brm fragment
<a href="/about">About</a>
```

## Markup is not allowed in attribute values. Use a #template.

An attribute value holds an element.

```brm fragment
<List item=row />

#template row(name: string) {
  <b>{name}</b>
}
```

## Expected an attribute value

An attribute has `=` and nothing after it.

```brm fragment
<input value=name>
```

## Wrap this attribute value in parentheses

An attribute value without quotes has an operator or a space in it.

```brm fragment
<button disabled=(count > 3)>Add</button>
```

## Expected ">" to end <{name}>

A tag has text where its `>` belongs.

```brm fragment
<input value=name>
```

## Expected a quoted value

A `<script>` or `<style>` attribute has `=` without a quoted value.

```brm fragment
<script generics="T"></script>
```

## Expected {close}

A `<script>` or `<style>` is not closed.

```brm fragment
<script>
  let a = 1;
</script>
```

## Unknown <script> attribute "{name}"

A `<script>` has an attribute other than `module` and `generics`.

```brm fragment
<script module>
  export const MAX = 10;
</script>
```

## A file can have one <script module>

A file has two module scripts.

```brm fragment
<script module>
  export const MAX = 10;
  export const MIN = 1;
</script>
```

## A file can have one <script>

A file has two instance scripts.

```brm fragment
<script>
  let a = $signal(1);
  let b = $signal(2);
</script>
```

## lang must be "css", "scss" or "less"

A `<style>` names another language.

```brm fragment
<style lang="scss">
  p {
    a {
      color: red;
    }
  }
</style>
```

## #reveal takes an order, 'sequential', 'backwards', 'together' or 'natural', and collapsed, such as #reveal ('sequential', collapsed)

`#reveal` has an option that it does not know.

```brm fragment
#reveal ('sequential', collapsed) {
  …
}
```

## collapsed shows the fallback of the next body to show, so it needs the order 'sequential', not '{order}'

`collapsed` goes with `sequential` only.

```brm fragment
#reveal ('sequential', collapsed) {
  …
}
```

## #reveal has no script of its own

A `#reveal` body starts with a `<script>`.

```brm fragment
<script>
  let open = $signal(false);
</script>
#reveal {
  …
}
```

## Expected "(" after #{keyword}

A block that takes a condition or a list has no `(`.

```brm fragment
#if (open) {
  <p>Open</p>
}
```

## Expected an expression after #{keyword}

The parentheses of a block are empty.

```brm fragment
#if (open) {
  <p>Open</p>
}
```

## Expected "{" after #{keyword}

The header of a block is not followed by `{`.

```brm fragment
#if (open) {
  <p>Open</p>
}
```

## Expected "{" after #switch

`#switch` has no `{` after it.

```brm fragment
#switch {
  #case (tab === 1) {
    <p>One</p>
  }
}
```

## The script of a block takes no attributes

A `<script>` at the start of a block has attributes such as `module`.

```brm fragment
#for (item of items) {
  <script>
    let open = $signal(false);
  </script>
  <p>{item}</p>
}
```

## #try needs a #catch block

A `#try` body is not followed by `#catch`.

```brm fragment
#try {
  <p>{load()}</p>
} #catch (error, reset) {
  <p>Failed</p>
}
```

## Expected "(error, reset)" after #catch

The header of `#catch` names something other than a plain error name and a plain reset name.

```brm fragment
#catch (error, reset) {
  <p>{String(error)}</p>
}
```

## The trigger of #{keyword} must be "visible", "idle" or "load"

A `#client` block names another trigger.

```brm fragment
#client ('idle') {
  <p>In the browser</p>
}
```

## Unknown block #{keyword}

A `#` starts a block that does not exist.

```brm fragment
#if (open) {
  <p>Open</p>
}
```

## Expected "index of count" after #repeat

The header of `#repeat` is not `index of count`.

```brm fragment
#repeat (star of 5) {
  <i>{star}</i>
}
```

## Expected "item of list" or "item, index of list" after #for

The header of `#for` has no `of`.

```brm fragment
#for (item, index of items by item.id) {
  <li>{item.name}</li>
}
```

## Expected the height of an item in window(height)

`window` after a `#for` header has no height.

```brm fragment
#for (row of rows by row.id) window(32) {
  <tr><td>{row.name}</td></tr>
}
```

## Only #case and #default are allowed in #switch

A `#switch` holds markup other than its cases.

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

## #default must be the last branch of #switch

A `#case` comes after the `#default`.

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

## Expected "(" after the name of the template

A `#template` has no parameter list.

```brm fragment
#template price(amount: number) {
  <b>{amount}</b>
}
```

## Expected an expression

An attribute or a block has code that is not an expression.

```brm fragment
<p>{count + 1}</p>
```

## Expected a binding pattern

The name of a `#for` or `#catch` is not a name or a pattern.

```brm fragment
#for ({ id, name } of people by id) {
  <li>{name}</li>
}
```

## Expected parameters

The parameters of a `#template` are not a parameter list.

```brm fragment
#template price(amount: number) {
  <b>{amount}</b>
}
```

## "{name}" is already declared

Two declarations of one scope have the same name.

```brm fragment
let count = $signal(0);
let total = $signal(0);
```

## {name} takes a handler

`prevent`, `stop`, `once`, `capture` or `transition` has no handler, or `stop`, `once` or `capture` has keys.

```brm fragment
<form onSubmit=(prevent(send))></form>
```

## Only prevent of a keyboard event takes keys, such as onKeyDown

Keys are given to `prevent` of an event that is not `onKeyDown`, `onKeyUp` or `onKeyPress`.

```brm fragment
<ul onKeyDown=(prevent(move, 'ArrowDown'))></ul>
```

## Name each key of prevent as a string of its event.key, such as 'ArrowDown', 'Space' or 'a', with a modifier to hold if it needs one, such as 'Mod+ArrowDown'

A key of `prevent` is not a string literal of an `event.key`.

```brm fragment
<ul onKeyDown=(prevent(move, 'ArrowDown', 'Mod+ArrowUp'))></ul>
```

## Name each key of prevent as a string, such as 'Enter'

A key of `prevent` is not a string literal.

```brm fragment
<input onKeyDown=(prevent(submit, 'Enter'))>
```

## Server function "{name}" must be async

A function with `'use server'` is not `async`.

```brm fragment
async function save(list: string[]) {
  'use server';
  await db.save(list);
}
```

## The module script cannot have a default export

`<script module>` has `export default`.

```brm fragment
<script module>
  export const MAX = 10;
</script>
```

## A script cannot export values. Use <script module>

The instance script has an `export`.

```brm fragment
<script module>
  export const MAX = 10;
</script>
```

## $title takes one argument, the title

`$title` has no argument or more than one.

```brm fragment
$title('Todos');
```

## await works with $memo, not {name}

A declaration awaits a compile-time function other than `$memo`.

```brm fragment
const user = $memo(await load(id));
```

## $props() can only be called in the component script

`$props()` is in a module script or a function.

```brm fragment
const { name } = $props<{ name: string }>();
```

## Assign $props() to a const or a let

The result of `$props()` is not assigned with `const` or `let`.

```brm fragment
const { name } = $props<{ name: string }>();
```

## $props() takes no arguments

`$props()` has an argument.

```brm fragment
const { name } = $props<{ name: string }>();
```

## Assign $props() to a name or an object pattern

`$props()` is assigned to an array pattern.

```brm fragment
const { name } = $props<{ name: string }>();
```

## Create an ID with "const name = $id()"

`$id()` is not the value of a `const`.

```brm fragment
const field = $id();
```

## $id takes no arguments

`$id` has an argument.

```brm fragment
const field = $id();
```

## $isPassed takes a prop that the component destructures, such as $isPassed(value)

The argument of `$isPassed` is not a prop of the component.

```brm fragment
let { value } = $props<{ value?: Bindable<string> }>();
const passed = $isPassed(value);
```

## $navigation takes no arguments

`$navigation` has an argument.

```brm fragment
const navigation = $navigation();
```

## $route takes at most one argument, the path of the route

`$route` has more than one argument.

```brm fragment
const route = $route('/posts/[id]');
```

## Read a context with "const name = $getContext(Context)"

`$getContext` is not the value of a `const`.

```brm fragment
const theme = $getContext(ThemeContext);
```

## $getContext takes one argument, the context

`$getContext` has no argument or more than one.

```brm fragment
const theme = $getContext(ThemeContext);
```

## $setContext takes two arguments, the context and the value

`$setContext` has fewer or more than two arguments.

```brm fragment
$setContext(ThemeContext, theme);
```

## Declare the result of a form with "const name = $action(serverFunction)"

`$action` is not the value of a `const`.

```brm fragment
const result = $action(save);
```

## $action needs a server function of this file as its only argument

`$action` has no argument, or more than one.

```brm fragment
const result = $action(save);
```

## $action needs a server function of this file, and {name} is not one

The argument of `$action` is not a function with `'use server'` in this file.

```brm fragment
async function save(data: FormData) {
  'use server';
}
const result = $action(save);
```

## Declare {name} with const

`$debounced` or `$throttled` is declared with `let`.

```brm fragment
const query = $debounced(text, 300);
```

## {name} cannot be destructured

A signal, a memo or another value of a compile-time function is declared with a pattern.

```brm fragment
let count = $signal(0);
```

## {name} takes a value and a wait in milliseconds

`$debounced` or `$throttled` does not have both arguments.

```brm fragment
const query = $debounced(text, 300);
```

## The wait of {name} must be a number of milliseconds, such as 300

The wait of `$debounced` or `$throttled` is not a number literal.

```brm fragment
const query = $debounced(text, 300);
```

## Declare {name} with {expected}

`$signal` and `$optimistic` need `let`, and `$memo` needs `const`.

```brm fragment
let count = $signal(0);
const double = $memo(count * 2);
```

## {name} takes one argument

`$signal`, `$memo` or `$optimistic` has more than one argument.

```brm fragment
let count = $signal(0);
```

## {name} needs a value

`$memo` or `$optimistic` has no argument.

```brm fragment
const double = $memo(count * 2);
```

## $optimistic needs the name of a value, such as a memo

The argument of `$optimistic` is not a name.

```brm fragment
let shown = $optimistic(items);
```

## {name} does not return a value

`$effect` or `$client` is assigned to a name.

```brm fragment
$effect(() => {
  document.title = title;
});
```

## {name} needs a function

`$effect` or `$client` has no function as its callback.

```brm fragment
$effect(() => {
  document.title = title;
});
```

## The callback of {name} takes no parameters

The callback of `$effect` or `$client` has parameters.

```brm fragment
$effect(() => {
  document.title = title;
});
```

## The callback of {name} cannot be async

The callback of `$effect` or `$client` is `async`.

```brm fragment
$effect(() => {
  load(id).then((value) => (data = value));
});
```

## $effect takes one argument

`$effect` has more than one argument.

```brm fragment
$effect(() => {
  document.title = title;
});
```

## The trigger of $client must be "visible", "idle" or "load"

The second argument of `$client` is another string.

```brm fragment
$client(() => {
  measure();
}, 'idle');
```

## $handler needs a function as its first argument: a function expression, a function of the script, or one of them in a wrapper of brumate/events

The first argument of `$handler` is not a function.

```brm fragment
onClick: $handler(prevent(removeAt), index),
```

## The handler reads "{name}", a value of the function around $handler, which the browser does not have. Pass it as an argument: $handler(fn, {name})

A handler reads a local value of the function that calls `$handler`.

```brm fragment
onClick: $handler(removeAt, index),
```

## The arguments of $handler cannot be spread

`$handler` has a spread argument.

```brm fragment
onClick: $handler(removeAt, index, kind),
```

## The second argument of $bind is a function that takes the new value: a function expression, or a function of the script

The setter of `$bind` is not a function.

```brm fragment
<Toggle on=$bind(open, (next) => (open = next)) />
```

## The setter reads "{name}", a value of the function around $bind, which the browser does not have

The setter of `$bind` reads a local value that is not a value of the component.

```brm fragment
<Toggle on=$bind(open, (next) => (open = next)) />
```

## Pass $bind(name) as the value of a prop of a component, or of value or checked of an input, a select or a textarea

`$bind` is somewhere else, such as on a `class` or a `<div>`.

```brm fragment
<input value=$bind(draft)>
```

## $bind takes the name of a signal, and a function that writes it, such as $bind(open) or $bind(open, (next) => (open = next))

`$bind` has no argument, or an argument that is not a name.

```brm fragment
<Toggle on=$bind(open) />
```

## $bind takes a signal, or a prop that the component destructures with let, and "{name}" is not one

The name in `$bind` is a memo, a const prop or another value.

```brm fragment
let open = $signal(false);
<Toggle on=$bind(open) />
```

## $isBound takes a prop that the component destructures with let, such as $isBound(open)

The argument of `$isBound` is not a `let` prop.

```brm fragment
let { open } = $props<{ open?: Bindable<boolean> }>();
const bound = () => $isBound(open);
```

## $isPending needs an async $memo as its only argument

The argument of `$isPending` is not a memo that holds a promise.

```brm fragment
const results = $memo(search(query));
#if ($isPending(results)) {
  <p>Searching…</p>
}
```

## $produce needs a signal as its first argument

The first argument of `$produce` is not a signal.

```brm fragment
$produce(todos, (draft) => {
  draft.push(todo);
});
```

## $produce needs a recipe function as its second argument

The second argument of `$produce` is not a function.

```brm fragment
$produce(todos, (draft) => {
  draft.push(todo);
});
```

## "{name}" is reserved. Brumate writes the attributes that start with "b-"

An attribute starts with `b-`.

```brm fragment
<div data-id=id></div>
```

## "{name}" is not declared

The name in `ref=$bind(name)` is not a value of the component.

```brm fragment
let input = $signal<HTMLInputElement>();
<input ref=$bind(input)>
```

## ref takes a $signal, or a prop that the component destructures with let, but "{name}" is {kind}

The name in `ref=$bind(name)` is a memo, a const prop or another value.

```brm fragment
let input = $signal<HTMLInputElement>();
<input ref=$bind(input)>
```

## The prop "{name}" is not Bindable. Type it as Bindable<HTMLElement>, so a parent can bind it

A `let` prop is used as a `ref` and its type is not `Bindable`.

```brm fragment
let { ref } = $props<{ ref?: Bindable<HTMLButtonElement> }>();
```

## "{name}" is the props object, so read one key at a time, destructure it, or spread it in markup

The props object or the rest of `$props()` is used as a whole outside a markup spread: spread in code, passed to a function, `$memo`, `$setContext`, a signal or a variable, or given as a value in markup, such as `title=rest` or `<Badge {rest} />`. The copy loses the `ref` and the live props.

```brm fragment
const { class: className, ...rest } = $props();
<button {...rest} class=className>
```

## "{name}" is the props object, and props are read-only. Copy the key to a $signal or a $memo to change it

Code assigns to, updates or deletes a key of the props object or of the rest of `$props()`.

```brm fragment
let title = $signal('');
title = 'New';
```

## Cannot assign to {kind} "{name}"

Code writes a memo, a const prop or another value that cannot change.

```brm fragment
let count = $signal(0);
count = 5;
```

## Signal "{name}" can only be written in event handlers, effects, $client callbacks and functions

Setup code, which runs on the server, writes a signal.

```brm fragment
let count = $signal(5);
```

## Server function "{name}" captures "{variable}". Pass it as an argument

A server function reads a variable of the instance script.

```brm fragment
async function save(user: string) {
  'use server';
}
```

## $optimistic follows a memo, an action or a prop, not a signal

The source of `$optimistic` is a signal.

```brm fragment
let shown = $optimistic(items);
```

## Declare server functions at the top level of a script

A function with `'use server'` is inside another function or a block.

```brm fragment
async function save() {
  'use server';
}
```

## {name} cannot be used here

A compile-time function is used where it is not allowed.

```brm fragment
let count = $signal(0);
```

## Call $setContext at the top level of a script

`$setContext` is inside a function or a block of code.

```brm fragment
$setContext(ThemeContext, theme);
```

## Call $title at the top level of a script

`$title` is inside a function or a block of code.

```brm fragment
$title('Todos');
```

## Create an ID with "const name = $id()" at the top level of a script

`$id` is inside a function or a block of code.

```brm fragment
const field = $id();
```

## Check a prop with "const name = $isPassed(prop)" at the top level of the component script

`$isPassed` is inside a function or a block of code.

```brm fragment
const passed = $isPassed(value);
```

## Read a context with "const name = $getContext(Context)" at the top level of a script

`$getContext` is inside a function or a block of code.

```brm fragment
const theme = $getContext(ThemeContext);
```

## Read the route with "const name = $route()" at the top level of a script

`$route` is inside a function or a block of code.

```brm fragment
const route = $route();
```

## Read the navigation with "const name = $navigation()" at the top level of a script

`$navigation` is inside a function or a block of code.

```brm fragment
const navigation = $navigation();
```

## Call $props() as the value of a const in the component script

`$props` is used in another place than `const { … } = $props()`.

```brm fragment
const { name } = $props<{ name: string }>();
```

## Declare a signal with "let name = $signal(value)" at the top level of a script

`$signal` is inside a function or a block of code.

```brm fragment
let count = $signal(0);
```

## Declare a memo with "const name = $memo(value)" at the top level of a script

`$memo` is inside a function or a block of code.

```brm fragment
const double = $memo(count * 2);
```

## Declare a debounced value with "const name = $debounced(value, ms)" at the top level of a script

`$debounced` is inside a function or a block of code.

```brm fragment
const query = $debounced(text, 300);
```

## Declare a throttled value with "const name = $throttled(value, ms)" at the top level of a script

`$throttled` is inside a function or a block of code.

```brm fragment
const position = $throttled(pointer, 100);
```

## Declare an optimistic value with "let name = $optimistic(source)" at the top level of a script

`$optimistic` is inside a function or a block of code.

```brm fragment
let shown = $optimistic(items);
```

## Declare the result of a form with "const name = $action(serverFunction)" at the top level of a script

`$action` is inside a function or a block of code.

```brm fragment
const result = $action(save);
```

## Call $effect at the top level of a script

`$effect` is inside a function or a block of code.

```brm fragment
$effect(() => {
  document.title = title;
});
```

## Call $client at the top level of a script

`$client` is inside a function or a block of code.

```brm fragment
$client(() => {
  measure();
}, 'idle');
```

## $ref is not supported. Use a $signal with ref=$bind(name)

`$ref` was removed.

```brm fragment
let input = $signal<HTMLInputElement>();
<input ref=$bind(input)>
```

## $watch is not supported. Use $effect

`$watch` was removed.

```brm fragment
$effect(() => {
  save(value);
});
```

## $settled is not supported. Use $client

`$settled` was removed.

```brm fragment
$client(() => {
  measure();
});
```

## $cleanup is not supported. Return a cleanup function from $effect or $client

`$cleanup` was removed.

```brm fragment
$effect(() => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
});
```

## $store is not supported yet

`$store` does not exist.

```brm fragment
let todos = $signal([]);
```

## $get is not supported. Signals cannot leave the file

`$get` was removed. A signal never leaves its file.

```brm fragment
// Pass the value, or a function that writes it.
onChange=((next) => (count = next))
```

## $set is not supported. Signals cannot leave the file

`$set` was removed. A signal never leaves its file.

```brm fragment
// Pass the value, or a function that writes it.
onChange=((next) => (count = next))
```

## {name} was renamed to {renamed}. Import {renamed} from '{module}'

The file imports a name that the compiler knew before it was renamed.

```brm fragment
import { $signal } from 'brumate/signals';
```

## Import {name} from '{module}'

The file calls a compile-time function that it does not import.

```brm fragment
import { $signal } from 'brumate/signals';
```

## "{name}" holds a new {kind}, which cannot be sent to the browser, and code that runs in the browser reads it{reader}. Use it in a server function, or create it in the browser, such as in $client

A value that cannot be sent to the browser, such as a database client, is read by code that runs there.

```brm fragment
async function list() {
  'use server';
  return db.all();
}
```

## {what} is read by code that runs in the browser ({site}). Read it in a server function

Code that runs in the browser reads an environment variable of the server.

```brm fragment
async function key() {
  'use server';
  return env.API_KEY;
}
```

## "{name}" holds {what} and code that runs in the browser reads it. Keep server variables out of values that the browser reads

A value holds an environment variable of the server, and the browser reads the value.

```brm fragment
async function key() {
  'use server';
  return env.API_KEY;
}
```

## #defer cannot be inside a #client body

A `#defer` is in markup that only the browser renders.

```brm fragment
#defer {
  <Comments />
}
```

## #defer cannot be in markup that the browser renders

A `#defer` is in a body that the browser adds later, such as the body of a changing `#if`.

```brm fragment
#defer {
  <Comments />
}
```

## A value that changes in <{tag}> must be its whole content, such as <{tag}>{`Count ${count}`}</{tag}>

A `<title>`, `<textarea>`, `<style>` or `<script>` holds a changing value next to other content.

```brm fragment
<textarea>{`Count ${count}`}</textarea>
```

## Put <title> in #head, as <meta> and <link>, such as #head { <title>{`${count} left`}</title> }

A `<title>` is outside `#head`.

```brm fragment
#head {
  <title>{`${count} left`}</title>
}
```

## A dynamic tag that changes on the client is not supported yet

No `.brm` file reaches it today: the parser keys every dynamic tag, and a `<{tag}>` whose tag a handler changes compiles. It is kept for a tag that the compiler could not update.

```brm fragment
<{tag} class="title">Title</>
```

## Code that the browser updates can await only a memo. Load the promise in a memo instead

Code that runs again in the browser awaits something other than a memo.

```brm fragment
const user = $memo(await load(id));
```

## Markup that the browser renders can await only a memo. Load the promise in a memo instead

Markup that the browser renders awaits something other than a memo.

```brm fragment
const user = $memo(await load(id));
```

## This attribute cannot change on the client yet

The name or the value of an attribute with a computed name, as in `[name]=value`, changes in the browser.

```brm fragment
<div class=(open ? "open" : "closed")></div>
```

## This computed attribute has a name or value with no code in the browser, so it cannot stay when the attributes of the element update

An element has a computed attribute, as in `[name]=(value)`, and a spread or another computed attribute that can change. The name or the value is a constant, or a signal that nothing writes, so the browser has no code for it, and an update of the element would remove the attribute. Make both a signal that the page writes, or write the attribute without brackets.

```brm fragment
let name = $signal('data-x');
let value = $signal('on');

<button onClick=(() => ((name = 'data-y'), (value = 'off')))>Change</button>
<p {...props} [name]=(value)></p>
<p {...props} data-x="on"></p>
```

## Destructuring assignment to a signal is not supported in client code yet

Code that runs in the browser writes a signal in a destructuring assignment.

```brm fragment
[first, second] = pair;
// Write each signal on its own:
first = pair[0];
second = pair[1];
```

## Assign to "{name}" with = instead of {op}

An optimistic value is changed with `++` or `--`.

```brm fragment
shown = shown + 1;
```

## Invalid CSS: {message}

A `<style>` has CSS that does not parse.

```brm fragment
<style>
  p {
    color: red;
  }
</style>
```

## Module functions call each other too deeply. A module function cannot call itself

A function of a module of reactive logic calls itself, or a loop of functions call each other.

```brm fragment
function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## Destructure what {name} returns, as in const { value } = {name}(…)

The result of a module function is kept as one object.

```brm fragment
const { count, increment } = counter(0);
```

## Declare what {name} returns with const

The result of a module function is declared with `let`.

```brm fragment
const { count, increment } = counter(0);
```

## Call {name} at the top level of a script, as in const { value } = {name}(…). Its signals become values of the component, so it cannot run in a function, a condition or a loop

A module function is called inside a function, a condition or a loop.

```brm fragment
const { count, increment } = counter(0);
```

## Cannot read {specifier}

The module that the component imports is not on disk.

```brm fragment
import { counter } from './counter.brm.ts';
```

## {specifier} does not export a function named {name}

The import names a function that the module does not export.

```brm fragment
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## {name} needs a body that ends with return { … }

A module function is an arrow function with an expression body.

```brm fragment
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## {name} must end with return { … }, an object of what it gives

A module function does not end with `return { … }`.

```brm fragment
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## {name} can return only at its end

A module function returns in the middle of its body.

```brm fragment
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## Destructure {name} with plain names, as in const { value, other: renamed } = {name}(…)

The result of a module function is destructured with a default, a nested pattern or a rest.

```brm fragment
const { count, increment: add } = counter(0);
```

## {name} must return an object with plain keys

The returned object has a computed key, a spread or a method.

```brm fragment
return { count, increment };
```

## {name} cannot return getters or setters. Return the values themselves

The returned object has a getter or a setter.

```brm fragment
return { count, increment };
```

## {name} does not return {key}

The component destructures a name that the module function does not return.

```brm fragment
const { count } = counter(0);
```

## {name} returns {local} as {first} and as {key}. Return each local once, and give the other key a function of its own

A module function returns one local under two keys.

```brm fragment
return { count, increment };
```

## {name} is declared twice

A name of the module function is also a name of the component.

```brm fragment
const { count: first } = counter(0);
const { count: second } = counter(10);
```

## Parameters of {name} must be plain names

A module function has a destructured or default parameter.

```brm fragment
export function counter(start: number) {
  let count = $signal(start);
  return { count };
}
```

## {name} reads {local}, which {specifier} does not export. Export it, so the component can import it

A module function reads a value of its module that is not exported.

```brm fragment
export const STEP = 1;
```
