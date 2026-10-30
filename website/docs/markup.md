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
- `null` and `undefined` leave the attribute out.
- `true` and `false` depend on the attribute:
  - An attribute that says its state in its value gets the word: `aria-*` and `data-*`, `contenteditable`, `draggable`, `spellcheck` and `writingsuggestions` say `"true"` or `"false"`, `translate` says `"yes"` or `"no"`, and `autocomplete` and `autocorrect` say `"on"` or `"off"`. So `aria-expanded=open` renders `aria-expanded="false"` when `open` is `false`.
  - Any other attribute, such as `disabled` or `open`, is there for `true`, without a value, and left out for `false`.
- An attribute without a value in the markup, such as `<input disabled>` or `<div data-ready>`, renders as it is written.

Shorthands:

```brm
<a {href}>Open</a>            <!-- the same as href=href -->
<button {onClick}>Go</button>  <!-- the same as onClick=onClick, a handler -->
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

`{ on }` is the class `on` while `on` is true. In an array, such as `class=(['task', on && 'on'])`, empty and false items are skipped. A style property whose value is `null`, `undefined` or `false` is left out.

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

A tag with no content can close itself, as a void element or a component with no children does:

```brm
<script>
  import { $props } from 'brumate/signals';

  const { as = 'hr' } = $props<{ as?: string }>();
</script>

<{as} class="divider" />
```

`</>` is the only closing tag of a dynamic tag. `</{tag}>` is an error.

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
  import { once, prevent } from 'brumate/events';

  let message = $signal('');
  let draft = $signal('');

  function send() {
    message = `Sent: ${draft}`;
    draft = '';
  }
</script>

<form onSubmit=(prevent(send))>
  <label>
    Message
    <input value=draft onInput=((event) => (draft = event.currentTarget.value))>
  </label>
  <button>Send</button>
</form>
<p>{message}</p>
<button onClick=(once(() => (message = 'Only the first click counts')))>Click once</button>
```

The handler is a name of a function, an arrow function in parentheses, or a call that returns a function. Its code loads with the page. An event that comes before the code has loaded waits for it.

### Before the handler loads

A handler runs after the event has finished dispatching, so the browser has acted on the event by then. `brumate/events` wraps a handler with what has to happen at once:

| Wrapper                     | Effect                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `prevent(handler)`          | Calls `event.preventDefault()`.                                                                  |
| `prevent(handler, ...keys)` | On a keyboard event, prevents only these keys. The handler still runs for every key.             |
| `stop(handler)`             | Stops the event at this element, so the handlers of the elements around it do not run.           |
| `once(handler)`             | Runs the handler for the first event only.                                                       |
| `capture(handler)`          | Runs the handler before the handlers of the elements inside, as a listener in the capture phase. |

Handlers run as if each element had its own listener. Those wrapped by `capture` run first, from the outside in, and then the others, from the target outwards. An event that does not bubble, such as `focus`, `blur`, `mouseenter` or `scroll`, runs only the handlers of its target and the `capture` handlers around it. Listeners are passive unless a handler of the event prevents, so there is no `passive` wrapper.

```brm
<script>
  import { prevent, stop } from 'brumate/events';
</script>

<ul role="listbox" tabindex="0" onKeyDown=(prevent(move, 'ArrowDown', 'ArrowUp', 'Home', 'End'))>
  …
</ul>
<button onClick=(stop(prevent(save)))>Save</button>
```

- The compiler reads the wrappers in the markup and writes them into the page, so the loader applies them while the event dispatches, even before the code of the page has loaded. Calling `event.preventDefault()` in the handler is too late.
- Wrappers nest, in any order.
- Keys are strings of their `event.key`: a named key such as `'Enter'`, `'Escape'`, `'ArrowDown'` or `'F1'`, a letter or a digit, and `'Space'` for the space bar. TypeScript completes them, and the compiler reports a key that is not one. Only `prevent` of `onKeyDown`, `onKeyUp` and `onKeyPress` takes keys.
- Write the wrapper in the attribute, with keys as string literals, so the compiler can read it.
- A key that an input method gets while it composes text, such as the Enter that ends a word in Japanese, is never prevented, because it belongs to the input method.
- A key alone is prevented only while Ctrl, Meta and Alt are up, so the shortcuts of the browser, such as Cmd+Left or Alt+Left to go back, keep working. Shift does not count. To prevent a key with a modifier held, name the modifier: `'Mod+ArrowDown'` for Ctrl or Meta, or `'Ctrl+…'`, `'Meta+…'` or `'Alt+…'`. A list that moves focus with Ctrl and an arrow prevents `'Mod+ArrowDown'` too.

