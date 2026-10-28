# Toast

A notice that comes and goes, such as "Draft saved".

```brm demo ToastDemo

```

## Anatomy

```brm anatomy ToastAnatomy
`ToastRegion`: Holds the toasts of one queue, newest first. It is a landmark named "Notifications" while it has toasts.
`Toast`: One toast. It is an `alertdialog` that is not modal, and it takes focus with Tab and F6.
`ToastContent`: The text. It is an `alert`, so a screen reader reads it when the toast shows.
`Text` with `slot="title"`: Names the toast.
`Text` with `slot="description"`: Describes the toast. Optional.
`Button` with `slot="close"`: Closes the toast. It is named "Close". Optional.
```

The picture draws the region in place with one toast. The real region renders at the end of the page, and CSS places it in a corner.

```html
<ToastRegion>
  <Toast>
    <ToastContent>
      <Text slot="title" />
      <Text slot="description" />
    </>
    <Button slot="close" />
  </>
</>
```

The `Text` with `slot="description"` and the close `Button` are optional. The `Toast` is the root of the `toast` template of the region.

## Props

### ToastRegion

```props ToastRegion

```

### Toast

```props Toast

```

### ToastContent

```props ToastContent

```

## Data attributes

### ToastRegion

| Attribute    | When                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------- |
| `data-queue` | The region shows toasts, with the name of its queue. It is absent while the queue is empty. |

### Toast

| Attribute         | When                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| `data-toast-key`  | Always, with the key of the toast in the queue.                        |
| `data-closed`     | The region has `transition`, and the toast is closed or about to open. |
| `data-enter`      | The region has `transition`, and the enter of the toast is running.    |
| `data-leave`      | The region has `transition`, and the leave of the toast is running.    |
| `data-transition` | The region has `transition`, and the toast is entering or leaving.     |

## Keyboard

| Key                  | Action                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `F6` or `Shift + F6` | `F6` outside the region moves focus to the newest toast that stays. In the region, both give focus back to where it was before. `Shift + F6` outside the region does nothing. The key is prevented only when focus moves. |
| `Tab`                | Moves focus between the toasts and their buttons, in the order of the page.                                                                                                                                               |
| `Enter` or `Space`   | On the close button, closes the toast.                                                                                                                                                                                    |

## Controlled and uncontrolled

A toast has no state prop, so this page has no controlled and uncontrolled shapes. The queue holds the toasts: `add` puts one in and returns its key, `close(key)` takes it out, and `timeout` closes it for you. Your code is the owner of the queue, as it is of a signal that it binds, and `onClose` of the options runs when a toast closes, by any way. A toast is not a form field, so a reset of a form changes nothing. The server renders no toast: the queue lives in the browser. See [State](./state.md) for the parts that have state.

## Styling

Style a toast with the data attributes above, such as `[data-closed]` while it comes in. The region has no style of its own, so place it with CSS, such as `position: fixed` in a corner. See [Styling](./styling.md).

This stylesheet places the region in the bottom right corner, and styles the toast at rest, with the pointer over it, with keyboard focus, and in its closed look, plus a kind of toast (`data-kind`), and the close Button in every state. Press Save and Fail to save, then Tab to a toast with F6. Its tokens are at the top, and they follow the color scheme.

```brm styled ToastStyled

```

## Use cases

### Undo

A toast can hold a button. This one offers Undo for a removed note. Undo puts the note back where it was, and closes its toast with `toastQueue(name).close(key)`. The toast lasts five seconds, and the time stops while the pointer or focus is in the region.

```brm demo ToastUndoDemo

```

### Toasts that stay, and a limit

A toast without `timeout` stays until it is closed, which suits an error that people must not miss. The second argument of `toastQueue` limits how many show at a time: here two, and the others wait for a place. The region has its own `aria-label`, and sits in the corner like the one above.

```brm demo ToastKindsDemo

```

## The queue

A queue holds the toasts. `toastQueue(name)` returns the queue with that name, `default` by default, so any handler can add to it:

```ts
import { toastQueue } from '@brumate/ui/toast.ts';

const key = toastQueue<{ title: string }>().add({ title: 'Draft saved' }, { timeout: 5000 });
toastQueue().close(key);
```

- `timeout` closes a toast after that many milliseconds, at least 5000. The time stops while the pointer or focus is in the region. Leave it out for a notice that people must not miss.
- `maxVisibleToasts`, the second argument of `toastQueue`, is how many show at a time, 5 by default. Any call that passes it sets it. The others wait.

## The region

- A `ToastRegion` renders the toasts of its queue at the end of the page, newest first. `toast` is a `#template` that gets each toast, with its `key` and `content`. The region does not get the type of the content from its queue, so give the template's parameter a type, such as `toast: QueuedToast<Notice>`.
- The region is a landmark named "Notifications" while it has toasts. F6 moves focus to the newest toast, and F6 again gives focus back. When the toast with focus closes, focus moves to the next toast, or back to where it was.
- `transition` animates each toast with `data-closed`, `data-enter` and `data-leave`, as a [Transition](./transition.md) does, and a toast stays until its leave ends.
- The code of the region loads with the first toast of its queue, not with the page.
- The toasts stay usable while a [Modal](./modal.md) is open.

## Toast and ToastContent

- A `Toast` is an `alertdialog` that is not modal. Its `ToastContent` is an `alert`, so a screen reader reads it when it shows.
- A `Text` with `slot="title"` names the toast, and one with `slot="description"` describes it.
- A `Button` with `slot="close"` closes the toast, and is named "Close". Put it after the ToastContent, so a screen reader reads the content first.
