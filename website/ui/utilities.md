# Utilities

`VisuallyHidden`, `Keyboard` and `I18nProvider`.

```brm demo UtilitiesDemo

```

## VisuallyHidden

Hides its content from sight, and keeps it for screen readers, such as the name of a button that shows only a mark.

- `as` renders another element, such as `as="a"` for a link that skips to the content.
- With `focusable`, the content shows while it has focus.

## Keyboard

A keyboard shortcut, as a `<kbd>`. It reads left to right in every language.

## I18nProvider

Gives the parts inside it a locale and its direction.

- `locale` is a language tag, such as `ar-EG`. The default is `en-US`, so the server and the browser format numbers the same way.
- The direction comes from the script of the locale. A `Toolbar` turns its arrow keys around right to left.
- It renders only its children. Put `lang` and `dir` on an element yourself, such as `<html>`.
