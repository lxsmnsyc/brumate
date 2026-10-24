# Status

Parts that show a value in a range, `Meter` and `ProgressBar`, and notices that come and go, `Toast`.

```brm demo MeterDemo

```

## Meter

A value that stays in a known range, such as the space used on a disk.

- `value`, `minValue` and `maxValue` set the range, 0 to 100 by default.
- `aria-valuetext` is the value as the locale writes it, a percentage by default. `formatOptions` changes it, with the options of `Intl.NumberFormat`, and `valueLabel` replaces it.
- A `Label` inside names it.
- It sets `--percentage` for CSS, and a `content` template gets the percentage and the text.

## ProgressBar

The progress of a task. It takes the props of a `Meter`.

- `isIndeterminate` is a task of no known length. It has no value, and shows `data-indeterminate`.

## Toast

A notice that comes and goes, such as "Draft saved".

```brm demo ToastDemo

```

- A queue holds the toasts. `toastQueue(name)` returns the queue with that name, `default` by default, so any handler can add to it:

```ts
import { toastQueue } from '@brumate/ui/toast.ts';

const key = toastQueue<{ title: string }>().add({ title: 'Draft saved' }, { timeout: 5000 });
toastQueue().close(key);
```

- A `ToastRegion` renders the toasts of its queue at the end of the page, newest first. `toast` is a `#template` that gets each toast, with its `key` and `content`.
- The region is a landmark named "Notifications" while it has toasts. F6 moves focus to the newest toast, and F6 again gives focus back. When the toast with focus closes, focus moves to the next toast, or back to where it was.
- A `Toast` is an `alertdialog` that is not modal. Its `ToastContent` is an `alert`, so a screen reader reads it when it shows. A `Text` with `slot="title"` names the toast, and one with `slot="description"` describes it.
- A `Button` with `slot="close"` closes the toast, and is named "Close". Put it after the ToastContent, so a screen reader reads the content first.
- `timeout` closes a toast after that many milliseconds, at least 5000. The time stops while the pointer or focus is in the region. Leave it out for a notice that people must not miss.
- `maxVisibleToasts`, the second argument of the first `toastQueue` call, is how many show at a time, 5 by default. The others wait.
- `transition` on the region animates each toast with `data-closed`, `data-enter` and `data-leave`, and a toast stays until its leave ends.
- The code of the region loads with the first toast of its queue, not with the page.
- The toasts stay usable while a modal is open.
