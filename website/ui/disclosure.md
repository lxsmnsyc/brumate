# Disclosure and Transition

Content that opens and closes: `Disclosure`, `DisclosurePanel`, `DisclosureGroup` and `Transition`.

## Disclosure

A section that the user expands and collapses, such as a question of an FAQ.

```brm demo DisclosureDemo

```

- A `Disclosure` holds a `Button` with `slot="trigger"`, often in a `Heading`, and a `DisclosurePanel`.
- The trigger gets `aria-expanded` and `aria-controls`. The panel is a group that the trigger names.
- `isExpanded` is the state. See [State](./state.md).
- While it is collapsed, the panel is `hidden="until-found"`, so find in page reaches its text and opens it. A browser without `until-found` hides it as `hidden` does.
- The element shows `data-expanded` and `data-disabled`. The panel shows `data-expanded`.

## DisclosureGroup

Disclosures that open one at a time, such as an accordion.

- Each `Disclosure` names itself with `id`, and `expandedKeys` is the list of the open ones.
- `allowsMultipleExpanded` lets several be open.
- `isDisabled` disables every trigger.

## Transition

Animates content in and out. It keeps the content in the page until its leave transition ends, which CSS cannot do for content that is removed.

```brm demo TransitionDemo

```

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

- `enter`, `enterFrom`, `enterTo`, `leave`, `leaveFrom` and `leaveTo` add classes for each step, for a CSS of utility classes.
- It waits for the end of the transition or the animation of its element, and no longer than its duration.
- `unmount=(false)` keeps the content in the page while it is closed, with `hidden`.
- With `prefers-reduced-motion`, nothing waits.
- `onBeforeEnter`, `onAfterEnter`, `onBeforeLeave` and `onAfterLeave` follow each step.
