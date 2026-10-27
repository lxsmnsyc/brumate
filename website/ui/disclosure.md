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

```html
<Disclosure>
  <Heading>
    <Button slot="trigger" />
  </>
  <DisclosurePanel />
</>
```

The `Heading` is optional.

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

`isExpanded` holds the state. `isExpanded=(true)` starts the disclosure expanded, and `isExpanded=$bind(signal)` writes your signal. `onExpandedChange` gets each new state. In a [DisclosureGroup](./disclosure-group.md), the group holds the state, and a disclosure that the group collapses, because another one opened, does not run its own `onExpandedChange`. The `onExpandedChange` of the group does. See [State](./state.md).

## Styling

Style the disclosure and its panel with the data attributes above, such as `[data-expanded]`. See [Animating the panel](#animating-the-panel) for `--disclosure-panel-height`, and [Styling](./styling.md).

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
