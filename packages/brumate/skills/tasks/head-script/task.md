# Head script with a nonce

Write `src/Analytics.brm`. It is a component for the `<head>` of a layout.

- It writes one inline script with `raw()` from `brumate/html`, with the code `window.__seen = (window.__seen || 0) + 1`.
- The script has the attribute `data-rerun`, so it runs again after each client navigation.
- The script has a `nonce` attribute with the nonce of the render, from `getEvent().nonce`. Without a nonce, it has no `nonce` attribute.
