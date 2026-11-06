# Outcome: dom-content-loaded

## Decision

`onDOMContentLoaded` is a compile error (BRM201), not a handler on the exact name.

Evidence, from a production build of examples/todos with `<document onDOMContentLoaded>` in the layout (the parser kept the exact case for the test) and Chrome through Playwright:

- The handler is wired: dispatching `DOMContentLoaded` by hand after load set the signal.
- It did not run on its own in any load: two normal loads and one with the entry script held for 800 ms. The event had fired before the listener was attached. The server makes the entry script a module with `async` (`DocumentOptions.scripts`, prerender), so it runs when it arrives, after the parse in practice. `<document>` and `<window>` handlers attach on the scan at boot (`onListener` in runtime/boot.ts), not before.
- A client navigation never fires the event.

So the handler can run only in a race with a slow end of the document, and never after a navigation. It is not a feature to keep.

## Built

- packages/brumate/src/event-names.ts: `noHandlerFix` and a list of events with no handler, each with what to write instead. `DOMContentLoaded` names `$client(fn, 'load')`.
- The parser reports `"onDOMContentLoaded" cannot be a handler. {fix}` at the attribute, also for the shorthand, in any letter case, on an element, `<window>` and `<document>`. Catalog entry BRM201 (BRM191 to BRM200 are used on feat/context-stores); errors.md, the skill's references/errors.md and test/error-codes.json regenerated with `UPDATE_SKILL=1`.
- Other events found, checked in Chrome: `webkitAnimationStart`, `webkitAnimationIteration`, `webkitAnimationEnd` and `webkitTransitionEnd` fire under the camel name only (a lower-case listener got nothing, a camel one got both). They are errors that name `onAnimationStart` and the like. Also errors: `DOMActivate`, `DOMFocusIn`, `DOMFocusOut`, `DOMMouseScroll`, `MozMousePixelScroll`, and the seven `DOM*` mutation events (a MutationObserver instead).
- elements.d.ts: `Handlers` has no `webkit*` key, so `onWebkitanimationend` is a type error. `onDOMContentLoaded` was never in the types. The completeness test in elements-types.ts passes, with `@ts-expect-error` lines for both.
- Tests: parser.test.ts (five cases), event-names.test.ts, elements-types.ts. The timing run above was a throwaway script and is not committed, since the attribute no longer compiles.

## Numbers

Client gzip -9 of dist/client/**/*.js on clean rebuilds, main against this branch: examples/todos 39,340 to 39,353 bytes, examples/ui 199,353 to 199,352 bytes. The change is in the compiler only; the difference is build noise.

## Checks

- packages/brumate vitest: one run had 5 failures in 3 files under load, the next only `differential-1 ResolveGoneChild`, which passes alone (137 tests). Both tsconfigs type-check.
- packages/ui: 4 tests failed in the full run; the files pass alone with this change, and one of them also fails alone on main with the change taken out.
- Every other package and example: pass.

## Follow-ups

- None for this node.
