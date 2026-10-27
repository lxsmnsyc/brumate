# Toast

A notice that comes and goes, such as "Draft saved".

```brm demo ToastDemo

```

## Anatomy

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

| Key                  | Action                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `F6` or `Shift + F6` | Moves focus to the newest toast that stays. In the region, gives focus back to where it was before. Shift changes nothing. |
| `Tab`                | Moves focus between the toasts and their buttons, in the order of the page.                                                |
| `Enter` or `Space`   | On the close button, closes the toast.                                                                                     |

## Styling

Style a toast with the data attributes above, such as `[data-closed]` while it comes in. The region has no style of its own, so place it with CSS, such as `position: fixed` in a corner. See [Styling](./styling.md).

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

- A `ToastRegion` renders the toasts of its queue at the end of the page, newest first. `toast` is a `#template` that gets each toast, with its `key` and `content`.
- The region is a landmark named "Notifications" while it has toasts. F6 moves focus to the newest toast, and F6 again gives focus back. When the toast with focus closes, focus moves to the next toast, or back to where it was.
- `transition` animates each toast with `data-closed`, `data-enter` and `data-leave`, as a [Transition](./transition.md) does, and a toast stays until its leave ends.
- The code of the region loads with the first toast of its queue, not with the page.
- The toasts stay usable while a [Modal](./modal.md) is open.

## Toast and ToastContent

- A `Toast` is an `alertdialog` that is not modal. Its `ToastContent` is an `alert`, so a screen reader reads it when it shows.
- A `Text` with `slot="title"` names the toast, and one with `slot="description"` describes it.
- A `Button` with `slot="close"` closes the toast, and is named "Close". Put it after the ToastContent, so a screen reader reads the content first.
