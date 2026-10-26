/** One compile error of a `.brm` file. */
export interface ErrorEntry {
  /** The message the compiler reports, with `{name}` for the parts that vary. */
  message: string;
  /** What causes it, in one sentence. */
  cause: string;
  /** The form to write instead, as a short `brm` example. */
  fix: string;
  /** Added by brumate-check: a code such as BRM012, and the docs page that explains it. */
  code?: string;
  link?: string;
}

function entry(message: string, cause: string, fix: string): ErrorEntry {
  return { message, cause, fix };
}

/** Syntax errors of the parser, in the order of a file. */
const SYNTAX: ErrorEntry[] = [
  entry(
    'Unterminated comment',
    'A comment starts and never ends.',
    '<!-- A comment ends with -->\n<script>\n  /* and so does this one */\n</script>',
  ),
  entry('Unterminated string', 'A string in code starts and never ends.', "const name = 'Ada';"),
  entry(
    'Unterminated template literal',
    'A template string starts and never ends.',
    'const label = `Hello ${name}`;',
  ),
  entry(
    'Unterminated regular expression',
    'A regular expression starts and never ends.',
    'const digits = /\\d+/;',
  ),
  entry('Unexpected "{char}"', 'Code has a bracket that closes nothing.', 'const list = [1, 2];'),
  entry(
    'Expected "{char}"',
    'Code opens a bracket and never closes it. The message names the closing one.',
    'const list = [1, 2];',
  ),
  entry(
    'Expected "}" to close the block',
    'A `#` block opens with `{` and the file ends before its `}`.',
    '#if (open) {\n  <p>Open</p>\n}',
  ),
  entry(
    'Unexpected end of file, expected a closing tag',
    'An element is never closed.',
    '<div>\n  <p>Text</p>\n</div>',
  ),
  entry('Unexpected closing tag', 'A closing tag has no opening tag.', '<p>Text</p>'),
  entry(
    '<script> must be at the top level or at the start of a block',
    'A `<script>` is inside an element, or after other markup in a block.',
    '#for (item of items) {\n  <script>\n    let open = $signal(false);\n  </script>\n  <p>{item}</p>\n}',
  ),
  entry(
    '<style> must be at the top level',
    'A `<style>` is inside an element or a block.',
    '<style>\n  p {\n    color: red;\n  }\n</style>\n<p>Text</p>',
  ),
  entry(
    '#template must be at the top level or at the start of a block',
    'A `#template` is inside an element, or after other markup in a block.',
    '#template price(amount: number) {\n  <b>{amount}</b>\n}',
  ),
  entry(
    '#{branch} must follow its block',
    'A branch such as `#else` or `#catch` comes without the block that it belongs to.',
    '#if (open) {\n  <p>Open</p>\n} #else {\n  <p>Closed</p>\n}',
  ),
  entry('Expected a tag name', 'A `<` starts a tag with no name.', '<p>1 &lt; 2</p>'),
  entry(
    '<{name}> must end with "/>"',
    '`<window>` and `<document>` take no children, so they close with `/>`.',
    '<window onKeyDown=(handler) />',
  ),
  entry('Expected </{name}>', 'A closing tag is not complete.', '<p>Text</p>'),
  entry(
    'Unexpected end of file, expected ">"',
    'A tag starts and the file ends before its `>`.',
    '<input value=name>',
  ),
  entry(
    'Expected whitespace between attributes',
    'Two attributes touch each other.',
    '<input id=name type="text">',
  ),
  entry(
    'Only event handlers are allowed here',
    '`<window>` and `<document>` take event handlers and nothing else.',
    '<document onKeyDown=(handler) />',
  ),
  entry(
    'Expected a spread or a shorthand attribute',
    'A `{` in a tag holds something other than `...rest` or a name.',
    '<a {href} {...rest}>Open</a>',
  ),
  entry(
    'Expected an attribute name',
    'A tag has a character where an attribute name belongs.',
    '<input disabled>',
  ),
  entry(
    'Unknown event modifier ":{modifier}"',
    'The modifier after an event name is not one of the known ones.',
    '<form onSubmit=(prevent(send))></form>',
  ),
  entry(
    'Modifiers apply to elements. Put ":{modifier}" on the element that the component renders',
    'An event modifier is on a component, which only passes the handler on.',
    '<form onSubmit=(prevent(send))></form>',
  ),
  entry(
    'Expected an event handler',
    'An event attribute has no `=` and no value.',
    '<button onClick=(() => count++)>Add</button>',
  ),
  entry(
    'An event handler must be an expression, not a string',
    'The value of an event attribute is a quoted string.',
    '<button onClick=(() => count++)>Add</button>',
  ),
  entry(
    'An attribute name can have one ":" namespace',
    'An attribute name has two or more `:`.',
    '<svg xlink:href="#icon"></svg>',
  ),
  entry(
    'ref takes $bind, as in ref=$bind(name)',
    '`ref` has a value that is not `$bind(name)`.',
    '<input ref=$bind(input)>',
  ),
  entry(
    'prefetch is removed. The code of the page loads when it starts',
    'The `prefetch` attribute no longer exists.',
    '<a href="/about">About</a>',
  ),
  entry(
    'Markup is not allowed in attribute values. Use a #template.',
    'An attribute value holds an element.',
    '<List item=row />\n\n#template row(name: string) {\n  <b>{name}</b>\n}',
  ),
  entry(
    'Expected an attribute value',
    'An attribute has `=` and nothing after it.',
    '<input value=name>',
  ),
  entry(
    'Wrap this attribute value in parentheses',
    'An attribute value without quotes has an operator or a space in it.',
    '<button disabled=(count > 3)>Add</button>',
  ),
  entry(
    'Expected ">" to end <{name}>',
    'A tag has text where its `>` belongs.',
    '<input value=name>',
  ),
  entry(
    'Expected a quoted value',
    'A `<script>` or `<style>` attribute has `=` without a quoted value.',
    '<script generics="T"></script>',
  ),
  entry(
    'Expected {close}',
    'A `<script>` or `<style>` is not closed.',
    '<script>\n  let a = 1;\n</script>',
  ),
  entry(
    'Unknown <script> attribute "{name}"',
    'A `<script>` has an attribute other than `module` and `generics`.',
    '<script module>\n  export const MAX = 10;\n</script>',
  ),
  entry(
    'A file can have one <script module>',
    'A file has two module scripts.',
    '<script module>\n  export const MAX = 10;\n  export const MIN = 1;\n</script>',
  ),
  entry(
    'A file can have one <script>',
    'A file has two instance scripts.',
    '<script>\n  let a = $signal(1);\n  let b = $signal(2);\n</script>',
  ),
  entry(
    'lang must be "css", "scss" or "less"',
    'A `<style>` names another language.',
    '<style lang="scss">\n  p {\n    a {\n      color: red;\n    }\n  }\n</style>',
  ),
  entry(
    "#reveal takes an order, 'sequential', 'backwards', 'together' or 'natural', and collapsed, such as #reveal ('sequential', collapsed)",
    '`#reveal` has an option that it does not know.',
    "#reveal ('sequential', collapsed) {\n  …\n}",
  ),
  entry(
    "collapsed shows the fallback of the next body to show, so it needs the order 'sequential', not '{order}'",
    '`collapsed` goes with `sequential` only.',
    "#reveal ('sequential', collapsed) {\n  …\n}",
  ),
  entry(
    '#reveal has no script of its own',
    'A `#reveal` body starts with a `<script>`.',
    '<script>\n  let open = $signal(false);\n</script>\n#reveal {\n  …\n}',
  ),
  entry(
    'Expected "(" after #{keyword}',
    'A block that takes a condition or a list has no `(`.',
    '#if (open) {\n  <p>Open</p>\n}',
  ),
  entry(
    'Expected an expression after #{keyword}',
    'The parentheses of a block are empty.',
    '#if (open) {\n  <p>Open</p>\n}',
  ),
  entry(
    'Expected "{" after #{keyword}',
    'The header of a block is not followed by `{`.',
    '#if (open) {\n  <p>Open</p>\n}',
  ),
  entry(
    'Expected "{" after #switch',
    '`#switch` has no `{` after it.',
    '#switch {\n  #case (tab === 1) {\n    <p>One</p>\n  }\n}',
  ),
  entry(
    'The script of a block takes no attributes',
    'A `<script>` at the start of a block has attributes such as `module`.',
    '#for (item of items) {\n  <script>\n    let open = $signal(false);\n  </script>\n  <p>{item}</p>\n}',
  ),
  entry(
    '#try needs a #catch block',
    'A `#try` body is not followed by `#catch`.',
    '#try {\n  <p>{load()}</p>\n} #catch (error, reset) {\n  <p>Failed</p>\n}',
  ),
  entry(
    'Expected "(error, reset)" after #catch',
    'The header of `#catch` names something other than a plain error name and a plain reset name.',
    '#catch (error, reset) {\n  <p>{String(error)}</p>\n}',
  ),
  entry(
    'The trigger of #{keyword} must be "visible", "idle" or "load"',
    'A `#client` block names another trigger.',
    "#client ('idle') {\n  <p>In the browser</p>\n}",
  ),
  entry(
    'Unknown block #{keyword}',
    'A `#` starts a block that does not exist.',
    '#if (open) {\n  <p>Open</p>\n}',
  ),
  entry(
    'Expected "index of count" after #repeat',
    'The header of `#repeat` is not `index of count`.',
    '#repeat (star of 5) {\n  <i>{star}</i>\n}',
  ),
  entry(
    'Expected "item of list" or "item, index of list" after #for',
    'The header of `#for` has no `of`.',
    '#for (item, index of items by item.id) {\n  <li>{item.name}</li>\n}',
  ),
  entry(
    'Expected the height of an item in window(height)',
    '`window` after a `#for` header has no height.',
    '#for (row of rows by row.id) window(32) {\n  <tr><td>{row.name}</td></tr>\n}',
  ),
  entry(
    'Only #case and #default are allowed in #switch',
    'A `#switch` holds markup other than its cases.',
    '#switch {\n  #case (tab === 1) {\n    <p>One</p>\n  }\n  #default {\n    <p>Other</p>\n  }\n}',
  ),
  entry(
    '#default must be the last branch of #switch',
    'A `#case` comes after the `#default`.',
    '#switch {\n  #case (tab === 1) {\n    <p>One</p>\n  }\n  #default {\n    <p>Other</p>\n  }\n}',
  ),
  entry(
    'Expected "(" after the name of the template',
    'A `#template` has no parameter list.',
    '#template price(amount: number) {\n  <b>{amount}</b>\n}',
  ),
  entry(
    'Expected an expression',
    'An attribute or a block has code that is not an expression.',
    '<p>{count + 1}</p>',
  ),
  entry(
    'Expected a binding pattern',
    'The name of a `#for` or `#catch` is not a name or a pattern.',
    '#for ({ id, name } of people by id) {\n  <li>{name}</li>\n}',
  ),
  entry(
    'Expected parameters',
    'The parameters of a `#template` are not a parameter list.',
    '#template price(amount: number) {\n  <b>{amount}</b>\n}',
  ),
];

