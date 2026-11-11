# Log: color-scheme

- Checked first: no ColorScheme part, helper or page on the branch.
- First design read the cookie with a `getEvent()` call inside a `.ts` helper. It threw in the example page: the compiler rewrites `getEvent()` to the render context only in `.brm` files, so in a `.ts` file it gets the event of the first part of the root component only. Fixed: `readColorScheme(event, name)` takes the event, and the `.brm` file calls `getEvent()`.
- A bound signal hides the cookie default of the part, so a caller starts the signal with `readColorScheme(getEvent())`.
- An explicit `class=(undefined)` next to a spread `class` dropped the class of the caller on the server, so the part writes `class=(resolved ?? '')`.
- `$client` with `'load'` warns, so the part uses the default trigger.
- The example page is a single page of 48 sections; the new section sits after ColorWheel, and its e2e step runs before the axe steps.

## Review round 1 (follow the prior art)

- The server renders `<html>` when a component renders it, so `<ColorScheme as="html">` in a layout puts the class, `data-color-scheme` and `style="color-scheme: ..."` on the first response. The browser updates the same element through the normal class binding. No new html-attribute API was needed.
- `#head` works inside the part (`{raw(script)}`), so the script of the head needs no layout code. A component cannot know the Content Security Policy nonce of the render, so the part takes a `nonce` prop and a `script=(false)` switch. The e2e server sends a nonce policy, so examples/ui uses `script=(false)`; unit tests cover the script, its nonce and its place in the head.
- `colorScheme()` is a reactive module (`color-scheme.brm.ts`), since `$getContext` is a compile-time function. It must be destructured (BRM164).
- A bound `undefined` value reads the cookie, so the author needs no seeding. `readColorScheme(event, name)` stays as a helper.
- The e2e PreviewTrigger step failed once ("it showed before its delay") under load, and passed 58/58 on the next run without changes.

## Review round 2 (the nonce)

- `RequestEvent.nonce` is set from the `nonce` option in `render` (and so `renderToStream`) and in the routes `handleRoute`. ColorScheme uses `nonce ?? getEvent().nonce`; examples/ui dropped `script=(false)`, and the e2e server's nonce policy accepts the head script (no CSP warning, 58 passed).
- Test `packages/brumate/test/event-nonce.test.ts` covers the event; the ui test renders with `nonce: 'render1'` and finds it on the head script.
- Under machine load two mutation tests timed out once; they passed on the next run with no change.

## Review round 3 (system after a change)

- Chrome showed that choosing `system` in the browser left the class empty. `$client` with the default `'visible'` trigger never ran for an element that is `<html>`, so `prefersDark` stayed undefined; the head script had only covered the first load. The part now uses `'load'`.
- The happy-dom test (Light to System with a dark `matchMedia`) passes with either trigger, since the stub observer always fires. The e2e step does catch it: it emulates dark, goes Light to System, expects `dark`, then emulates light and expects `light`.
- The example page has light-only styles, so under a dark device the axe step failed on contrast once the head script put `dark` on `<html>`. The ColorScheme step ends with the cookie set to `light`, so later steps load a light page.
