---
'@brumate/ui': minor
---

- A `ColorScheme` part keeps the choice of light, dark or system in a cookie. The server renders the `light` or `dark` class from it, so the first paint has no flash, and a change writes the cookie and the class. `as="html"` in the root layout puts the class on `<html>`, with a script in the head for `system` that carries the nonce of the render.
- `colorScheme()` from `@brumate/ui/color-scheme.brm.ts` reads the choice from the ColorScheme around a part and changes it. `ColorSchemeContext` holds it.
- `@brumate/ui/color-scheme.ts` has `readColorScheme`, `parseColorScheme`, `colorSchemeCookie`, `colorSchemeScript` and `resolveColorScheme`.