/** Errors about `$signal`, `$memo` and the other compile-time functions. */
const SCRIPT: ErrorEntry[] = [
  entry(
    '"{name}" is already declared',
    'Two declarations of one scope have the same name.',
    'let count = $signal(0);\nlet total = $signal(0);',
  ),
  entry(
    '{name} takes a handler',
    '`prevent`, `stop`, `once`, `capture` or `transition` has no handler, or `stop`, `once` or `capture` has keys.',
    '<form onSubmit=(prevent(send))></form>',
  ),
  entry(
    'Only prevent of a keyboard event takes keys, such as onKeyDown',
    'Keys are given to `prevent` of an event that is not `onKeyDown`, `onKeyUp` or `onKeyPress`.',
    "<ul onKeyDown=(prevent(move, 'ArrowDown'))></ul>",
  ),
  entry(
    "Name each key of prevent as a string of its event.key, such as 'ArrowDown', 'Space' or 'a', with a modifier to hold if it needs one, such as 'Mod+ArrowDown'",
    'A key of `prevent` is not a string literal of an `event.key`.',
    "<ul onKeyDown=(prevent(move, 'ArrowDown', 'Mod+ArrowUp'))></ul>",
  ),
  entry(
    "Name each key of prevent as a string, such as 'Enter'",
    'A key of `prevent` is not a string literal.',
    "<input onKeyDown=(prevent(submit, 'Enter'))>",
  ),
  entry(
    'Server function "{name}" must be async',
    "A function with `'use server'` is not `async`.",
    "async function save(list: string[]) {\n  'use server';\n  await db.save(list);\n}",
  ),
  entry(
    'The module script cannot have a default export',
    '`<script module>` has `export default`.',
    '<script module>\n  export const MAX = 10;\n</script>',
  ),
  entry(
    'A script cannot export values. Use <script module>',
    'The instance script has an `export`.',
    '<script module>\n  export const MAX = 10;\n</script>',
  ),
  entry(
    '$title takes one argument, the title',
    '`$title` has no argument or more than one.',
    "$title('Todos');",
  ),
  entry(
    'await works with $memo, not {name}',
    'A declaration awaits a compile-time function other than `$memo`.',
    'const user = $memo(await load(id));',
  ),
  entry(
    '$props() can only be called in the component script',
    '`$props()` is in a module script or a function.',
    'const { name } = $props<{ name: string }>();',
  ),
  entry(
    'Assign $props() to a const or a let',
    'The result of `$props()` is not assigned with `const` or `let`.',
    'const { name } = $props<{ name: string }>();',
  ),
  entry(
    '$props() takes no arguments',
    '`$props()` has an argument.',
    'const { name } = $props<{ name: string }>();',
  ),
  entry(
    'Assign $props() to a name or an object pattern',
    '`$props()` is assigned to an array pattern.',
    'const { name } = $props<{ name: string }>();',
  ),
  entry(
    'Create an ID with "const name = $id()"',
    '`$id()` is not the value of a `const`.',
    'const field = $id();',
  ),
  entry('$id takes no arguments', '`$id` has an argument.', 'const field = $id();'),
  entry(
    '$isPassed takes a prop that the component destructures, such as $isPassed(value)',
    'The argument of `$isPassed` is not a prop of the component.',
    'let { value } = $props<{ value?: Bindable<string> }>();\nconst passed = $isPassed(value);',
  ),
  entry(
    '$navigation takes no arguments',
    '`$navigation` has an argument.',
    'const navigation = $navigation();',
  ),
  entry(
    '$route takes at most one argument, the path of the route',
    '`$route` has more than one argument.',
    "const route = $route('/posts/[id]');",
  ),
  entry(
    'Read a context with "const name = $getContext(Context)"',
    '`$getContext` is not the value of a `const`.',
    'const theme = $getContext(ThemeContext);',
  ),
  entry(
    '$getContext takes one argument, the context',
    '`$getContext` has no argument or more than one.',
    'const theme = $getContext(ThemeContext);',
  ),
  entry(
    '$setContext takes two arguments, the context and the value',
    '`$setContext` has fewer or more than two arguments.',
    '$setContext(ThemeContext, theme);',
  ),
  entry(
    'Declare the result of a form with "const name = $action(serverFunction)"',
    '`$action` is not the value of a `const`.',
    'const result = $action(save);',
  ),
  entry(
    '$action needs a server function of this file as its only argument',
    '`$action` has no argument, or more than one.',
    'const result = $action(save);',
  ),
  entry(
    '$action needs a server function of this file, and {name} is not one',
    "The argument of `$action` is not a function with `'use server'` in this file.",
    "async function save(data: FormData) {\n  'use server';\n}\nconst result = $action(save);",
  ),
  entry(
    'Declare {name} with const',
    '`$debounced` or `$throttled` is declared with `let`.',
    'const query = $debounced(text, 300);',
  ),
  entry(
    '{name} cannot be destructured',
    'A signal, a memo or another value of a compile-time function is declared with a pattern.',
    'let count = $signal(0);',
  ),
  entry(
    '{name} takes a value and a wait in milliseconds',
    '`$debounced` or `$throttled` does not have both arguments.',
    'const query = $debounced(text, 300);',
  ),
  entry(
    'The wait of {name} must be a number of milliseconds, such as 300',
    'The wait of `$debounced` or `$throttled` is not a number literal.',
    'const query = $debounced(text, 300);',
  ),
  entry(
    'Declare {name} with {expected}',
    '`$signal` and `$optimistic` need `let`, and `$memo` needs `const`.',
    'let count = $signal(0);\nconst double = $memo(count * 2);',
  ),
  entry(
    '{name} takes one argument',
    '`$signal`, `$memo` or `$optimistic` has more than one argument.',
    'let count = $signal(0);',
  ),
  entry(
    '{name} needs a value',
    '`$memo` or `$optimistic` has no argument.',
    'const double = $memo(count * 2);',
  ),
  entry(
    '$optimistic needs the name of a value, such as a memo',
    'The argument of `$optimistic` is not a name.',
    'let shown = $optimistic(items);',
  ),
  entry(
    '{name} does not return a value',
    '`$effect` or `$client` is assigned to a name.',
    '$effect(() => {\n  document.title = title;\n});',
  ),
  entry(
    '{name} needs a function',
    '`$effect` or `$client` has no function as its callback.',
    '$effect(() => {\n  document.title = title;\n});',
  ),
  entry(
    'The callback of {name} takes no parameters',
    'The callback of `$effect` or `$client` has parameters.',
    '$effect(() => {\n  document.title = title;\n});',
  ),
  entry(
    'The callback of {name} cannot be async',
    'The callback of `$effect` or `$client` is `async`.',
    '$effect(() => {\n  load(id).then((value) => (data = value));\n});',
  ),
  entry(
    '$effect takes one argument',
    '`$effect` has more than one argument.',
    '$effect(() => {\n  document.title = title;\n});',
  ),
  entry(
    'The trigger of $client must be "visible", "idle" or "load"',
    'The second argument of `$client` is another string.',
    "$client(() => {\n  measure();\n}, 'idle');",
  ),
  entry(
    '$handler needs a function as its first argument: a function expression, a function of the script, or one of them in a wrapper of brumate/events',
    'The first argument of `$handler` is not a function.',
    'onClick: $handler(prevent(removeAt), index),',
  ),
  entry(
    'The handler reads "{name}", a value of the function around $handler, which the browser does not have. Pass it as an argument: $handler(fn, {name})',
    'A handler reads a local value of the function that calls `$handler`.',
    'onClick: $handler(removeAt, index),',
  ),
  entry(
    'The arguments of $handler cannot be spread',
    '`$handler` has a spread argument.',
    'onClick: $handler(removeAt, index, kind),',
  ),
  entry(
    'The second argument of $bind is a function that takes the new value: a function expression, or a function of the script',
    'The setter of `$bind` is not a function.',
    '<Toggle on=$bind(open, (next) => (open = next)) />',
  ),
  entry(
    'The setter reads "{name}", a value of the function around $bind, which the browser does not have',
    'The setter of `$bind` reads a local value that is not a value of the component.',
    '<Toggle on=$bind(open, (next) => (open = next)) />',
  ),
  entry(
    'Pass $bind(name) as the value of a prop of a component, or of value or checked of an input, a select or a textarea',
    '`$bind` is somewhere else, such as on a `class` or a `<div>`.',
    '<input value=$bind(draft)>',
  ),
  entry(
    '$bind takes the name of a signal, and a function that writes it, such as $bind(open) or $bind(open, (next) => (open = next))',
    '`$bind` has no argument, or an argument that is not a name.',
    '<Toggle on=$bind(open) />',
  ),
  entry(
    '$bind takes a signal, or a prop that the component destructures with let, and "{name}" is not one',
    'The name in `$bind` is a memo, a const prop or another value.',
    'let open = $signal(false);\n<Toggle on=$bind(open) />',
  ),
  entry(
    '$isBound takes a prop that the component destructures with let, such as $isBound(open)',
    'The argument of `$isBound` is not a `let` prop.',
    'let { open } = $props<{ open?: Bindable<boolean> }>();\nconst bound = () => $isBound(open);',
  ),
  entry(
    '$isPending needs an async $memo as its only argument',
    'The argument of `$isPending` is not a memo that holds a promise.',
    'const results = $memo(search(query));\n#if ($isPending(results)) {\n  <p>Searching…</p>\n}',
  ),
  entry(
    '$produce needs a signal as its first argument',
    'The first argument of `$produce` is not a signal.',
    '$produce(todos, (draft) => {\n  draft.push(todo);\n});',
  ),
  entry(
    '$produce needs a recipe function as its second argument',
    'The second argument of `$produce` is not a function.',
    '$produce(todos, (draft) => {\n  draft.push(todo);\n});',
  ),
  entry(
    '"{name}" is reserved. Brumate writes the attributes that start with "b-"',
    'An attribute starts with `b-`.',
    '<div data-id=id></div>',
  ),
  entry(
    '"{name}" is not declared',
    'The name in `ref=$bind(name)` is not a value of the component.',
    'let input = $signal<HTMLInputElement>();\n<input ref=$bind(input)>',
  ),
  entry(
    'ref takes a $signal, or a prop that the component destructures with let, but "{name}" is {kind}',
    'The name in `ref=$bind(name)` is a memo, a const prop or another value.',
    'let input = $signal<HTMLInputElement>();\n<input ref=$bind(input)>',
  ),
  entry(
    'The prop "{name}" is not Bindable. Type it as Bindable<HTMLElement>, so a parent can bind it',
    'A `let` prop is used as a `ref` and its type is not `Bindable`.',
    'let { ref } = $props<{ ref?: Bindable<HTMLButtonElement> }>();',
  ),
  entry(
    'Cannot assign to {kind} "{name}"',
    'Code writes a memo, a const prop or another value that cannot change.',
    'let count = $signal(0);\ncount = 5;',
  ),
  entry(
    'Signal "{name}" can only be written in event handlers, effects, $client callbacks and functions',
    'Setup code, which runs on the server, writes a signal.',
    'let count = $signal(5);',
  ),
  entry(
    'Server function "{name}" captures "{variable}". Pass it as an argument',
    'A server function reads a variable of the instance script.',
    "async function save(user: string) {\n  'use server';\n}",
  ),
  entry(
    '$optimistic follows a memo, an action or a prop, not a signal',
    'The source of `$optimistic` is a signal.',
    'let shown = $optimistic(items);',
  ),
  entry(
    'Declare server functions at the top level of a script',
    "A function with `'use server'` is inside another function or a block.",
    "async function save() {\n  'use server';\n}",
  ),
  entry(
    '{name} cannot be used here',
    'A compile-time function is used where it is not allowed.',
    'let count = $signal(0);',
  ),
  entry(
    'Call $setContext at the top level of a script',
    '`$setContext` is inside a function or a block of code.',
    '$setContext(ThemeContext, theme);',
  ),
  entry(
    'Call $title at the top level of a script',
    '`$title` is inside a function or a block of code.',
    "$title('Todos');",
  ),
  entry(
    'Create an ID with "const name = $id()" at the top level of a script',
    '`$id` is inside a function or a block of code.',
    'const field = $id();',
  ),
  entry(
    'Check a prop with "const name = $isPassed(prop)" at the top level of the component script',
    '`$isPassed` is inside a function or a block of code.',
    'const passed = $isPassed(value);',
  ),
  entry(
    'Read a context with "const name = $getContext(Context)" at the top level of a script',
    '`$getContext` is inside a function or a block of code.',
    'const theme = $getContext(ThemeContext);',
  ),
  entry(
    'Read the route with "const name = $route()" at the top level of a script',
    '`$route` is inside a function or a block of code.',
    'const route = $route();',
  ),
  entry(
    'Read the navigation with "const name = $navigation()" at the top level of a script',
    '`$navigation` is inside a function or a block of code.',
    'const navigation = $navigation();',
  ),
  entry(
    'Call $props() as the value of a const in the component script',
    '`$props` is used in another place than `const { … } = $props()`.',
    'const { name } = $props<{ name: string }>();',
  ),
  entry(
    'Declare a signal with "let name = $signal(value)" at the top level of a script',
    '`$signal` is inside a function or a block of code.',
    'let count = $signal(0);',
  ),
  entry(
    'Declare a memo with "const name = $memo(value)" at the top level of a script',
    '`$memo` is inside a function or a block of code.',
    'const double = $memo(count * 2);',
  ),
  entry(
    'Declare a debounced value with "const name = $debounced(value, ms)" at the top level of a script',
    '`$debounced` is inside a function or a block of code.',
    'const query = $debounced(text, 300);',
  ),
  entry(
    'Declare a throttled value with "const name = $throttled(value, ms)" at the top level of a script',
    '`$throttled` is inside a function or a block of code.',
    'const position = $throttled(pointer, 100);',
  ),
  entry(
    'Declare an optimistic value with "let name = $optimistic(source)" at the top level of a script',
    '`$optimistic` is inside a function or a block of code.',
    'let shown = $optimistic(items);',
  ),
  entry(
    'Declare the result of a form with "const name = $action(serverFunction)" at the top level of a script',
    '`$action` is inside a function or a block of code.',
    'const result = $action(save);',
  ),
  entry(
    'Call $effect at the top level of a script',
    '`$effect` is inside a function or a block of code.',
    '$effect(() => {\n  document.title = title;\n});',
  ),
  entry(
    'Call $client at the top level of a script',
    '`$client` is inside a function or a block of code.',
    "$client(() => {\n  measure();\n}, 'idle');",
  ),
  entry(
    '$ref is not supported. Use a $signal with ref=$bind(name)',
    '`$ref` was removed.',
    'let input = $signal<HTMLInputElement>();\n<input ref=$bind(input)>',
  ),
  entry(
    '$watch is not supported. Use $effect',
    '`$watch` was removed.',
    '$effect(() => {\n  save(value);\n});',
  ),
  entry(
    '$settled is not supported. Use $client',
    '`$settled` was removed.',
    '$client(() => {\n  measure();\n});',
  ),
  entry(
    '$cleanup is not supported. Return a cleanup function from $effect or $client',
    '`$cleanup` was removed.',
    '$effect(() => {\n  const timer = setInterval(tick, 1000);\n  return () => clearInterval(timer);\n});',
  ),
  entry('$store is not supported yet', '`$store` does not exist.', 'let todos = $signal([]);'),
  entry(
    '$get is not supported. Signals cannot leave the file',
    '`$get` was removed. A signal never leaves its file.',
    '// Pass the value, or a function that writes it.\nonChange=((next) => (count = next))',
  ),
  entry(
    '$set is not supported. Signals cannot leave the file',
    '`$set` was removed. A signal never leaves its file.',
    '// Pass the value, or a function that writes it.\nonChange=((next) => (count = next))',
  ),
  entry(
    "{name} was renamed to {renamed}. Import {renamed} from '{module}'",
    'The file imports a name that the compiler knew before it was renamed.',
    "import { $signal } from 'brumate/signals';",
  ),
  entry(
    "Import {name} from '{module}'",
    'The file calls a compile-time function that it does not import.',
    "import { $signal } from 'brumate/signals';",
  ),
];

