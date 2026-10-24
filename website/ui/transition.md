# Transition

Animates content in and out. It keeps the content in the page until its leave ends, which CSS cannot do for content that is removed.

```brm demo TransitionDemo

```

Other parts run the same steps with their `transition` prop: [DisclosurePanel](./disclosure.md#animating-the-panel), [Popover](./popover.md), [ModalOverlay](./modal.md), [Tooltip](./tooltip.md) and [ToastRegion](./toast.md). They show the same attributes, so the CSS below works for each of them.

- `show` opens and closes it. The page renders the content as `show` says, with no transition on load.
- It shows `data-closed` while the content is closed or about to open, and `data-enter`, `data-leave` and `data-transition` while it moves. Animate it from these in CSS:

```css
.note {
  transition: opacity 0.25s;
}

.note[data-closed] {
  opacity: 0;
}
```

- `enter`, `enterFrom`, `enterTo`, `leave`, `leaveFrom` and `leaveTo` add classes for each step, for a CSS of utility classes. `entered` stays on once the enter has finished.
- Each step waits until the element has no animation left running, read with `getAnimations()`. An element with no transition moves on at once.
- The content is `inert` from the start of its leave, so it takes no click or focus while it goes.
- `unmount` decides what happens once it has left. `true` removes the content, `false` keeps it with `hidden`, and `'offscreen'` keeps it in an [`#offscreen`](../docs/control-flow.md#offscreen) block, with its state.
- `appear` runs the enter when the browser renders the content, such as in markup that opens later.
- `beforeEnter`, `afterEnter`, `beforeLeave` and `afterLeave` follow each step. A transition that another one interrupts never reaches its `afterEnter` or `afterLeave`.

## Reduced motion

Reduced motion is for the CSS: a transition that a `prefers-reduced-motion` query removes has nothing to wait for.

```css
@media (prefers-reduced-motion: reduce) {
  .note {
    transition: none;
  }
}
```

## TransitionChild

An element inside a `Transition`, or inside a part with `transition`, that moves with it. It takes the props of `Transition`, except `show`.

- It enters once its parent has entered. With `appear`, it enters with its parent.
- Its parent leaves once it has left, so a group animates in from the outside and out from the inside.

```html
<Transition show=open class="backdrop">
  <TransitionChild class="panel">The panel slides in after the backdrop fades in.</TransitionChild>
</Transition>
```