A modifier after the event name, as in `onSubmit:prevent=send`, does the same, with a warning that points to the wrapper. It goes in a later version. A modifier on a component is a compile error: the component puts the wrapper on the element that it renders, such as a listbox that prevents the keys it handles.

### Cancel an event from a part

`cancelWhen(element, type, check)` from `brumate/events` cancels a `click` or a `submit` of the element, or of an element inside it, while `check(event)` returns true. It returns a function that removes the check. Other types, such as `scroll` or `wheel`, are a type error, for their listeners are passive.

```ts
import { cancelWhen } from 'brumate/events';

// In a `$client` callback: no submit of the form while it is pending.
const stop = cancelWhen(form, 'submit', () => form.hasAttribute('data-pending'));
```

- The document listener of brumate walks from the target up and runs the checks of the type before any handler. When one returns true, it calls `event.preventDefault()` and runs no brumate handler for the event.
- It does not stop the event. Listeners that were added with `addEventListener` still run, and they can read `event.defaultPrevented`.
- A listener that a part adds on the form cannot do this: the document listener runs first, in the capture phase. `cancelWhen` is the hook for a part that must cancel before the delegated handlers.
- An element inside a shadow root is not reached, for the listener sees the host as the target.
- The checks exist after the code of the part has loaded.

### Animating a change

`transition(handler)` from `brumate/events` runs the handler inside a [view transition](https://developer.mozilla.org/docs/Web/API/View_Transition_API). The browser animates from the page before the handler to the page after it, including elements that `#if` or `#for` removes and items that change order. CSS styles the animation.

```brm live
<script>
  import { $signal } from 'brumate/signals';
  import { transition } from 'brumate/events';

  let items = $signal(['Ada', 'Grace', 'Linus']);
</script>

<button onClick=(transition(() => (items = [...items].reverse())))>Reverse</button>
<ul>
  #for (item of items by item) {
    <li style=(`view-transition-name: item-${item}`)>{item}</li>
  }
</ul>
```

- The transition holds the writes that the handler makes before its first `await`. Writes after it, such as after a server call, change the page without an animation.
- When the code of the page has not loaded yet, the transition waits for it. The browser keeps the old page on screen until then.
- `transition(handler, ...types)` gives the transition types, which CSS matches with `:active-view-transition-type(type)`.
- Without view transitions, or with `prefers-reduced-motion`, the handler runs as it is.
- It nests with the other wrappers, in any order: `transition(prevent(save))`.
- The browser runs one view transition at a time, and blocks clicks while it runs. Keep them short, and use CSS transitions for changes that repeat fast, such as typing.

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

## `$id`

`$id()` returns an ID that is unique in the page. Use it to connect a label or a description to a field:

```brm live
<script>
  import { $id } from 'brumate/signals';

  const field = $id();
  const hint = $id();
</script>

<label for=field>Email</label>
<input id=field type="email" aria-describedby=hint>
<p id=hint>We never share your email.</p>
```

- The server and the browser make the same ID, so a component that the browser renders later gets the same IDs as it would on the server.
- Each instance of a component gets its own IDs, so a component can be used many times on a page.
- An ID has only letters, digits, `-` and `_`, such as `b3-0`, so it also works in a CSS selector, as `#b3-0`.
- In the [script of a block](./control-flow.md#a-script-in-a-block), such as the body of a `#for`, each item gets its own IDs:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let fields = $signal(['Name', 'Email']);
</script>

#for (name of fields by name) {
  <script>
    import { $id } from 'brumate/signals';

    const id = $id();
  </script>
  <p>
    <label for=id>{name}</label>
    <input {id}>
  </p>
}
<button onClick=(() => (fields = [...fields, `Field ${fields.length + 1}`]))>Add a field</button>
```
