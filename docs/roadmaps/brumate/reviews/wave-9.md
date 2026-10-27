# Checkpoint 2026-10-28, wave 9

## Merged

- drop-react-aria-refs (#302): about 358 mentions, plus hook names and React Stately, now describe the behavior. Comments, docs and test names only.
- memo-error-resume (#303): a memo that failed on the server is a `MemoError` in the page state. In production it carries only a safe message. Todos +39 B.
- docs-controls (#304), docs-collections (#308), docs-overlays (#309), docs-colors-dates (#310): every page of website/ui follows the props-table contract, and about 600 props got doc comments. Each needed a fix round for claims that did not match the code.
- element-checks (#307): plain elements' attributes, spreads and children are type-checked. 45 ui parts extend `ElementProps<tag>` (a type break, so @brumate/ui is minor). element-types v1.2 adds `autocorrect` and `webkitdirectory`. The first cut tripled `brumate-tsc` time; curried helpers brought it to +5% instantiations. Spreads of falsy values (`cond && {...}`, `undefined`) pass.
- Not roadmap nodes: #305 (production `#catch` values carry no message, `cause`, properties or stack of a server error), #306 and #311 (Home, End, arrows and Escape in groups, toolbars, popovers and toasts), #312 (ColorArea keys, Gregorian names in every locale, date field arrows with modifiers).

## Decisions (the maintainer)

- element-types v1.2 (change request of element-checks); `focusable` dropped from Icon.
- Event attributes are camel case only (node camel-event-names).
- Date parts get localized strings and a correct today (node ui-date-i18n, six languages first).

## Added nodes

- should: camel-event-names (types), ui-date-i18n (ui-0.1).

## Notes

- A docs commit straight to main failed root `oxfmt --check`; run it on roadmap edits before pushing.
- #312 merged after a nit round that nobody re-read; the classifier stopped the next step. Read every round's diff before a merge, and get a fresh recheck for a round that changes behavior code.
- Docs workers and element-checks edited the same ui files (doc comments next to props types), which made 45 merge conflicts over three rounds; resolutions were checked line by line.

## Next

- `plan.py ready`: template-context-types, dynamic-tag-types, camel-event-names, aria-types (types); ui-date-i18n, changeset-review (ui-0.1); brumate-check, llms-txt (agent-skill); the core-correct should nodes.
