# Log: docs-overlays

- Made the worktree node-docs-overlays on docs/docs-overlays from origin/main. Built brumate, tsc and language-core with tsdown.
- Wrote 128 doc comments with a script (comments only, one per prop with none) for 31 parts. Checked with readProps: 160 rows, none empty.
- Reworded the comment of Breadcrumb that named a library, and the one of VisuallyHidden. Fixed the DialogTrigger comment, which said the Button gets aria-haspopup: the code sets none.
- Did dialog.md first and read its table in the server bundle, then the other 19 pages.
- Checked each data attribute and key against the source (Popover.brm, ModalOverlay.brm, Modal.brm, Sheet.brm, Tooltip*.brm, PreviewTrigger.brm and preview.ts, ToastRegion.brm and toast.ts, Disclosure*.brm, Breadcrumb*.brm, toolbar.ts, Group.brm, Separator.brm, Transition.brm and transition.ts).
- preview-trigger.md had a Keyboard prose section. Moved it into the table, with the prose line after it.
- Checks: check:samples, vite build (client and ssr), website tests, brumate-tsc in packages/ui and website, ui suite, oxlint, oxfmt --check.
