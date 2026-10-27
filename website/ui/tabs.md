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

`selectedKey` holds the key of the selected tab. `selectedKey=(key)` starts the tabs' own selection, and `selectedKey=$bind(signal)` writes your signal. `onSelectionChange` gets each new key. With no key, the first tab is selected. See [State](./state.md).

## Styling

Style a tab with the data attributes above, such as `[data-selected]`, and the tabs with `[data-orientation]`. A [SelectionIndicator](./selection-indicator.md) in a tab draws a mark that moves between tabs. See [Styling](./styling.md).

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
