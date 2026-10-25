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
- `selectedKey` is the key of the selected tab. With none, the first tab is selected. It starts its own state, or binds with `$bind`, and `onSelectionChange` gets each new key. See [State](./state.md).
- `disabledKeys`, or `isDisabled` on a Tab, keeps tabs from selection. `isDisabled` on Tabs disables them all.
- The TabList needs `aria-label` or `aria-labelledby`.

## Keyboard

- Tab stops once, at the selected tab, and then moves into its panel.
- The arrow keys move to the next and the previous tab, past disabled ones, and go round at the ends. Home and End go to the first and the last tab. Right to left, Left and Right turn around.
- `keyboardActivation="automatic"`, the default, selects the tab that the keys move to. `"manual"` selects it with Enter or Space.
- `orientation="vertical"` uses Up and Down. Tabs and the TabList show `data-orientation`.

## Panels

- Only the panel of the selected tab renders its content. Selecting its tab again renders it anew, with new state, as a block does.
- `shouldForceMount` keeps a panel on the page while its tab is not selected, hidden, so it keeps its state.
- A panel takes Tab, so a panel with no focusable content can still be reached.

## Tabs

A Tab shows `data-selected`, `data-disabled`, `data-pressed`, `data-hovered`, `data-focused` and `data-focus-visible`. A press selects it.
