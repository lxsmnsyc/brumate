# Log: docs-controls

- Made worktree node-docs-controls on docs/docs-controls. Built brumate, tsc and language-core dist.
- Button first: doc comments in Button.brm, then Keyboard, Controlled and uncontrolled and Styling in button.md. The props table of Button has no empty description (checked with readProps).
- Wrote a throwaway script that lists the rows of a part and flags empty descriptions. Used it for all 27 parts on the pages.
- Added 170 doc comments, comments only, in 27 files of packages/ui/src.
- Rewrote the 15 other pages to the contract order. Moved the old prose of each page to stay under the demo, and the extra sections (Validation, With createForm, Format, Stepping, Names, Values, Thumbs, Track, Editing) after Styling.
- Found unclear behavior, recorded in outcome.md.
- Checks: check:samples, vite build, website tests, brumate-tsc in ui and website, ui suite, oxlint, oxfmt.
