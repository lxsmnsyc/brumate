# Events

`onEvent=handler` runs the handler when the DOM event fires. The name after `on` is the event: `onClick` is `click`, `onKeyDown` is `keydown`. The handler gets the event. It is the name of a function, an arrow function in parentheses, or a call that returns a function.

```brm
<script>
  import { $signal } from 'brumate/signals';
  import { once, prevent, stop } from 'brumate/events';

  let draft = $signal('');
  let message = $signal('');
  let focused = $signal(0);

  function send() {
    message = `Sent: ${draft}`;
    draft = '';
  }

  function move(event: KeyboardEvent) {
    focused += event.key === 'ArrowDown' ? 1 : -1;
  }
</script>

<form onSubmit=(prevent(send))>
  <label>
    Message
    <input value=draft onInput=((event) => (draft = event.currentTarget.value))>
  </label>
  <button>Send</button>
</form>
<ul tabindex="0" onKeyDown=(prevent(move, 'ArrowDown', 'ArrowUp'))>
  <li>Item {focused}</li>
</ul>
<button onClick=(stop(prevent(send)))>Send</button>
<button onClick=(once(() => (message = 'First click')))>Once</button>
<p>{message}</p>
```

## Wrappers

A handler runs after the event has finished dispatching, so the browser has acted on the event by then. A wrapper from `brumate/events` applies before the code of the handler loads. The compiler reads it in the markup, so write it in the attribute.

| Wrapper                     | Effect                                                                         |
| --------------------------- | ------------------------------------------------------------------------------ |
| `prevent(handler)`          | Calls `event.preventDefault()`.                                                |
| `prevent(handler, ...keys)` | On a keyboard event, prevents only these keys. The handler runs for every key. |
| `stop(handler)`             | Stops the event at this element.                                               |
| `once(handler)`             | Runs the handler for the first event only.                                     |
| `capture(handler)`          | Runs the handler in the capture phase.                                         |
| `transition(handler)`       | Runs the handler in a view transition. It takes types after it.                |

- Wrappers nest in any order: `stop(prevent(save))`.
- Keys are string literals of `event.key`: `'Enter'`, `'Escape'`, `'ArrowDown'`, `'F1'`, a letter or a number key, and `'Space'`. Only `prevent` of `onKeyDown`, `onKeyUp` and `onKeyPress` takes keys.
- A key alone is prevented only while Ctrl, Meta and Alt are up, so shortcuts of the browser keep working. `'Mod+ArrowDown'` names Ctrl or Meta, and `'Ctrl+…'`, `'Meta+…'` and `'Alt+…'` name one.
- There are no modifiers such as `onSubmit:prevent`, and none on components. A component puts the wrapper on the element that it renders.
- A handler that the caller passes to a component goes through `{...rest}` to the element, with its wrappers. Both run, the element's own first.

```brm wrong: Only prevent of a keyboard event takes keys, such as onKeyDown
<script>
  import { prevent } from 'brumate/events';

  function save() {}
</script>

<button onClick=(prevent(save, 'Enter'))>Save</button>
```

```brm wrong: Name each key of prevent as a string of its event.key, such as 'ArrowDown', 'Space' or 'a', with a modifier to hold if it needs one, such as 'Mod+ArrowDown'
<script>
  import { prevent } from 'brumate/events';

  function move() {}
</script>

<ul onKeyDown=(prevent(move, 'NotAKey'))></ul>
```

## Cancel from a part

`cancelWhen(element, 'click' | 'submit', check)` from `brumate/events` cancels the event of the element or of an element inside it while `check(event)` returns true, before any brumate handler runs. It returns a function that removes the check. It calls `preventDefault()` and does not stop the event, so plain `addEventListener` listeners still run and can read `event.defaultPrevented`. An element inside a shadow root is not reached.

```ts
const stop = cancelWhen(form, 'submit', () => form.hasAttribute('data-pending'));
```

## Handlers that a script makes

A function in a script is a handler only when markup uses it, so a spread leaves it out. `$handler(fn, ...args)` marks one. The arguments are JSON values, and the handler runs as `fn(...args, event)`. A value of the function around the call must be an argument.

```brm
<script>
  import { $handler, $signal } from 'brumate/signals';
  import { prevent } from 'brumate/events';

  let items = $signal(['Milk', 'Bread']);

  function removeAt(index: number) {
    items = items.filter((_, at) => at !== index);
  }

  const remove = (index: number) => ({
    type: 'button',
    'aria-label': `Remove ${items[index]}`,
    onClick: $handler(prevent(removeAt), index),
  });
</script>

<ul>
  #for (item, index of items by item) {
    <li>{item} <button {...remove(index)}>x</button></li>
  }
</ul>
```

## Window and document

`<window onResize=(handler) />` and `<document onKeyDown=(handler) />` listen to events of the window and the document. They take event handlers only, and close with `/>`.