/** Errors about the code that the browser gets, and the markup that the browser renders. */
const OUTPUT: ErrorEntry[] = [
  entry(
    '"{name}" holds a new {kind}, which cannot be sent to the browser, and code that runs in the browser reads it{reader}. Use it in a server function, or create it in the browser, such as in $client',
    'A value that cannot be sent to the browser, such as a database client, is read by code that runs there.',
    "async function list() {\n  'use server';\n  return db.all();\n}",
  ),
  entry(
    '{what} is read by code that runs in the browser ({site}). Read it in a server function',
    'Code that runs in the browser reads an environment variable of the server.',
    "async function key() {\n  'use server';\n  return env.API_KEY;\n}",
  ),
  entry(
    '"{name}" holds {what} and code that runs in the browser reads it. Keep server variables out of values that the browser reads',
    'A value holds an environment variable of the server, and the browser reads the value.',
    "async function key() {\n  'use server';\n  return env.API_KEY;\n}",
  ),
  entry(
    '#defer cannot be inside a #client body',
    'A `#defer` is in markup that only the browser renders.',
    '#defer {\n  <Comments />\n}',
  ),
  entry(
    '#defer cannot be in markup that the browser renders',
    'A `#defer` is in a body that the browser adds later, such as the body of a changing `#if`.',
    '#defer {\n  <Comments />\n}',
  ),
  entry(
    'A value that changes in <{tag}> must be its whole content, such as <{tag}>{`Count ${count}`}</{tag}>',
    'A `<title>`, `<textarea>`, `<style>` or `<script>` holds a changing value next to other content.',
    '<textarea>{`Count ${count}`}</textarea>',
  ),
  entry(
    'Put <title> in #head, as <meta> and <link>, such as #head { <title>{`${count} left`}</title> }',
    'A `<title>` is outside `#head`.',
    '#head {\n  <title>{`${count} left`}</title>\n}',
  ),
  entry(
    'Invalid CSS: {message}',
    'A `<style>` has CSS that does not parse.',
    '<style>\n  p {\n    color: red;\n  }\n</style>',
  ),
  entry(
    'Module functions call each other too deeply. A module function cannot call itself',
    'A function of a module of reactive logic calls itself, or a loop of functions call each other.',
    'function counter(start: number) {\n  let count = $signal(start);\n  return { count };\n}',
  ),
];

