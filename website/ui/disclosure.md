# Disclosure

A section that the user expands and collapses, such as a question of an FAQ.

```brm demo DisclosureDemo

```

- A `Disclosure` holds a `Button` with `slot="trigger"`, often in a `Heading`, and a `DisclosurePanel`.
- The trigger gets `aria-expanded` and `aria-controls`. The panel is a group that the trigger names.
- `isExpanded` is the state. See [State](./state.md).
- While it is collapsed, the panel is `hidden="until-found"`, so find in page reaches its text and opens it. A browser without `until-found` hides it as `hidden` does. A disabled disclosure has a plain `hidden` panel, so find in page does not open it.
- The element shows `data-expanded` and `data-disabled`. The panel shows `data-expanded`.
- A [DisclosureGroup](./disclosure-group.md) opens several of them one at a time.

## Anatomy

```brm anatomy DisclosureAnatomy
`Disclosure`: Holds the state, and names the trigger and the panel to each other.
`Heading`: Optional. Puts the trigger in a heading of the page.
`Button`: The trigger, with `slot="trigger"`. It gets `aria-expanded` and `aria-controls`.
`DisclosurePanel`: The content. It is hidden while the disclosure is collapsed.
```

```html
<Disclosure>
  <Heading>
    <Button slot="trigger" />
  </>
  <DisclosurePanel />
</>
```

The `Heading` is optional. The picture draws the disclosure expanded, with the panel's clipping turned off, so that its badge shows.

## Props

### Disclosure

```props Disclosure

```

### DisclosurePanel

```props DisclosurePanel

```

## Data attributes

### Disclosure

| Attribute       | When            |
| --------------- | --------------- |
| `data-expanded` | It is expanded. |
| `data-disabled` | It is disabled. |

### DisclosurePanel

| Attribute         | When                                                    |
| ----------------- | ------------------------------------------------------- |
| `data-expanded`   | Its disclosure is expanded.                             |
| `data-closed`     | It has `transition`, and it is closed or about to open. |
| `data-enter`      | It has `transition`, and its enter is running.          |
| `data-leave`      | It has `transition`, and its leave is running.          |
| `data-transition` | It has `transition`, and it is entering or leaving.     |

The trigger shows the data attributes of a [Button](./button.md#data-attributes).

## Keyboard

| Key                | Action                                                        |
| ------------------ | ------------------------------------------------------------- |
| `Tab`              | Moves focus to the trigger. A disabled disclosure is skipped. |
| `Enter` or `Space` | Presses the trigger, which expands or collapses the panel.    |

## Controlled and uncontrolled

`isExpanded` holds the state. How you pass it picks who keeps it:

```brm demo DisclosureStateDemo

```

- `isExpanded` alone, or nothing, makes the disclosure keep its own state. It starts collapsed. `isExpanded=(true)` is where that state starts, and a press changes it from there.
- `isExpanded=$bind(signal)` writes your signal. Change the signal and the disclosure follows. The last two disclosures above share one signal.
- `isExpanded=$bind(signal, (next) => ...)` asks you first. The disclosure shows what you keep, so a request that you ignore leaves it as it was. Press Lock, then the last disclosure.
- `onExpandedChange` gets each new state when the disclosure changes by itself, which is a press or find in page. It does not run when you write the signal. In a [DisclosureGroup](./disclosure-group.md), the group holds the state, and a disclosure that the group collapses, because another one opened, does not run its own `onExpandedChange`. The `onExpandedChange` of the group does.
- A disclosure is not a form field, so a form reset leaves it as it is. The server renders the state it starts with, panel and `hidden` included. See [State](./state.md).

## Styling

Style the disclosure and its panel with the data attributes above, such as `[data-expanded]`. The trigger shows `aria-expanded` too, which is handy for a chevron. See [Animating the panel](#animating-the-panel) for `--disclosure-panel-height`, and [Styling](./styling.md).

This stylesheet makes a card list: rest, hover, press, a two-band focus ring, expanded, disabled, and a panel that grows from nothing to its height. Press Tab to see the ring.

```brm styled DisclosureStyled

```

## Animating the panel

`transition` on the `DisclosurePanel` lets CSS animate it. The demo above uses it.

- The panel shows `data-closed`, `data-enter` and `data-leave`, as a [Transition](./transition.md) does, and waits for its animations before it hides.
- It is `inert` while it leaves.
- `--disclosure-panel-height` holds the height of its content while it moves, from nothing to its height and back, so CSS can animate the height:

```css
.panel {
  height: var(--disclosure-panel-height, auto);
  overflow: clip;
  transition: height 0.25s;
}
```

- A [TransitionChild](./transition.md#transitionchild) inside the panel enters after it, and the panel leaves after it.
- Without `transition`, the panel opens and closes at once, with none of these.

## Keeping the content

`unmount` on the `DisclosurePanel` decides what happens to the content while the panel is collapsed:

| `unmount`     | The content while collapsed                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `false`       | Stays in the page with `hidden="until-found"`. This is the default.                                         |
| `true`        | Leaves the page, and starts over when the panel opens.                                                      |
| `'offscreen'` | Stays in an [`#offscreen`](../docs/control-flow.md#offscreen) block, with its state, and its effects pause. |

With `true` and `'offscreen'`, a panel that starts collapsed has no content in the page that the server sends, so find in page and search engines do not reach it. Keep the default for text that people search for.

## Use cases

### Terms that must be opened

`onExpandedChange` runs when the user opens the disclosure, so the page can know that the terms were opened. The Accept button waits for it.

```brm demo DisclosureTermsDemo

```

### Options that keep their state

`unmount="offscreen"` takes the collapsed panel out of the page and keeps its state. Type an address, collapse the section and open it again: the field still holds the text. With the default `unmount={false}` the content stays in the page too, and find in page reaches it. Use `'offscreen'` when the content is heavy and the page does not need to find it.

```brm demo DisclosureOptionsDemo

```
