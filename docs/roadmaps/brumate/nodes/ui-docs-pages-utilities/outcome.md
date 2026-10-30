# Outcome: ui-docs-pages-utilities

## Built

| Page               | Added                                                                                              | Skipped                                   |
| ------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Separator          | SeparatorStyled (both orientations), use case SeparatorMenuDemo (toolbar groups)                   | anatomy, state: one element               |
| Heading            | use case HeadingDialogDemo (dialog title with `level`)                                             | anatomy, styled: no element of its own    |
| Transition         | TransitionStyled (default unmount, `unmount=false`, `appear`); TransitionChild and anatomy existed | state                                     |
| VisuallyHidden     | use case VisuallyHiddenSkipDemo (skip link with `as="a"` and `focusable`)                          | anatomy, state                            |
| Keyboard           | use case KeyboardListDemo (shortcut list in `dir="rtl"`)                                           | anatomy, state                            |
| I18nProvider       | use case I18nProviderLocaleDemo (locale switch changes the Meter text)                             | anatomy, styling: renders no element      |
| SelectionIndicator | use case SelectionIndicatorToggleDemo (pill in a ToggleButtonGroup); the Tabs demo existed         | styled page section: the demo carries CSS |

- Pages: website/ui/{separator,heading,transition,visually-hidden,keyboard,i18n-provider,selection-indicator}.md. Demos: website/ui/demos/.
- e2e/suites/website.mjs has one new flow: both schemes with axe on the seven pages, the CSS block on Separator and Transition, a Transition leave (removed, hidden, appear), the single pill moving to Month, the Meter text in de-DE, and the skip link showing with focus.
- Styled CSS uses `light-dark()`, system colors, a two-band focus ring and `prefers-reduced-motion`, with class prefixes of its own.

## Deviations

- None. website/src/routes/ui/_layout.brm was not changed.

## Stubs left

- None.

## Gotchas

- Text next to a `Transition` that leaves with `unmount` removal, in the same parent, breaks the client with "Missing end marker". Wrap the text in an element. Core issue, not fixed here.
- `moveIndicator` (packages/ui/src/selection-indicator.ts) takes the first comma part of `transition-timing-function`, so `cubic-bezier(...)` throws in `animate`. Fix: pass the whole value. The `.ui-indicator` rule of the layout has it too.
- An `I18nProvider` whose `locale` changes did not update its Meter in the browser; the demo builds a provider for each locale in an `#if`.

## Proposed learnings

- Put text in an element when it sits beside a Transition that unmounts | the client throws a missing end marker | website/ui/demos | no

## Verification

- `pnpm lint` (warnings only, as on main), `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter website check:samples`: 65 samples, 0 problems. `pnpm --filter website build`: pass.
- `node e2e/run.mjs --only website`: 68 passed, 1 failed (/docs/control-flow "10 live samples render", known on main). The overlays flow failed once with "Escape left the tooltip" and passed later.

## Size

- Estimated S, actual S.
