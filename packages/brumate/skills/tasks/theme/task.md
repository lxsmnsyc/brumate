# Color scheme toggle

Write `src/Theme.brm` and `src/ThemeToggle.brm`. The project has `@brumate/ui`.

- `Theme.brm` renders the `ColorScheme` part of `@brumate/ui` with the class `app` and `cookieName="theme"`, and a `ThemeToggle` inside it.
- `ThemeToggle.brm` reads the choice with `colorScheme()` from `@brumate/ui/color-scheme.brm.ts`. A `button` with the class `toggle` shows the choice as `Scheme: <choice>`. A click switches between `light` and `dark`: it sets `dark` when the choice is `light`, and `light` otherwise.
- Do not read or write the cookie yourself.
