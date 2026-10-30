# Overlays

An overlay (`Popover`, `Modal`, `ModalOverlay`, `Sheet`, `Tooltip`, `ToastRegion`) renders in a layer at the end of `<body>`, or at the end of the layer of the overlay around it. A layer has `data-layer` and `display: contents`. An inner overlay is above the outer one with no `z-index`. Give each overlay its own class, since a rule that depends on a parent of the trigger does not reach it.

## DialogTrigger, Popover, Dialog

`DialogTrigger` holds a `Button` that opens the overlay, and the overlay. The `Dialog` is the content that people act on: a `Heading slot="title"` names it, and a `Button slot="close"` closes the overlay.

```brm
<script>
  import Button from '@brumate/ui/Button.brm';
  import Dialog from '@brumate/ui/Dialog.brm';
  import DialogTrigger from '@brumate/ui/DialogTrigger.brm';
  import Heading from '@brumate/ui/Heading.brm';
  import OverlayArrow from '@brumate/ui/OverlayArrow.brm';
  import Popover from '@brumate/ui/Popover.brm';
</script>

<DialogTrigger>
  <Button>About</Button>
  <Popover class="popover" placement="bottom start" transition>
    <OverlayArrow class="arrow" />
    <Dialog>
      <Heading slot="title" level=(4)>About this page</Heading>
      <p>A dialog takes focus, and its title names it.</p>
      <Button slot="close">Close</Button>
    </Dialog>
  </Popover>
</DialogTrigger>
```

- A `Popover` is modal by default: the rest of the page is `inert`, focus stays inside, and Escape or a press outside closes it. `isNonModal` leaves the page and focus as they are.
- `placement` picks the side (`bottom`, `bottom start`, `end`, `top end`). It flips when it does not fit, unless `shouldFlip=(false)`. `offset`, `crossOffset` and `containerPadding` set the space. `start` and `end` follow the direction of the locale.
- `isOpen` is the state. On the `DialogTrigger` it is the state of its overlay. A `Popover` with its own `isOpen` ignores the trigger and is not placed next to one outside a `DialogTrigger`. See [state.md](state.md).
- `onOpenChange` runs with each new state.
- A Popover is not a form field, so a reset of a form around it changes nothing.
- The server renders the trigger and no overlay: it opens once the code loads. Inside a `Select`, the popover keeps its items in the page while it is closed.

## Modal, ModalOverlay, Sheet

A `ModalOverlay` covers the window and holds a `Modal`, the box of the dialog. A `Modal` on its own renders its overlay too, with the props of the overlay.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';
  import Dialog from '@brumate/ui/Dialog.brm';
  import DialogTrigger from '@brumate/ui/DialogTrigger.brm';
  import Heading from '@brumate/ui/Heading.brm';
  import Modal from '@brumate/ui/Modal.brm';
  import ModalOverlay from '@brumate/ui/ModalOverlay.brm';

  let open = $signal(false);
</script>

<DialogTrigger isOpen=$bind(open)>
  <Button>Delete the draft</Button>
  <ModalOverlay class="backdrop" transition>
    <Modal class="modal">
      <Dialog role="alertdialog">
        <Heading slot="title" level=(4)>Delete the draft?</Heading>
        <p>It cannot come back.</p>
        <Button slot="close">Cancel</Button>
        <Button slot="close">Delete</Button>
      </Dialog>
    </Modal>
  </ModalOverlay>
</DialogTrigger>
```

- Escape closes a modal unless `isKeyboardDismissDisabled`. A press on the overlay, outside the Modal, closes it only with `isDismissable`.
- The overlay has `data-modal-overlay` and sets `--visual-viewport-height`. The Modal has `data-modal`.
- A modal inside a modal opens an overlay of its own, and Escape closes only the top one.
- `Sheet` is a `Modal` along an edge: `side` is `start`, `end`, `top` or `bottom`, and it shows `data-sheet` and `data-side`. CSS places and sizes it. A press outside closes it unless `isDismissable=(false)`.
- Focus goes back to the element that had it, or to the trigger.

## Tooltip

`TooltipTrigger` holds a `Button` and a `Tooltip`. It shows on hover after `delay` (1500 ms by default) and at once on keyboard focus. A touch never shows it, so put nothing there that people need. It holds no buttons or links: use a Popover for content that people act on.

```brm
<script>
  import Button from '@brumate/ui/Button.brm';
  import OverlayArrow from '@brumate/ui/OverlayArrow.brm';
  import Tooltip from '@brumate/ui/Tooltip.brm';
  import TooltipTrigger from '@brumate/ui/TooltipTrigger.brm';
</script>

<TooltipTrigger delay=(600)>
  <Button>Copy</Button>
  <Tooltip class="tooltip" offset=(8) transition>
    <OverlayArrow class="arrow" />
    Copy the link
  </Tooltip>
</TooltipTrigger>
```

## Toasts

`ToastRegion` renders the toasts of a queue at the end of the page. A handler adds one with `toastQueue<T>('name').add(content, { timeout })`. The `toast` template renders a `Toast`. See [templates.md](templates.md).

## Transition

`Transition` animates its content in and out and keeps it in the page until its leave ends. `show` opens and closes it, and `unmount` decides what stays: `true` removes the content, `false` keeps it `hidden`, and `'offscreen'` keeps it with its state. The other overlays run the same steps with their `transition` prop and show the same attributes.
