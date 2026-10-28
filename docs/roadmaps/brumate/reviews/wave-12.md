# Checkpoint 2026-10-28, wave 12

## Merged

- ui-landing-hero (#319): /ui is a marketing page in the style of the home page, with the card grid of every part (previews scaled to fit) and no /ui/parts page.
- ui-docs-kit (#323): the `brm anatomy` and `brm styled` fences, rewritten styling.md and state.md, Select as the pattern page, and a drift test (website/test/anatomy.test.ts).
- Docs pages on the pattern: controls (#326), collections (#329), forms (#331), overlays (#333), colors (#334), layout (#336), collections-2 (#339). Each family node stopped after a coherent group; the rest are new nodes.
- setter-ref-forward (#322): `$bind(x, fn)` gets its element, also on resume for a named prop. handler-code-wait (#324): a handler waits only for the update code it can need; core +46 B.
- ui-form-reset (#325): every form field resets with its form, through its setter; a prevented reset changes nothing.
- ui-refused-write-sync (#332): with a refusing `$bind` setter, every part shows the kept value (except TextField and SearchField, until bind-read-your-writes); `onChange` stays synchronous and reports the request.
- pending-submit (#330): a pending submit Button blocks a second submit (SubmitGuard).
- children-handler-refs (#337): a page function used by children that render later, as a handler, a prop or in a `#template`, is defined.
- ui-scroll-focus (#335): every scrolling table, code block and code card is keyboard-reachable; axe at 375px and 1280px across /docs and /ui.
- Not nodes: #320 (site contrast to 4.5:1, honest footer), #321 (slider and switch demo classes), #327 website-fixes (brand mark, shop list, highlighting), #328 (network panel after navigation), #338 (a user `style` no longer drops a part's own properties; overlays keep placement).

## Decisions (the maintainer)

- The 0.4.0 cut: release-0.4 waits for the docs pages, ui-skill, code-examples, try-sample-console, combobox-fixes, overlay-start-open, overlay-focus-fixes, checkbox-description, field-error-clears and changeset-review. @brumate/ui publishes as 0.1.0 with it.
- #332 option C: no per-part timers for `onChange`; the core node bind-read-your-writes (after 0.4.0) makes the kept value readable at once.
- A 0.x break is a minor changeset; style-global and ui-docs-style-global are for 0.5.0.

## Added nodes

- In the cut: ui-docs-pages-{forms,fields,collections-2,collections-3,dates,layout,utilities}, children-handler-refs, overlay-start-open, overlay-focus-fixes, checkbox-description, field-error-clears, combobox-fixes, pending-submit, ui-refused-write-sync, ui-form-reset.
- After 0.4.0: setter-ref-resume-rest, runtime-event-cancel, bind-read-your-writes, style-global, ui-docs-style-global, tsc-check-api, dom-content-loaded.

## Notes

- Reviews found real part bugs on almost every docs page; clicking through demos in Chrome is the best bug finder the project has.
- `event.preventDefault()` in a handler does nothing (handlers run after the event); use `prevent()`. Effects never run on load.
- Agents that leave background processes keep re-sending reports; tell them to stop their own processes before replying, and stop them with TaskStop if they loop.
- The machine reached a load average above 200 with four workers and four reviewers in Chrome; keep at most three building and stagger reviews.

## Next

- Wave 13 from `plan.py ready`, all in the 0.4.0 cut: combobox-fixes, overlay-start-open, the remaining docs page nodes, then ui-skill, code-examples, try-sample-console and changeset-review.