/** Errors about modules of reactive logic, such as `counter.brm.ts`. */
const MODULES: ErrorEntry[] = [
  entry(
    'Destructure what {name} returns, as in const { value } = {name}(…)',
    'The result of a module function is kept as one object.',
    'const { count, increment } = counter(0);',
  ),
  entry(
    'Declare what {name} returns with const',
    'The result of a module function is declared with `let`.',
    'const { count, increment } = counter(0);',
  ),
  entry(
    'Call {name} at the top level of a script, as in const { value } = {name}(…). Its signals become values of the component, so it cannot run in a function, a condition or a loop',
    'A module function is called inside a function, a condition or a loop.',
    'const { count, increment } = counter(0);',
  ),
  entry(
    'Cannot read {specifier}',
    'The module that the component imports is not on disk.',
    "import { counter } from './counter.brm.ts';",
  ),
  entry(
    '{specifier} does not export a function named {name}',
    'The import names a function that the module does not export.',
    'export function counter(start: number) {\n  let count = $signal(start);\n  return { count };\n}',
  ),
  entry(
    '{name} needs a body that ends with return { … }',
    'A module function is an arrow function with an expression body.',
    'export function counter(start: number) {\n  let count = $signal(start);\n  return { count };\n}',
  ),
  entry(
    '{name} must end with return { … }, an object of what it gives',
    'A module function does not end with `return { … }`.',
    'export function counter(start: number) {\n  let count = $signal(start);\n  return { count };\n}',
  ),
  entry(
    '{name} can return only at its end',
    'A module function returns in the middle of its body.',
    'export function counter(start: number) {\n  let count = $signal(start);\n  return { count };\n}',
  ),
  entry(
    'Destructure {name} with plain names, as in const { value, other: renamed } = {name}(…)',
    'The result of a module function is destructured with a default, a nested pattern or a rest.',
    'const { count, increment: add } = counter(0);',
  ),
  entry(
    '{name} must return an object with plain keys',
    'The returned object has a computed key, a spread or a method.',
    'return { count, increment };',
  ),
  entry(
    '{name} cannot return getters or setters. Return the values themselves',
    'The returned object has a getter or a setter.',
    'return { count, increment };',
  ),
  entry(
    '{name} does not return {key}',
    'The component destructures a name that the module function does not return.',
    'const { count } = counter(0);',
  ),
  entry(
    '{name} returns {local} as {first} and as {key}. Return each local once, and give the other key a function of its own',
    'A module function returns one local under two keys.',
    'return { count, increment };',
  ),
  entry(
    '{name} is declared twice',
    'A name of the module function is also a name of the component.',
    'const { count: first } = counter(0);\nconst { count: second } = counter(10);',
  ),
  entry(
    'Parameters of {name} must be plain names',
    'A module function has a destructured or default parameter.',
    'export function counter(start: number) {\n  let count = $signal(start);\n  return { count };\n}',
  ),
  entry(
    '{name} reads {local}, which {specifier} does not export. Export it, so the component can import it',
    'A module function reads a value of its module that is not exported.',
    'export const STEP = 1;',
  ),
];

