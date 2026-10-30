# Log: overlay-focus-fixes

- Nested modals: reproduced in Chrome on the website (modal page, Edit the greeting, Cancel, Discard): focus on body. Cause: the outer modal ends first and finds its trigger inert (the inner modal still holds the page); the inner one ends last and focuses its own target, the Cancel button, which is in the outer layer that already gave back and is about to leave. Fix in overlay.ts `release`: a layer that released is marked, targets inside it are skipped, and a target that was inert is kept for the next release.
- Tooltip refusal: the cause is `current` in `timing()`, set before `show()` runs. The show callbacks of TooltipTrigger and PreviewTrigger now return whether the value is open, and `reveal` clears `current` on false. The focus-after-blur case already worked, since blur hides at once; the focus after a hover did not.
- PreviewTrigger press: a mouse press hides the preview, then Chrome's focus event of the press runs `focusChanged`, `:focus-visible` matches, and the cooldown shows it again at once, after the leave transition. Fix: a mouse or pen press adds the trigger to `dismissed`, as Escape does.
- Modal and menu that both start open: already stack on main (Popover uses queueLoad since overlay-start-open). Test added only.
- Chrome: e2e steps in website.mjs for the first and third; a scratch route in examples/ui (removed) for the refusing tooltip, with playwright-core.
- `/docs/control-flow: 10 live samples render` fails with "Not connected" in the same e2e run; see the outcome.
