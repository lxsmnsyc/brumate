# Outcome: context-menu

## Built

- `MenuTrigger` takes `trigger="contextmenu"` (packages/ui/src/MenuTrigger.brm). The menu opens at the pointer on a right click, at a touch held 500 ms (10 px slop), and under the focused element on the context menu key or Shift+F10 (first item focused). Escape gives focus back to the element that had it. The browser menu is kept away on the area and inside the menu; a right click outside closes it. An inner context menu wins on its own area. The Menu is the real Menu, with submenus and selection. Helpers: packages/ui/src/context-menu.ts.
- `DialogTrigger` takes `shortcut` (`KeyName`, such as `Mod+K`) and `shortcutInInput` (packages/ui/src/DialogTrigger.brm, packages/ui/src/shortcut.ts). It toggles the overlay from anywhere in the page, yields to a handler that prevented the key, to repeats and to composing, and to a focused text field unless `shortcutInInput`. Letters match in either case.
- position.ts: `Anchor`, `pointAnchor(x, y)`; `followTrigger` takes `Element | Anchor`. `OverlayTriggerState.point` (contexts.ts) carries the point; Popover uses it, with offset 0 by default.
- Docs: website/ui/menu.md (use case "A context menu", keyboard row), website/ui/autocomplete.md (palette recipe with `shortcut`), demos ContextMenuDemo.brm and CommandPaletteDemo.brm.
- Example `examples/ui/src/sections/ContextMenuSection.brm` and e2e `e2e/suites/ui/context-menu.mjs` (2 steps).
- Review fixes: a right click on the area moves an open menu to the new point, a scroll outside the menu closes it, and a dev warning for an unnamed context menu (Menu.brm, `warnUnnamedMenu`); dialog.md has a Shortcut section.
- Tests: packages/ui/test/context-menu.test.ts, 20 tests. Changeset .changeset/context-menu.md (minor, @brumate/ui).

## Deviations

- New files outside the owned paths: packages/ui/src/context-menu.ts, packages/ui/src/shortcut.ts, packages/ui/test/fixtures/context-menus.brm.
- Edited outside the owned paths (minimal): packages/ui/src/Popover.brm (anchor from a point), packages/ui/src/contexts.ts (`point`), packages/ui/src/menu.ts (`triggerId` optional), examples/ui/src/routes/index.brm (one style rule), examples/ui/src/sections.brm (two lines), e2e/suites/ui/index.mjs (one line).
- website/ui/dialog.md edited in the review fixes (a Shortcut section); packages/ui/src/Menu.brm edited (the warning).
- Removed website/ui/demos/AutocompletePaletteDemo.brm; CommandPaletteDemo.brm replaces it in autocomplete.md.
- DialogTrigger registers its listener with `$client(..., 'load')`, which prints the compiler warning that Popover and ModalOverlay already print.

## Stubs left

- None.

## Gotchas

- `unmount` of brumate/testing does not run $client cleanups, so a document listener of a DialogTrigger from an earlier test stays and prevents the key for the next mount. The test takes the keydown listeners off itself.
- Context menu: the area should be focusable (`tabindex="0"`) for the keyboard, and Menu needs `aria-label` (no Button names it). iOS needs `-webkit-touch-callout: none` on the area.
- The shortcut toggles when open, even from the field of the dialog; the field rule applies only while closed.
- A function ternary in a context value (`onPress: cond ? undefined : fn`) is not sendable to the browser; keep the function direct and check inside it.
- Not run in a real browser by me beyond the e2e step (Playwright, Chromium): Safari touch behavior is untested.

## Proposed learnings

- None.

## Verification

- `pnpm --filter @brumate/ui exec vitest run test/context-menu.test.ts`: 16 passed.
- `pnpm --filter @brumate/ui exec vitest run` (whole suite): 42 failed on a machine at load average 30 to 37, all with 2 to 5 s timeouts; the 15 failing files rerun with `--testTimeout=120000 --maxWorkers=2`: 156 passed, 1 expected fail, and one failure in context-menu.test.ts (first test, a 2 s `waitFor`) that passes alone. Not a clean single run.
- `node e2e/run.mjs --only ui`: 60 passed, 0 failed. Shift+F10 sends no contextmenu in headless Chromium on macOS, so the step uses the ContextMenu key.
- `pnpm --filter website check:samples`: 69 samples, 0 problems.
- `pnpm exec oxlint`: no errors (existing warnings). `pnpm format:check`: clean.
- `brumate-tsc --noEmit` in packages/ui, website, examples/ui: exit 0.
- Public repo, no workflow triggered.

## Size

- Estimated M, actual M.

## Main bugs

- None found. Note: `prevent(fn, 'Mod+K')` never matches Cmd+K, because `keyMatches` compares `event.key` case-sensitively and the browser sends `k`. By design of the typed `KeyName` (`Uppercase<Letter>`), not a bug, but surprising; `shortcut` here matches letters in either case.

## Review fixes verification

- context-menu, menu and popover tests with `--testTimeout=120000 --maxWorkers=2`: 57 passed (context-menu: 20).
- typecheck of packages/ui, website and examples/ui: exit 0. check:samples: 69 samples, 0 problems. oxlint: no errors. format:check: clean.
- `node e2e/run.mjs --only ui`: 60 passed, 0 failed. A first version of the scroll close failed this: a scroll event for a scroll that ended before the menu opened closed it, so the page counts as scrolled only when `scrollX` or `scrollY` changed (an element container closes it after 100 ms).

## Chrome check fix

- The site search listener (website/src/components/Search.brm, outside the owned paths) skips a keydown that is `defaultPrevented`, so a DialogTrigger with `shortcut="Mod+K"` wins over it. The palette demo uses `Mod+J`; the docs keep `Mod+K` as the usual key and say a page gives each action one key.
- e2e step in the website overlays flow (e2e/suites/website.mjs): Mod+J opens only the demo dialog, and Mod+J closes it. `node e2e/run.mjs --only website`: 74 passed, 0 failed. check:samples 69/0, oxlint no errors, format:check clean, website typecheck clean, context-menu tests 20 passed.
