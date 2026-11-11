# Outcome: color-scheme

## Built

- `packages/ui/src/ColorScheme.brm`: the provider. It renders `as` (a `div`; `as="html"` in a layout for `<html>`) with the class `light` or `dark`, `data-color-scheme` and `color-scheme` in its style (`light dark` for `system` before load). `value` (`light`, `dark`, `system`) is the cookie `color-scheme` (`cookieName` renames it) when alone or `undefined`, and takes `$bind`. An effect writes the cookie on each change. For `system`, `$client` (trigger `load`, since the element can be `<html>`) sets `light` or `dark` from `prefers-color-scheme` and follows its changes. With `as="html"` and a `system` choice, a script in the head sets the class and `color-scheme` on `<html>` before the first paint (`nonce` for a policy, `script=(false)` to omit it).
- `packages/ui/src/color-scheme.brm.ts`: `colorScheme()` returns `{ value, resolved, setValue }` from the ColorScheme around the part. `ColorSchemeContext`, `ColorSchemeState` and `ColorSchemeGiven` are in `packages/ui/src/contexts.ts` (no default value).
- `packages/ui/src/color-scheme.ts`: `COLOR_SCHEME_COOKIE`, `parseColorScheme`, `readColorScheme(event, name)`, `colorSchemeCookie(name, choice, secure)`, `colorSchemeScript(nonce)` and `resolveColorScheme`.
- `packages/ui/test/color-scheme.test.ts` (7 tests) with five fixtures: the cookie and the class, no empty class, `colorScheme()` and the cookie write, `system` with a stubbed `matchMedia` that fires `change`, an undefined bound value, `<html>` with and without the head script and its nonce, and the helpers.
- `website/ui/color-scheme.md`, `website/ui/demos/ColorSchemeDemo.brm` and `ColorSchemeChoices.brm`, and the page in the Utilities group of `website/src/ui-groups.ts`.
- `packages/brumate/src/runtime/request.ts`, `server.ts`: `RequestEvent.nonce`, the nonce of the render (`render`, `renderToStream`, the routes `handle`), documented in `reference-security.md` and `reference-server.md`; `packages/brumate/test/event-nonce.test.ts`; `.changeset/event-nonce.md` (`brumate` minor).
- examples/ui: the layout renders `<ColorScheme as="html">`, `ColorSchemeSection.brm` uses `colorScheme()`, and `e2e/suites/ui/color-scheme.mjs` checks the cookie, the class on `<html>` in the first response, and a reload.
- `.changeset/color-scheme.md` (`@brumate/ui` minor).

Demo page for a browser check: `/ui/color-scheme` on the website, and the ColorScheme section of examples/ui (the class is on `<html>`).

## Deviations

- `website/src/ui-groups.ts` is edited (one entry), since the sidebar and the cards come from it and not from `website/src/ui.ts`.
- New files outside the owned list: `packages/ui/src/color-scheme.brm.ts` (a reactive module, since `colorScheme()` calls `$getContext`), an entry in `packages/ui/src/contexts.ts`, `website/ui/demos/ColorSchemeChoices.brm`, the test fixtures, and an edit of `examples/ui/src/routes/_layout.brm` (under the shared `examples/ui/src/**`).
- `ColorScheme` takes the nonce of the render from `getEvent().nonce`, a small addition to the core (new API on `RequestEvent`), so the head script is on by default under a nonce policy.
- The cookie is not `HttpOnly`, since the browser writes it with `document.cookie`. The cookie name is written and read as it is (no encoding).

## Stubs left

- None.

## Gotchas

- The core change touches `brumate`; it is a minor changeset of its own.
- `getEvent()` in a `.ts` file loses the event after an `await` of an ancestor, while the same call in a `.brm` file works anywhere in a render. A helper takes the event as an argument.
- A page that prerenders (for example `/`) cannot read the cookie. The part is for pages that the server renders on request.
- The class order changes after a live update (`dark app`, from `app dark` on the server). Tests compare `classList`.

- The styles of the examples/ui page are light only, so the ColorScheme e2e step leaves the cookie as `light`.

## Proposed learnings

- A helper in a `.ts` file takes the event as an argument; `getEvent()` is called in the `.brm` file | the compiler rewrites it to the render context only in `.brm` files, and in a `.ts` file it fails after an await of an ancestor | packages/ui | no

## Main bugs

- `getEvent()` called from a `.ts` module during render throws "works in ... before their first await" when an ancestor component has awaited, while the docs say it works while a component renders. Repro: a route page under a layout, with `import { getEvent } from 'brumate/server'; export function read() { return getEvent().getCookie('x'); }` in a `.ts` file, called from the page's script. The same call in the `.brm` script works. Seen on the production build of examples/ui; not confirmed on main, and a `mount` test did not reproduce it.

## Verification

- `pnpm --filter @brumate/ui exec vitest run`: 79 files, 807 passed plus 1 expected fail.
- `packages/brumate`: `event-nonce`, `render` and `order` tests, 64 passed.
- `node e2e/run.mjs --only ui`: 58 passed, 0 failed, with the head script on under the nonce policy of the e2e server.
- `pnpm --filter website check:samples`: 69 samples, 0 problems. `pnpm exec oxlint`: no finding in the new files. `pnpm format:check`: clean.
- `pnpm typecheck` in packages/brumate, packages/ui, website and examples/ui: pass.
- Chrome check by the coordinator found `system` not resolving after a change; fixed with the `load` trigger, and the e2e step now goes Light to System with an emulated dark device and back.
- `e2e --only ui`: 58 passed after the fix.

## Size

- Estimated M, actual M.
