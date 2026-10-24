# I18nProvider

Gives the parts inside it a locale and its direction.

```brm demo I18nProviderDemo

```

- `locale` is a language tag, such as `ar-EG`. The default is `en-US`, so the server and the browser format numbers the same way.
- The direction comes from the script of the locale. A [Toolbar](./toolbar.md) turns its arrow keys around right to left, and a [Popover](./popover.md#placement) reads `start` and `end` in it.
- It renders only its children. Put `lang` and `dir` on an element yourself, such as `<html>`.
