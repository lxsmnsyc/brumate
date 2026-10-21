# Markup

The markup of a component is HTML with `{…}` expressions, attribute values without quotes, event handlers, and `#` blocks for control flow. Markup that never changes ships as HTML only.

## Expressions

`{expression}` inserts a value. It updates when the values it reads change:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let name = $signal('world');
  const items = ['one', 'two'];
</script>

<label>
  Name
  <input value=name onInput=((event) => (name = event.currentTarget.value))>
</label>
<p>Hello, {name.toUpperCase()}!</p>
<p>{items.length} items. {null}{false}{undefined}</p>
```

- A string or a number is inserted as text. Text is always escaped, so `{'<b>'}` shows the characters `<b>`.
- `null`, `undefined`, `true` and `false` insert nothing. This makes `{error && error.message}` safe.
- An array inserts each of its items.

## Attributes

An attribute takes a quoted string, a value without quotes, or an expression in parentheses:

```brm
<input type="text" value=draft maxlength=(limit - 1) disabled=(!editable)>
<img src=user.avatar alt=(`Photo of ${user.name}`)>
```

- A quoted value is a plain string.
- A value without quotes is a name, a property path or a call, such as `draft`, `user.avatar` or `format(date)`. Numbers, objects, arrays and template strings work without parentheses too.
- Anything else, such as an operator, needs parentheses: `(count > 0)`.
- `true` renders the attribute without a value, and `false`, `null` and `undefined` leave it out. Use `String(open)` for an attribute that must say `false`, such as `aria-expanded`.

Shorthands:

```brm
<a {href}>Open</a>            <!-- the same as href=href -->
<input {...rest}>              <!-- every property of rest as an attribute -->
<div [name]=value></div>       <!-- the attribute name is an expression -->
```

### `class` and `style`

`class` takes a string, an array, or an object whose keys are class names that apply while their values are true. `style` takes a string, or an object of properties in camel case:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let on = $signal(false);
  let size = $signal(16);
</script>

<button class={ on, big: size > 20 } onClick=(() => (on = !on))>Toggle</button>
<button onClick=(() => (size += 4))>Bigger</button>
<p style={ fontSize: `${size}px`, color: on ? 'crimson' : undefined }>Some text</p>
```

`{ on }` is the class `on` while `on` is true. A style property whose value is `null`, `undefined` or `false` is left out.

## Dynamic tags

`<{tag}>` renders the element or component that `tag` names. Close it with `</>`:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let level = $signal<'h2' | 'h3' | 'h4'>('h2');
</script>

<button onClick=(() => (level = level === 'h2' ? 'h3' : level === 'h3' ? 'h4' : 'h2'))>Next level</button>
<{level} class="title">A {level} heading</>
```

When `tag` changes in the browser, the element renders again with the new tag.

## HTML strings

Inserted text is escaped. `raw` from `brumate/html` inserts a string as HTML, such as the HTML of a Markdown file:

```brm
<script>
  import { raw } from 'brumate/html';
  import { html } from './post.md';
</script>

<article>{raw(html)}</article>
```

Insert only HTML that you trust. HTML from a user can run scripts in your page.

## Events

`onEvent=handler` runs the handler when the event fires. The name after `on` is the DOM event, so `onClick` listens to `click` and `onKeyDown` to `keydown`. The handler gets the event:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let message = $signal('');
  let draft = $signal('');

  function send() {
    message = `Sent: ${draft}`;
    draft = '';
  }
</script>

<form onSubmit:prevent=send>
  <label>
    Message
    <input value=draft onInput=((event) => (draft = event.currentTarget.value))>
  </label>
  <button>Send</button>
</form>
<p>{message}</p>
<button onClick:once=(() => (message = 'Only the first click counts'))>Click once</button>
```

The handler is a name of a function, or an arrow function in parentheses. It loads in the browser when its event first fires.

### Modifiers

Modifiers follow the event name, as in `onSubmit:prevent`. They apply before the handler loads:

| Modifier   | Effect                                     |
| ---------- | ------------------------------------------ |
| `:prevent` | Calls `event.preventDefault()`.            |
| `:stop`    | Calls `event.stopPropagation()`.           |
| `:passive` | Adds the listener as passive.              |
| `:once`    | Removes the handler after the first event. |
| `:capture` | Listens in the capture phase.              |

Use `:prevent` rather than calling `event.preventDefault()` in the handler. The browser decides on the default action as soon as the event fires, before the handler's code has loaded.

### Loading handlers early

The code of a handler loads when the pointer moves over its element, or when the element gets focus, so it is often ready before the click. Once the page has loaded and the browser is idle, it also loads for elements in or near the viewport. See [Idle preload](./client-modules.md#idle-preload). `prefetch` on the element changes when:

- `prefetch="hover"`, the default: on pointer over or focus, and near the viewport once the page is idle.
- `prefetch="visible"`: when the element enters the viewport.
- `prefetch="idle"`: when the browser is idle after the page loads.
- `prefetch="none"`: only when the event fires. Idle preload skips it too.

```brm
<button prefetch="visible" onClick=checkout>Buy</button>
```

## Window and document events

`<window>` and `<document>` listen to events of the window and the document. They must close with `/>`:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let key = $signal('none yet');
  let width = $signal(0);
</script>

<window onKeyDown=((event) => (key = event.key)) onResize=(() => (width = window.innerWidth)) />
<p>Last key: {key}. Click here and press a key.</p>
<p>Width after the last resize: {width}</p>
```

Their listeners start when the page resumes, and stop when the component is removed.

## Accessibility warnings

The compiler warns about common accessibility mistakes. The warnings show in the build, in the editor and in `brumate-tsc`:

- An `<img>` without `alt`. Use `alt=""` for an image that only decorates.
- A click handler on an element that a keyboard cannot use, such as a `<div>` or an `<li>`, without a `role` and a key handler. A `<button>` is usually the better element.
- An `<input>`, `<select>` or `<textarea>` without a label: a `<label>` around it, a `<label for>` that names its `id`, or `aria-label`. A placeholder is not a label.
- A link or a button without text or `aria-label`. An image with `alt` text counts as text.

An element with a spread or a computed attribute is not checked, because any attribute can be in it. `a11y: false` in the [plugin options](./reference-plugin.md) turns the warnings off.
