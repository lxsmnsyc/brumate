# Tabs

Tabs that show one panel at a time.

```brm demo TabsDemo

```

```html
<Tabs selectedKey=$bind(section)>
  <TabList aria-label="Sections">
    <Tab id="intro">Intro</Tab>
    <Tab id="usage">Usage</Tab>
  </TabList>
  <TabPanel id="intro">…</TabPanel>
  <TabPanel id="usage">…</TabPanel>
</Tabs>
```

- `Tabs` hold a `TabList` with `Tab` elements, and a `TabPanel` for each tab, with the same `id`.
- `selectedKey` is the key of the selected tab. With none, the first tab is selected. A key that no tab has, or of a disabled tab, selects the first tab that is enabled. It starts its own state, or binds with `$bind`, and `onSelectionChange` gets each new key. See [State](./state.md).
- `disabledKeys`, or `isDisabled` on a Tab, keeps tabs from selection. `isDisabled` on Tabs disables them all.
- The TabList needs `aria-label` or `aria-labelledby`.

## Anatomy

```brm anatomy TabsAnatomy
`Tabs`: Holds the selection. It shows `data-orientation`.
`TabList`: Holds the tabs. It is a `tablist`, takes one stop of Tab, and needs `aria-label`.
`Tab`: One tab. Its `id` is its key, and it shows `data-selected` when it is selected.
`SelectionIndicator`: A bar that moves to the selected tab. Optional.
`TabPanel`: The content of one tab, with the `id` of that tab. Only the selected one renders.
```

```html
<Tabs>
  <TabList>
    <Tab>
      <SelectionIndicator />
    </>
  </>
  <TabPanel />
</>
```

The `SelectionIndicator` is optional. Each `TabPanel` has the `id` of its `Tab`.

## Props

### Tabs

```props Tabs

```

### TabList

```props TabList

```

### Tab

```props Tab

```

### TabPanel

```props TabPanel

```

## Data attributes

### Tabs and TabList

| Attribute          | When                                                    |
| ------------------ | ------------------------------------------------------- |
| `data-orientation` | The value of `orientation`, `horizontal` or `vertical`. |

### Tab

| Attribute            | When                              |
| -------------------- | --------------------------------- |
| `data-selected`      | The tab is selected.              |
| `data-disabled`      | The tab is disabled.              |
| `data-pressed`       | A pointer or a key holds it down. |
| `data-hovered`       | A mouse or a pen is over it.      |
| `data-focused`       | It has focus.                     |
| `data-focus-visible` | Its focus shows as a ring.        |

## Keyboard

Horizontal tabs use Left and Right, and leave Up and Down to the page. With `orientation="vertical"`, Up and Down move too. Right to left, Left and Right turn around.

| Key                         | Action                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `Tab`                       | Moves focus to the selected tab, and then into its panel.              |
| `ArrowRight` or `ArrowLeft` | Moves to the next or the previous tab that is enabled, round the ends. |
| `ArrowDown` or `ArrowUp`    | In vertical tabs, moves to the next or the previous tab.               |
| `Home` or `End`             | Moves to the first or the last tab.                                    |
| `Enter` or `Space`          | Selects the tab, with `keyboardActivation="manual"`.                   |

## Controlled and uncontrolled

`selectedKey` holds the key of the selected tab, or `null`. How you pass it picks who keeps it:

```brm demo TabsStateDemo

```

- `selectedKey` alone, or nothing, makes the Tabs keep their own selection. With no key, the first tab is selected. `selectedKey="b"` is where that selection starts. Press another tab and the Tabs keep the pick. A new value from you replaces it.
- `selectedKey=$bind(signal)` writes your signal. Change the signal and the Tabs follow.
- `selectedKey=$bind(signal, (next) => ...)` asks you first. The Tabs show what you keep, so a request that you ignore leaves the old key. Press Lock above and press a tab in the last row.
- `onSelectionChange` gets each new key, in every shape.
- Tabs are not a form field. They have no `name` and no reset, so a reset of a form leaves the selected tab as it is. The server renders the tab that the Tabs start with. See [State](./state.md).

## Styling

Style a tab with the data attributes above, such as `[data-selected]`, and the tabs with `[data-orientation]`. A [SelectionIndicator](./selection-indicator.md) in a tab draws a mark that moves between tabs. See [Styling](./styling.md).

This stylesheet styles every state of a tab: rest, hover, press, keyboard focus, selected, selected and hovered, selected and pressed, and disabled, with a bar that slides between tabs. Its tokens are at the top, and they follow the color scheme. Tab to the list, press the arrow keys, and note that Billing is skipped.

```brm styled TabsStyled

```

## Use cases

### Steps in order

The tabs after the furthest step that you reached are disabled with `disabledKeys`, and the Back and Next buttons write the bound `selectedKey`. A disabled tab cannot be selected by a press or by the arrow keys, which skip it. The buttons clamp the step, so a fast double press on Next stops at the last step.

```brm demo TabsStepsDemo

```

### Fields in a panel

A panel that is not selected does not render, so a field in it starts empty when its tab is selected again. `shouldForceMount` on a TabPanel keeps it on the page, hidden, with its state. Type in both fields, switch tabs, and come back.

```brm demo TabsFormDemo

```

## Focus and keys

- Tab stops once, at the selected tab, and then moves into its panel.
- The arrow keys move to the next and the previous tab, past disabled ones, and go round at the ends. Home and End go to the first and the last tab. Right to left, Left and Right turn around.
- `keyboardActivation="automatic"`, the default, selects the tab that the keys move to. `"manual"` selects it with Enter or Space.
- Horizontal tabs use Left and Right, and leave Up and Down to the page. `orientation="vertical"` uses Up and Down, and Left and Right too. Tabs and the TabList show `data-orientation`.

## Panels

- Only the panel of the selected tab renders its content. Selecting its tab again renders it anew, with new state, as a block does.
- `shouldForceMount` keeps a panel on the page while its tab is not selected, hidden, so it keeps its state.
- A panel with no content that takes Tab takes Tab itself, so it can still be reached. A panel with a field or a button in it does not.

## The tab

A Tab shows `data-selected`, `data-disabled`, `data-pressed`, `data-hovered`, `data-focused` and `data-focus-visible`. A press selects it.
