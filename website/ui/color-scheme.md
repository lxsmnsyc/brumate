---
summary: The light, dark or system choice of the page, kept in a cookie.
---

# ColorScheme

The light, dark or system choice of the page, which the server renders with the first response.

```brm demo ColorSchemeDemo

```

- It keeps the choice in a cookie, `color-scheme` by default. The server reads the cookie, so the first response has the class `light` or `dark`, and the page has no flash. It needs no signal of yours.
- `as="html"` in the root layout, the one that renders the document, puts the class, `data-color-scheme` and `color-scheme` on `<html>`, so `html`, `body` and a class strategy such as Tailwind's `dark:` variant follow it. Without `as`, it is a `div`, as in the demo.
- A change writes the cookie and the class. The cookie lasts a year, on the path `/`, and is `Secure` on https. The browser writes it, so it is not `HttpOnly`.
- The element has `color-scheme` in its style: `light` or `dark`, and `light dark` for `system` until the code loads. Form controls and scrollbars follow it.
- With `as="html"` and no cookie, a small script in the head puts the preference of the device on `<html>` before the first paint. Once the code loads, `system` follows `prefers-color-scheme` and its changes.
- A `Button` inside, at any depth, reads and changes the choice with `colorScheme()`.

```brm
<script>
  import Button from '@brumate/ui/Button.brm';
  import { colorScheme } from '@brumate/ui/color-scheme.brm.ts';

  const { value, resolved, setValue } = colorScheme();
</script>

<Button onPress=(() => setValue(resolved === 'dark' ? 'light' : 'dark'))>
  Switch from {value}
</Button>
```

- `value` is `light`, `dark` or `system`. `resolved` is `light` or `dark`, and undefined for `system` until the browser knows the preference. `setValue(next)` changes the choice.
- Destructure what it returns, and call it at the top level of a script, inside a `ColorScheme`. Without one around it, `value` is `system`, `resolved` is undefined, and `setValue` does nothing.

## Props

```props ColorScheme

```

## Data attributes

| Attribute           | When                                              |
| ------------------- | ------------------------------------------------- |
| `data-color-scheme` | Always. Its value is `light`, `dark` or `system`. |

The class is `light` or `dark`. For `system` it is missing until the script of the head or the code sets it.

## Controlled and uncontrolled

`value` is the state. See [State](./state.md).

- Alone, the part starts from the cookie and keeps its own state. `colorScheme()` changes it.
- `value=$bind(signal)` writes your signal. A write from outside, or from `setValue` inside, changes the class and the cookie. A signal that is `undefined` reads the cookie too, so it needs no start value:

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import ColorScheme from '@brumate/ui/ColorScheme.brm';

  let scheme = $signal<'light' | 'dark' | 'system' | undefined>(undefined);
</script>

<ColorScheme value=$bind(scheme)>…</ColorScheme>
```

- A page with more than one ColorScheme gives each a `cookieName`, or they share one cookie. Give a plain name, since it is written as it is.

## Styling

Style the class `dark` (or `light`) on the element. The tokens of the page are custom properties, so the rest follows. The element sets `color-scheme`, so `light-dark(a, b)` and the system colors pick their side from the choice. See [Styling](./styling.md).

The demo draws its box with these rules, and its buttons show the choice with a tint and an outline. The change has no transition: for `system`, the client sets the class after load, and a fade from the server's `light` would pass through grey colors that fail the contrast check:

```css
.color-scheme-demo {
  background: #fff;
  color: #1b1b1f;
}

.color-scheme-demo.dark {
  background: #1b1b1f;
  color: #f2f2f5;
}
```

## Helpers

`@brumate/ui/color-scheme.ts` exports the pieces:

- `COLOR_SCHEME_COOKIE` is the default name of the cookie.
- `readColorScheme(event, name)` gives the choice that the cookie of a request keeps. Pass `getEvent()`, called in a `.brm` file.
- `parseColorScheme(text)` gives `light`, `dark` or `system` for the value of a cookie.
- `colorSchemeCookie(name, choice, secure)` gives the string to assign to `document.cookie`.
- `colorSchemeScript(nonce)` gives the script of the head.
- `resolveColorScheme(choice, prefersDark)` gives `light` or `dark`.

## In a layout

```brm
<script>
  import ColorScheme from '@brumate/ui/ColorScheme.brm';

  const { children } = $props();
</script>

<ColorScheme as="html" lang="en">
  <head>…</head>
  <body>{children}</body>
</ColorScheme>
```

The server renders `<html class="dark" data-color-scheme="dark" style="color-scheme: dark" lang="en">` for a cookie of `dark`. A page that the server renders on each request can read the cookie, so a prerendered page cannot have the class from it.

## The script of the head

The script is inline. It carries the nonce of the render (`getEvent().nonce`, from the `nonce` option of `render` or `handle`), so a page with a Content Security Policy that uses a nonce runs it. Give the part a `nonce` of your own to use another, or `script=(false)` to leave the script out. Without it, `system` shows no class until the code loads, so also draw `@media (prefers-color-scheme: dark)` for `[data-color-scheme='system']` if the first paint matters. A policy with hashes needs the hash of the script, which `colorSchemeScript()` returns.
