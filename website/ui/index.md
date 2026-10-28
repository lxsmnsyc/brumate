# brumate/ui

Accessible, unstyled parts for brumate pages. The server renders them, the browser keeps their state, and a part you do not render ships nothing.

[Start](./introduction.md) | [All parts](./parts.md) | [Design influences](./influences.md)

## Try the parts

These are the parts as you would import them. The style is the style of this site, and it comes from the data attributes of the parts.

```brm demo LandingControlsDemo

```

```brm demo LandingTabsDemo

```

## Unstyled

A part renders the right element and sets its state as `data-*` attributes. Your CSS decides the rest, with no class names to override:

```css
.button[data-pressed] {
  transform: translateY(1px);
}

.button[data-focus-visible] {
  outline: 2px solid var(--accent);
}
```

See [Styling](./styling.md) for the attributes of each part.

## Accessible

- Markup with the right roles and ARIA attributes, and native elements where the browser has them: `<button>`, `<input type="checkbox">` and `<a>`.
- One behavior for a mouse, a touch, a pen, a key and a screen reader. A press ends in the same `onPress` for all of them.
- Keyboard patterns of WAI-ARIA, such as arrow keys in tabs and radios, and focus that returns to where it was when a layer closes.

## Resumable

The server renders a part as HTML, with its state. The browser picks up where the server left off, and runs no component twice. Read [How the parts resume](./resuming.md) for what that changes in a part.

The code of a part comes with the page that renders it, so the first press needs no request. A part that a page does not render adds nothing. A part that a page renders adds the code below, whether it is open, pressed or used at all:

| Page that renders                 | JS, gzip | More than a page without parts |
| --------------------------------- | -------- | ------------------------------ |
| No part                           | 23.3 kB  | 0                              |
| `Checkbox`                        | 23.3 kB  | 0.04 kB                        |
| `Button`                          | 27.8 kB  | 4.6 kB                         |
| `Tabs` with a list and two panels | 33.7 kB  | 10.4 kB                        |
| `Dialog`, closed                  | 37.5 kB  | 14.3 kB                        |
| `Select` with two options, closed | 48.4 kB  | 25.2 kB                        |

The first row is the loader and the core of brumate, which every page with a script loads. A `Checkbox` ships almost nothing, since a native box checks without code, and only an indeterminate box loads more. A layer ships the code of every part inside it, such as the `Button`, `Popover` and `ListBox` of a `Select`.

These numbers come from `node scripts/measure-ui-sizes.mjs` in the `website` folder. It builds a small page for each row, renders it on the server, and adds up the gzip size of the files that the page loads. The sizes change as the parts and the compiler change, so run it again for the current ones.

## Works without scripts

A native element still works when no script runs: a button sends its form, a link follows, a box checks, and the radios of a group move with the arrow keys. A form checks its fields in the browser, and posts its values by name. A part that needs code, such as a `FileTrigger`, says so on its page.

## Where to go next

- [Introduction](./introduction.md) shows how to import a part and how parts work together.
- [All parts](./parts.md) has a card for each of the parts, from buttons and forms to dates, colors, tables and layers.
- [State](./state.md) explains `$bind` and the props that hold a value.
- [Design influences](./influences.md) lists the projects that shaped the parts.