export const ERRORS: readonly ErrorEntry[] = [...SYNTAX, ...SCRIPT, ...OUTPUT, ...MODULES];

/** True when a message that the compiler reported has the form of an entry. */
export function matchesError(error: ErrorEntry, message: string): boolean {
  const pattern = error.message
    .split(/\{\w+\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s\\S]*?');
  return new RegExp(`^${pattern}$`).test(message);
}

/**
 * The entry for a message that the compiler reported. The place of the
 * error, as in `(File.brm:3:7)`, can follow the message.
 */
export function findError(message: string): ErrorEntry | undefined {
  const bare = message.replace(/(?:\s\([^()]*:\d+:\d+\))+$/, '');
  return ERRORS.find((error) => matchesError(error, bare));
}

/** The text of references/errors.md. */
export function renderErrors(): string {
  const lines = [
    '# Errors',
    '',
    'The compiler reports each error with the place in the file, as `message (File.brm:line:column)`. This page lists every message, with its cause and the form to write instead. A `{name}` is a part that varies.',
    '',
    'It is generated from `src/error-catalog.ts`. Do not edit it by hand.',
  ];
  for (const error of ERRORS) {
    lines.push('', `## ${error.code ? `${error.code}: ` : ''}${error.message}`, '', error.cause);
    if (error.link) {
      lines.push('', error.link);
    }
    lines.push('', '```brm fragment', error.fix, '```');
  }
  return `${lines.join('\n')}\n`;
}
