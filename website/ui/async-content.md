# Content that loads late

What a [Popover](./popover.md) or a [Modal](./modal.md) does when the content of its [Dialog](./dialog.md) is not there yet, such as a `#loading` body that waits for a server function.

- **Focus goes to the Dialog.** An overlay takes focus once, when it has opened. Content that is still loading has nothing to focus, so focus goes to the Dialog itself, and a screen reader reads its title.
- **Focus stays there** when the content arrives. `autofocus` inside a `#loading` body comes too late, and focus does not move to it.
- **The content loads again each time the overlay opens.** A closed overlay renders nothing, so the components inside it start over on the next open.
- **`#defer` does not work in an overlay.** Its `#else` stays for good. Use `#loading` instead.

`packages/ui/test/async-overlay.test.ts` checks each of these.

## Load the content with `#loading`

Load the data in a component inside the Dialog. The browser renders the content of an overlay when it opens, so the memo starts then, and `#loading` shows its `#else` until the value arrives:

```brm
<script>
  import { $memo } from 'brumate/signals';

  async function loadPlans(): Promise<string[]> {
    'use server';
    return ['Starter', 'Team', 'Company'];
  }

  const plans = $memo(loadPlans());
</script>

#loading {
  <ul>
    #for (plan of plans by plan) {
      <li>{plan}</li>
    }
  </ul>
} #else {
  <p>Loading the plans…</p>
}
```

Put the component in the Dialog, next to a title that is there from the start:

```brm
<script>
  import Button from '@brumate/ui/Button.brm';
  import Dialog from '@brumate/ui/Dialog.brm';
  import DialogTrigger from '@brumate/ui/DialogTrigger.brm';
  import Heading from '@brumate/ui/Heading.brm';
  import Popover from '@brumate/ui/Popover.brm';
  import Plans from './Plans.brm';
</script>

<DialogTrigger>
  <Button>Plans</Button>
  <Popover>
    <Dialog>
      <Heading slot="title">Plans</Heading>
      <Plans />
      <Button slot="close">Close</Button>
    </Dialog>
  </Popover>
</DialogTrigger>
```

- The Heading names the Dialog while the plans load, so a screen reader has something to read when focus moves.
- The close Button is outside the `#loading` body, so Tab reaches it at once.
- The server renders no overlay, so the server function runs only when the overlay opens.

See [`#loading`](../docs/async-data.md#loading) for the block itself.

## Where focus goes

| The Dialog holds                                  | Focus goes to                                        |
| ------------------------------------------------- | ---------------------------------------------------- |
| An element with `autofocus`, there from the start | That element                                         |
| A `#loading` body that waits                      | The Dialog, and it stays there when the body arrives |
| A `#defer` block                                  | The Dialog, with the `#else` of the block            |

To focus a field of the late content, put the field outside the `#loading` body, with `autofocus`, and only the data inside. The reader can then type at once. Focus that moves on its own later can interrupt a screen reader.

## `#defer` in an overlay

A `#defer` block asks the server for its body, but only for a block that the server rendered. The server renders no overlay, so a `#defer` in a Dialog has no body to ask for, and its `#else` stays. The compiler cannot report it, since the block is in the children of another component. See [`#defer`](../docs/async-data.md#defer).

Use `#loading` with a server function, as above. A server function runs on the server, so it can read the database and the cookies, as a `#defer` body can.

## Related

- [Keyboard and focus](./keyboard-and-focus.md#focus-in-an-overlay): the rules of focus in an overlay.
- [Popover](./popover.md#focus): where focus goes back when the overlay closes.
- [Async data](../docs/async-data.md): `#loading`, `#defer` and memos that wait.
